-- Update create_group with clean, standardized ROOM-XXXX invite codes

create or replace function public.generate_clean_invite_code()
returns text
language plpgsql
as $$
declare
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_exists boolean;
  i int;
begin
  loop
    v_code := 'ROOM-';
    for i in 1..4 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    select exists(select 1 from public.groups where invite_code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

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
    v_code := public.generate_clean_invite_code();
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
