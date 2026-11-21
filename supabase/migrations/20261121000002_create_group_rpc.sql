-- Fix group creation RLS and add atomic create_group RPC

-- 1. Allow creator to view group even before member row is selected
drop policy if exists "Members can view their groups" on public.groups;
create policy "Members can view their groups"
  on public.groups for select
  using (public.is_group_member(id) or created_by = auth.uid());

-- 2. Atomic create_group RPC
create or replace function public.create_group(
  p_name text,
  p_invite_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_group_id uuid;
  v_user_id uuid;
  v_code text;
  v_user_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: caller must be authenticated';
  end if;

  if p_invite_code is null or trim(p_invite_code) = '' then
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  else
    v_code := upper(trim(p_invite_code));
  end if;

  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), v_code, v_user_id)
  returning id into v_group_id;

  select coalesce(display_name, 'Admin') into v_user_name
  from public.profiles
  where id = v_user_id;

  insert into public.members (group_id, user_id, display_name, role)
  values (v_group_id, v_user_id, coalesce(v_user_name, 'Admin'), 'admin');

  return v_group_id;
end;
$$;
