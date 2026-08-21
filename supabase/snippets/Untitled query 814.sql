-- =============================================================================
-- FUNCTIONS / RPC: delete_food_entry
-- =============================================================================
create or replace function public.delete_food_entry(entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_entry record;
  v_entry_date date;
  v_summary record;
begin
  -- 1. Check authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 2. Verify existence and ownership
  select * into v_entry
  from public.food_entries
  where id = entry_id and user_id = v_user_id;

  if not found then
    raise exception 'Entry not found or unauthorized';
  end if;

  -- 3. Extract entry date
  v_entry_date := (v_entry.created_at at time zone 'UTC')::date;

  -- 4. Delete the food entry
  delete from public.food_entries
  where id = entry_id and user_id = v_user_id;

  -- 5. Atomically update the daily summary with row-level lock
  select * into v_summary
  from public.daily_summaries
  where user_id = v_user_id and summary_date = v_entry_date
  for update;

  if found then
    update public.daily_summaries
    set
      total_calories = greatest(0, total_calories - coalesce(v_entry.calories, 0)),
      total_protein  = greatest(0, total_protein  - coalesce(v_entry.protein, 0)),
      total_carbs    = greatest(0, total_carbs    - coalesce(v_entry.carbs, 0)),
      total_fat      = greatest(0, total_fat      - coalesce(v_entry.fat, 0)),
      total_fiber    = greatest(0, total_fiber    - coalesce(v_entry.fiber, 0)),
      meal_count     = greatest(0, meal_count - 1),
      updated_at     = now()
    where id = v_summary.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_id', entry_id
  );
end;
$$;

grant execute on function public.delete_food_entry(uuid) to authenticated;

