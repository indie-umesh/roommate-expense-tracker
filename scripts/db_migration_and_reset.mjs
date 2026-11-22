import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // 1. Add columns to members if not exist
  await client.query(`
    ALTER TABLE members ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS upi_id text;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS notes text;
  `);
  console.log('Added phone, upi_id, notes columns to members table.');

  // 2. Add RLS DELETE policy on members if not exists
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'members' AND policyname = 'Group members can delete member records'
      ) THEN
        CREATE POLICY "Group members can delete member records" 
        ON members FOR DELETE 
        USING (is_group_member(group_id));
      END IF;
    END
    $$;
  `);
  console.log('Created DELETE policy on members table.');

  // 3. Create or replace atomic remove_member RPC
  await client.query(`
    CREATE OR REPLACE FUNCTION remove_member(p_member_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_group_id uuid;
      v_is_caller_member boolean;
      v_expense_count int;
      v_split_count int;
      v_settlement_count int;
      v_member_name text;
    BEGIN
      -- Check target member exists
      SELECT group_id, display_name INTO v_group_id, v_member_name
      FROM members
      WHERE id = p_member_id;

      IF v_group_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Member not found');
      END IF;

      -- Check caller is part of this group
      SELECT is_group_member(v_group_id) INTO v_is_caller_member;
      IF NOT v_is_caller_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not in this group');
      END IF;

      -- Check if member has active paid expenses
      SELECT COUNT(*) INTO v_expense_count
      FROM expenses
      WHERE paid_by_member_id = p_member_id AND deleted_at IS NULL;

      IF v_expense_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot delete ' || v_member_name || ': They have ' || v_expense_count || ' active expense(s) logged as payer. Delete or reassign those expenses first.');
      END IF;

      -- Check if member has active splits
      SELECT COUNT(*) INTO v_split_count
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE es.member_id = p_member_id AND e.deleted_at IS NULL;

      IF v_split_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot delete ' || v_member_name || ': They are included in ' || v_split_count || ' active expense split(s). Remove them from those splits first.');
      END IF;

      -- Check settlements
      SELECT COUNT(*) INTO v_settlement_count
      FROM settlements
      WHERE from_member_id = p_member_id OR to_member_id = p_member_id;

      IF v_settlement_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot delete ' || v_member_name || ': They have recorded settlements.');
      END IF;

      -- Delete member
      DELETE FROM members WHERE id = p_member_id;

      RETURN jsonb_build_object('success', true, 'message', 'Roommate removed successfully');
    END;
    $$;
  `);
  console.log('Created remove_member RPC.');

  // 4. Wipe DB data completely as requested: "fresh start krenge saara db clear krdo"
  await client.query('DELETE FROM expense_audit;');
  await client.query('DELETE FROM expense_splits;');
  await client.query('DELETE FROM expenses;');
  await client.query('DELETE FROM settlements;');
  await client.query('DELETE FROM checkpoints;');
  await client.query('DELETE FROM members;');
  await client.query('DELETE FROM groups;');
  await client.query('DELETE FROM profiles;');
  await client.query('DELETE FROM auth.users;');

  console.log('Successfully wiped all tables for a completely fresh start!');

  // Check counts
  const counts = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM auth.users) as auth_users_count,
      (SELECT COUNT(*) FROM profiles) as profiles_count,
      (SELECT COUNT(*) FROM groups) as groups_count,
      (SELECT COUNT(*) FROM members) as members_count,
      (SELECT COUNT(*) FROM expenses) as expenses_count;
  `);
  console.log('CLEARED COUNTS:', counts.rows[0]);

  await client.end();
}

run().catch(console.error);
