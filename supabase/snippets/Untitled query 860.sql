grant select, insert on public.food_entries to authenticated;

grant select, insert, update on public.daily_summaries to authenticated;


select
    schemaname,
    tablename,
    rowsecurity
from pg_tables
where tablename in ('food_entries', 'daily_summaries');

alter table public.daily_summaries enable row level security;


create policy "Users can update their own daily summaries"
on public.daily_summaries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update
on public.daily_summaries
to authenticated;