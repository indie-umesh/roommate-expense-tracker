export interface Profile {
  id: string;
  phone: string | null;
  display_name: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  role: "admin" | "member";
  payday_day: number | null;
  created_at: string;
}

export interface ExpenseSplit {
  expense_id: string;
  member_id: string;
  share_paise: bigint;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  amount_paise: bigint;
  details: string;
  spent_on: string;
  created_by: string;
  updated_at: string;
  deleted_at: string | null;
  created_at: string;
  splits?: ExpenseSplit[];
}

export interface Settlement {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_paise: bigint;
  settled_on: string;
  note: string | null;
  created_by: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  group_id: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface MemberBalanceView {
  member_id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  total_paid_paise: bigint;
  total_share_paise: bigint;
  total_settled_out_paise: bigint;
  total_settled_in_paise: bigint;
  net_paise: bigint;
}
