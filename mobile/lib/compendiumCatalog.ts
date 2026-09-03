import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityGroup, ActivityVariant } from './types';
import defaultCatalog from '../assets/data/compendium.json';

const STORAGE_KEY = '@macro_tracker_compendium_curated_v4';
const VERSION_KEY = '@macro_tracker_compendium_version';

interface CatalogState {
  version: string;
  groups: ActivityGroup[];
  variants: ActivityVariant[];
  groupMap: Map<string, ActivityGroup>;
  variantsByGroup: Map<string, ActivityVariant[]>;
}

// In-memory singleton state
let catalogState: CatalogState = buildState(
  (defaultCatalog as any).version || '2024.3',
  (defaultCatalog as any).groups || [],
  (defaultCatalog as any).variants || []
);

function buildState(version: string, groups: ActivityGroup[], variants: ActivityVariant[]): CatalogState {
  const groupMap = new Map<string, ActivityGroup>();
  const variantsByGroup = new Map<string, ActivityVariant[]>();

  for (const g of groups) {
    groupMap.set(g.code, g);
    variantsByGroup.set(g.code, []);
  }

  for (const v of variants) {
    const list = variantsByGroup.get(v.group_code);
    if (list) {
      list.push(v);
    } else {
      variantsByGroup.set(v.group_code, [v]);
    }
  }

  // Sort variants within each group by MET (low to high)
  for (const list of variantsByGroup.values()) {
    list.sort((a, b) => a.met - b.met);
  }

  return {
    version,
    groups,
    variants,
    groupMap,
    variantsByGroup,
  };
}

/**
 * Initialize catalog on app launch.
 * Proactively purges legacy uncurated v1/v2/v3 caches and validates version.
 * Loads curated bundled JSON as the authoritative source of truth.
 */
export async function initCatalog(supabaseClient?: any): Promise<void> {
  try {
    const bundledVersion = (defaultCatalog as any).version || '2024.3';

    // Proactively purge old storage keys to clear any stale uncurated cache
    try {
      await AsyncStorage.multiRemove([
        '@macro_tracker_compendium_catalog',
        '@macro_tracker_compendium_catalog_v2',
        '@macro_tracker_compendium_curated_v3',
      ]);
    } catch (_e) {}

    // Always ensure local state starts with clean bundled curated catalog
    catalogState = buildState(bundledVersion, (defaultCatalog as any).groups || [], (defaultCatalog as any).variants || []);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCatalog));
    await AsyncStorage.setItem(VERSION_KEY, bundledVersion);

    // Only check remote if supabase client is provided, and never accept uncurated massive lists
    if (supabaseClient) {
      checkRemoteVersion(supabaseClient).catch((err) => {
        console.log('[CompendiumCatalog] Background version check skipped:', err.message);
      });
    }
  } catch (err) {
    console.warn('[CompendiumCatalog] Failed to load cached catalog, using bundle:', err);
  }
}

async function checkRemoteVersion(supabaseClient: any): Promise<void> {
  try {
    const { data: remoteVersionData, error: versionError } = await supabaseClient
      .from('activity_catalog_versions')
      .select('version')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError || !remoteVersionData?.version) return;

    const remoteVersion = remoteVersionData.version;
    // Only sync if remote is strictly a newer curated release (e.g. > 2024.3)
    if (remoteVersion > catalogState.version) {
      const [{ data: remoteGroups }, { data: remoteVariants }] = await Promise.all([
        supabaseClient.from('activity_groups').select('code, name, category, default_met, search_keywords').eq('is_active', true),
        supabaseClient.from('activity_types').select('code, group_code, name, met, category, intensity_level').eq('is_active', true),
      ]);

      // Only accept if remote has been properly curated (<= 300 variants total)
      if (remoteGroups && remoteVariants && remoteGroups.length > 0 && remoteVariants.length <= 300) {
        catalogState = buildState(remoteVersion, remoteGroups, remoteVariants);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: remoteVersion,
          groups: remoteGroups,
          variants: remoteVariants,
        }));
        await AsyncStorage.setItem(VERSION_KEY, remoteVersion);
        console.log(`[CompendiumCatalog] Synced curated remote version ${remoteVersion}`);
      }
    }
  } catch (syncErr) {
    console.warn('[CompendiumCatalog] Remote sync error:', syncErr);
  }
}

/**
 * Get all Tier 1 Activity Groups
 */
export function getGroups(): ActivityGroup[] {
  return catalogState.groups;
}

/**
 * Get a specific Activity Group by code
 */
export function getGroup(code: string): ActivityGroup | undefined {
  return catalogState.groupMap.get(code);
}

/**
 * Get all Tier 2 variants for a group, sorted by intensity/MET.
 * Defensively clamps to at most 4-5 clean, distinct options so the user is never overwhelmed.
 */
export function getVariantsForGroup(groupCode: string): ActivityVariant[] {
  const list = catalogState.variantsByGroup.get(groupCode) || [];
  if (list.length <= 5) {
    return list;
  }

  // If for any reason more than 5 variants exist, pick at most 4 clean representative tiers
  const light = list.filter((v) => v.intensity_level === 'light');
  const mod = list.filter((v) => v.intensity_level === 'moderate');
  const vig = list.filter((v) => v.intensity_level === 'vigorous');

  const result: ActivityVariant[] = [];
  if (light.length > 0) result.push(light[0]);
  if (mod.length > 0) {
    result.push(mod[0]);
    if (mod.length > 1) result.push(mod[mod.length - 1]);
  }
  if (vig.length > 0) {
    result.push(vig[0]);
    if (vig.length > 1) result.push(vig[vig.length - 1]);
  }

  return result.slice(0, 5);
}

/**
 * Search the catalog for manual selection
 */
export function searchCatalog(query: string): { groups: ActivityGroup[]; variants: ActivityVariant[] } {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) {
    return { groups: catalogState.groups.slice(0, 30), variants: [] };
  }

  const terms = cleanQ.split(/\s+/).filter(Boolean);

  const matchedGroups = catalogState.groups.filter((g) => {
    const text = `${g.name} ${g.category} ${(g.search_keywords || []).join(' ')}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });

  const matchedVariants = catalogState.variants
    .filter((v) => {
      const text = `${v.name} ${v.category}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .slice(0, 40);

  return {
    groups: matchedGroups.slice(0, 20),
    variants: matchedVariants,
  };
}

/**
 * Calculate net calories burned using standard ACSM formula:
 * Net Calories = duration_min * ((MET - 1) * 3.5 * weight_kg) / 200
 */
export function calculateBurnedCalories(met: number, durationMinutes: number, weightKg: number): number {
  if (durationMinutes <= 0) return 0;
  const safeWeight = weightKg > 0 ? weightKg : 70;
  const netMet = Math.max(0.1, met - 1);
  return Math.round(durationMinutes * ((netMet * 3.5 * safeWeight) / 200));
}

/**
 * Clean variant description for user presentation
 * (Removes academic codes like "Taylor Code 115" or raw technical jargon)
 * NOTE: As requested, MET values are strictly NOT displayed to the user.
 */
export function cleanVariantName(rawName: string): string {
  return rawName
    .replace(/\(Taylor Code\s*\w*\)/gi, '')
    .replace(/\(formerly code\s*\w*\)/gi, '')
    .replace(/,\s*general$/i, '')
    .trim();
}

/**
 * Returns user-friendly intensity label without exposing MET values
 */
export function getIntensityLabel(intensity: 'light' | 'moderate' | 'vigorous'): string {
  switch (intensity) {
    case 'light':
      return 'Light / Casual';
    case 'vigorous':
      return 'Vigorous / Fast';
    case 'moderate':
    default:
      return 'Moderate';
  }
}
