const SUPABASE_URL = 'https://oakkfndpfsbusdcfozyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lC89Gu7yVCtUp2h-ClPsuQ_Y78QAG3c';

async function check() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  const resProfiles = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, { headers });
  console.log('Profiles:', await resProfiles.json());

  const resMeals = await fetch(`${SUPABASE_URL}/rest/v1/meal_entries?select=*`, { headers });
  console.log('Meal Entries:', await resMeals.json());

  const resSummaries = await fetch(`${SUPABASE_URL}/rest/v1/daily_summaries?select=*`, { headers });
  console.log('Daily Summaries:', await resSummaries.json());

  const resExercises = await fetch(`${SUPABASE_URL}/rest/v1/exercises?select=*`, { headers });
  console.log('Exercises:', await resExercises.json());
}

check();
