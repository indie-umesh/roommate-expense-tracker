-- Schema for Roommate Expense Tracker (Phase 1)
-- Strict integer paise (bigint), RLS on every table, security definer RPCs

create extension if not exists "pgcrypto";

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text not null,
  created_at timestamptz default now() not null
);

-- 2. Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 3. Members
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('admin', 'member')) default 'member',
  payday_day smallint check (payday_day between 1 and 31),
  created_at timestamptz default now() not null,
  constraint uq_group_user unique (group_id, user_id)
);

-- 4. Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  paid_by_member_id uuid not null references public.members(id),
  amount_paise bigint not null check (amount_paise > 0),
  details text not null,
  spent_on date default current_date not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz null,
  created_at timestamptz default now() not null
);

-- 5. Expense Splits
create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id),
  share_paise bigint not null check (share_paise >= 0),
  created_at timestamptz default now() not null,
  primary key (expense_id, member_id)
);

-- 6. Settlements
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_member_id uuid not null references public.members(id),
  to_member_id uuid not null references public.members(id),
  amount_paise bigint not null check (amount_paise > 0),
  settled_on date default current_date not null,
  note text null,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz null,
  created_at timestamptz default now() not null
);

-- 7. Checkpoints
create table if not exists public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  note text null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 8. Expense Audit
create table if not exists public.expense_audit (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  group_id uuid not null,
  action text not null, -- 'UPDATE' or 'SOFT_DELETE'
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Enable RLS on every table
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.checkpoints enable row level security;
alter table public.expense_audit enable row level security;

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER)
--------------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$;

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

-- Profiles: Users can view their own profile and profiles of members in mutual groups
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- Groups: Members can view the groups they belong to
create policy "Members can view their groups"
  on public.groups for select
  using (public.is_group_member(id));

create policy "Users can create groups"
  on public.groups for insert
  with check (auth.uid() is not null);

-- Members: Accessible only if caller is in the group
create policy "Members can view group members"
  on public.members for select
  using (public.is_group_member(group_id));

create policy "Group members can add ghost members"
  on public.members for insert
  with check (
    public.is_group_member(group_id)
    or user_id = auth.uid()
  );

create policy "Group members can update member records"
  on public.members for update
  using (public.is_group_member(group_id));

-- Expenses: Group members only
create policy "Members can view expenses"
  on public.expenses for select
  using (public.is_group_member(group_id));

create policy "Members can insert expenses"
  on public.expenses for insert
  with check (public.is_group_member(group_id));

create policy "Members can update expenses"
  on public.expenses for update
  using (public.is_group_member(group_id));

-- Expense Splits: Accessible via parent expense's group
create policy "Members can view expense splits"
  on public.expense_splits for select
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_group_member(e.group_id)
    )
  );

create policy "Members can insert expense splits"
  on public.expense_splits for insert
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_group_member(e.group_id)
    )
  );

create policy "Members can delete expense splits"
  on public.expense_splits for delete
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_group_member(e.group_id)
    )
  );

-- Settlements: Group members only
create policy "Members can view settlements"
  on public.settlements for select
  using (public.is_group_member(group_id));

create policy "Members can insert settlements"
  on public.settlements for insert
  with check (public.is_group_member(group_id));

create policy "Members can update settlements"
  on public.settlements for update
  using (public.is_group_member(group_id));

-- Checkpoints: Group members only
create policy "Members can view checkpoints"
  on public.checkpoints for select
  using (public.is_group_member(group_id));

create policy "Members can insert checkpoints"
  on public.checkpoints for insert
  with check (public.is_group_member(group_id));

-- Audit: Group members only
create policy "Members can view audit logs"
  on public.expense_audit for select
  using (public.is_group_member(group_id));

--------------------------------------------------------------------------------
-- VIEWS: member_balances
--------------------------------------------------------------------------------

create or replace view public.member_balances as
with paid_expenses as (
  select
    paid_by_member_id as member_id,
    group_id,
    coalesce(sum(amount_paise), 0)::bigint as total_paid_paise
  from public.expenses
  where deleted_at is null
  group by paid_by_member_id, group_id
),
owed_expenses as (
  select
    s.member_id,
    e.group_id,
    coalesce(sum(s.share_paise), 0)::bigint as total_share_paise
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.deleted_at is null
  group by s.member_id, e.group_id
),
settlements_sent as (
  select
    from_member_id as member_id,
    group_id,
    coalesce(sum(amount_paise), 0)::bigint as total_settled_out_paise
  from public.settlements
  where deleted_at is null
  group by from_member_id, group_id
),
settlements_received as (
  select
    to_member_id as member_id,
    group_id,
    coalesce(sum(amount_paise), 0)::bigint as total_settled_in_paise
  from public.settlements
  where deleted_at is null
  group by to_member_id, group_id
)
select
  m.id as member_id,
  m.group_id,
  m.user_id,
  m.display_name,
  coalesce(pe.total_paid_paise, 0)::bigint as total_paid_paise,
  coalesce(oe.total_share_paise, 0)::bigint as total_share_paise,
  coalesce(ss.total_settled_out_paise, 0)::bigint as total_settled_out_paise,
  coalesce(sr.total_settled_in_paise, 0)::bigint as total_settled_in_paise,
  (
    coalesce(pe.total_paid_paise, 0)
    - coalesce(oe.total_share_paise, 0)
    + coalesce(ss.total_settled_out_paise, 0)
    - coalesce(sr.total_settled_in_paise, 0)
  )::bigint as net_paise
from public.members m
left join paid_expenses pe on pe.member_id = m.id
left join owed_expenses oe on oe.member_id = m.id
left join settlements_sent ss on ss.member_id = m.id
left join settlements_received sr on sr.member_id = m.id;

--------------------------------------------------------------------------------
-- RPC FUNCTIONS (SECURITY DEFINER)
--------------------------------------------------------------------------------

-- Create Expense with Equal Split atomically
create or replace function public.create_expense(
  p_group_id uuid,
  p_paid_by_member_id uuid,
  p_amount_paise bigint,
  p_details text,
  p_spent_on date,
  p_participant_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_expense_id uuid;
  v_num_participants int;
  v_base_share bigint;
  v_remainder bigint;
  v_idx int;
  v_sorted_ids uuid[];
  v_share bigint;
  v_member_id uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Unauthorized: caller is not a member of this group';
  end if;

  if p_amount_paise <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_num_participants := array_length(p_participant_member_ids, 1);
  if v_num_participants is null or v_num_participants = 0 then
    raise exception 'Must specify at least one participant';
  end if;

  -- Insert expense record
  insert into public.expenses (
    group_id,
    paid_by_member_id,
    amount_paise,
    details,
    spent_on,
    created_by
  ) values (
    p_group_id,
    p_paid_by_member_id,
    p_amount_paise,
    p_details,
    coalesce(p_spent_on, current_date),
    auth.uid()
  ) returning id into v_expense_id;

  -- Deterministically sort participant member IDs
  select array_agg(m_id order by m_id)
  into v_sorted_ids
  from unnest(p_participant_member_ids) as m_id;

  v_base_share := p_amount_paise / v_num_participants;
  v_remainder := p_amount_paise % v_num_participants;

  v_idx := 0;
  foreach v_member_id in array v_sorted_ids loop
    if v_idx < v_remainder then
      v_share := v_base_share + 1;
    else
      v_share := v_base_share;
    end if;

    insert into public.expense_splits (expense_id, member_id, share_paise)
    values (v_expense_id, v_member_id, v_share);

    v_idx := v_idx + 1;
  end loop;

  return v_expense_id;
end;
$$;

-- Update Expense with Equal Split atomically
create or replace function public.update_expense(
  p_expense_id uuid,
  p_paid_by_member_id uuid,
  p_amount_paise bigint,
  p_details text,
  p_spent_on date,
  p_participant_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_group_id uuid;
  v_num_participants int;
  v_base_share bigint;
  v_remainder bigint;
  v_idx int;
  v_sorted_ids uuid[];
  v_share bigint;
  v_member_id uuid;
begin
  select group_id into v_group_id
  from public.expenses
  where id = p_expense_id and deleted_at is null;

  if v_group_id is null then
    raise exception 'Expense not found or already deleted';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Unauthorized';
  end if;

  if p_amount_paise <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_num_participants := array_length(p_participant_member_ids, 1);
  if v_num_participants is null or v_num_participants = 0 then
    raise exception 'Must specify at least one participant';
  end if;

  -- Update expense
  update public.expenses
  set paid_by_member_id = p_paid_by_member_id,
      amount_paise = p_amount_paise,
      details = p_details,
      spent_on = coalesce(p_spent_on, spent_on),
      updated_at = now()
  where id = p_expense_id;

  -- Delete existing splits and recreate
  delete from public.expense_splits where expense_id = p_expense_id;

  select array_agg(m_id order by m_id)
  into v_sorted_ids
  from unnest(p_participant_member_ids) as m_id;

  v_base_share := p_amount_paise / v_num_participants;
  v_remainder := p_amount_paise % v_num_participants;

  v_idx := 0;
  foreach v_member_id in array v_sorted_ids loop
    if v_idx < v_remainder then
      v_share := v_base_share + 1;
    else
      v_share := v_base_share;
    end if;

    insert into public.expense_splits (expense_id, member_id, share_paise)
    values (p_expense_id, v_member_id, v_share);

    v_idx := v_idx + 1;
  end loop;
end;
$$;

-- Join group via invite code (and optionally claim a ghost member)
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
begin
  v_caller_user_id := auth.uid();
  if v_caller_user_id is null then
    raise exception 'Unauthorized: caller must be authenticated';
  end if;

  -- Look up group by invite code (never exposing entire groups list to anon/non-members)
  select id into v_group_id
  from public.groups
  where invite_code = trim(p_invite_code);

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Check if user is already a member
  select id into v_existing_member_id
  from public.members
  where group_id = v_group_id and user_id = v_caller_user_id;

  if v_existing_member_id is not null then
    return v_group_id; -- Already a member
  end if;

  -- If claiming a ghost member
  if p_claim_member_id is not null then
    update public.members
    set user_id = v_caller_user_id
    where id = p_claim_member_id
      and group_id = v_group_id
      and user_id is null;

    if not found then
      raise exception 'Ghost member not found or already claimed';
    end if;
  else
    -- Fetch caller display name
    select coalesce(display_name, 'Member') into v_caller_name
    from public.profiles
    where id = v_caller_user_id;

    insert into public.members (group_id, user_id, display_name, role)
    values (v_group_id, v_caller_user_id, coalesce(v_caller_name, 'Member'), 'member');
  end if;

  return v_group_id;
end;
$$;
