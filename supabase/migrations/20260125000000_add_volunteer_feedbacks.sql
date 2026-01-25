create table public.volunteer_feedbacks (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  volunteer_id uuid not null references profiles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  constraint volunteer_feedbacks_pkey primary key (id)
);

alter table public.volunteer_feedbacks enable row level security;

create policy "Users can view their own feedbacks"
  on public.volunteer_feedbacks
  for select
  using (auth.uid() = volunteer_id);

create policy "Admins and Heads can view all feedbacks"
  on public.volunteer_feedbacks
  for select
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'head_hr', 'hr', 'supervisor', 'committee_leader', 'head_caravans', 'head_production', 'head_fourth_year', 'head_events', 'head_ethics', 'head_quran')
    )
  );

create policy "Admins and Heads can insert feedbacks"
  on public.volunteer_feedbacks
  for insert
  with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'head_hr', 'hr', 'supervisor', 'committee_leader', 'head_caravans', 'head_production', 'head_fourth_year', 'head_events', 'head_ethics', 'head_quran')
    )
  );

create policy "Authors can delete their own feedbacks"
  on public.volunteer_feedbacks
  for delete
  using (auth.uid() = author_id);

create policy "Authors can update their own feedbacks"
  on public.volunteer_feedbacks
  for update
  using (auth.uid() = author_id);
