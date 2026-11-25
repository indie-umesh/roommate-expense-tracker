-- Flexible invite code matching
create or replace function public.join_group(
  p_invite_code text,
  p_claim_member_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_group_id uuid;
  v_caller_user_id uuid;
  v_caller_name text;
  v_existing_member_id uuid;
  v_matching_ghost_id uuid;
  v_clean_code text;
begin
  v_caller_user_id := auth.uid();
  if v_caller_user_id is null then
    raise exception 'Unauthorized: caller must be authenticated';
  end if;

  v_clean_code := trim(upper(p_invite_code));

  -- Flexible search:
  -- 1. Exact match (e.g. 'ROOM-E4KL' or 'INDORE')
  -- 2. With 'ROOM-' prefix added (e.g. user entered 'E4KL')
  -- 3. Without hyphens (e.g. 'ROOME4KL' matching 'ROOM-E4KL')
  -- 4. Suffix match (e.g. ending in '-E4KL')
  select id into v_group_id
  from public.groups
  where invite_code = v_clean_code
     or invite_code = 'ROOM-' || v_clean_code
     or replace(invite_code, '-', '') = replace(v_clean_code, '-', '')
     or invite_code like '%-' || v_clean_code
  limit 1;

  if v_group_id is null then
    raise exception 'Invalid invite code: %', p_invite_code;
  end if;

  -- 1. Check if user already has an active member row in this group
  select id into v_existing_member_id
  from public.members
  where group_id = v_group_id and user_id = v_caller_user_id;

  if v_existing_member_id is not null then
    return v_group_id; -- Already a member
  end if;

  -- 2. If an explicit claim_member_id is passed
  if p_claim_member_id is not null then
    update public.members
    set user_id = v_caller_user_id
    where id = p_claim_member_id
      and group_id = v_group_id
      and user_id is null;

    if found then
      return v_group_id;
    end if;
  end if;

  -- 3. Auto-claim: Check if an unclaimed ghost member exists with the caller's display_name
  select coalesce(display_name, 'Member') into v_caller_name
  from public.profiles
  where id = v_caller_user_id;

  select id into v_matching_ghost_id
  from public.members
  where group_id = v_group_id
    and user_id is null
    and lower(trim(display_name)) = lower(trim(v_caller_name))
  limit 1;

  if v_matching_ghost_id is not null then
    update public.members
    set user_id = v_caller_user_id
    where id = v_matching_ghost_id;

    return v_group_id;
  end if;

  -- 4. Otherwise, insert new member row
  insert into public.members (group_id, user_id, display_name, role)
  values (v_group_id, v_caller_user_id, coalesce(v_caller_name, 'Member'), 'member');

  return v_group_id;
end;
$$;
