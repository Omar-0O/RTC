create table if not exists public.activity_type_committees (
    activity_type_id uuid references public.activity_types(id) on delete cascade not null,
    committee_id uuid references public.committees(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (activity_type_id, committee_id)
);

alter table public.activity_type_committees enable row level security;

create policy "Enable read access for authenticated users"
on public.activity_type_committees
for select
to authenticated
using (true);

create policy "Enable insert for admins and leaders"
on public.activity_type_committees
for insert
to authenticated
with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'supervisor', 'committee_leader')
    )
);

create policy "Enable delete for admins and leaders"
on public.activity_type_committees
for delete
to authenticated
using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'supervisor', 'committee_leader')
    )
);

-- Migrate existing data
insert into public.activity_type_committees (activity_type_id, committee_id)
select id, committee_id
from public.activity_types
where committee_id is not null
on conflict do nothing;
