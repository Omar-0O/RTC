-- Allow users to update their own cover_url
create policy "Users can update their own cover_url"
on profiles for update
to authenticated
using ( auth.uid() = id )
with check ( auth.uid() = id );

-- Allow admins/hr to update any profile's cover_url
create policy "Admins and HR can update any profile cover_url"
on profiles for update
to authenticated
using ( 
  exists (
    select 1 from user_roles 
    where user_id = auth.uid() 
    and role in ('admin', 'head_hr', 'hr')
  )
)
with check (
  exists (
    select 1 from user_roles 
    where user_id = auth.uid() 
    and role in ('admin', 'head_hr', 'hr')
  )
);
