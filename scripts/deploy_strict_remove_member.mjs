import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query(`
    CREATE OR REPLACE FUNCTION public.remove_member(
      p_member_id uuid,
      p_force boolean DEFAULT false
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $$
    DECLARE
      v_caller_user_id uuid;
      v_group_id uuid;
      v_member_name text;
      v_total_members int;
      v_expenses_paid_count int;
      v_splits_count int;
    BEGIN
      v_caller_user_id := auth.uid();
      IF v_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: must be logged in';
      END IF;

      -- Get target member info
      SELECT group_id, display_name
      INTO v_group_id, v_member_name
      FROM public.members
      WHERE id = p_member_id;

      IF v_group_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Member not found');
      END IF;

      -- Verify caller belongs to the same group
      IF NOT EXISTS (
        SELECT 1 FROM public.members
        WHERE group_id = v_group_id AND user_id = v_caller_user_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not a member of this flat');
      END IF;

      -- Check total member count
      SELECT COUNT(*) INTO v_total_members
      FROM public.members
      WHERE group_id = v_group_id;

      IF v_total_members <= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Flat me kam se kam 1 roommate hona zaroori hai.');
      END IF;

      -- Check if they are payer of any active expense
      SELECT COUNT(*) INTO v_expenses_paid_count
      FROM public.expenses
      WHERE paid_by_member_id = p_member_id AND deleted_at IS NULL;

      -- Check if they are in any active expense splits
      SELECT COUNT(*) INTO v_splits_count
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
      WHERE es.member_id = p_member_id AND e.deleted_at IS NULL;

      -- STRICT RULE: Jab tak poora hisaab settle na ho, koi delete nahi ho sakta!
      IF v_expenses_paid_count > 0 OR v_splits_count > 0 THEN
        RETURN jsonb_build_object(
          'success', false,
          'is_locked', true,
          'error', v_member_name || ' remove nahi ho sakte: Inka account settle nahi hai. Pehle hisaab settle (₹0) karein ya bills clear karein.'
        );
      END IF;

      -- Safe clean delete for zero-balance / unused member
      DELETE FROM public.settlements WHERE from_member_id = p_member_id OR to_member_id = p_member_id;
      DELETE FROM public.members WHERE id = p_member_id;

      RETURN jsonb_build_object('success', true, 'action', 'deleted', 'name', v_member_name);
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.remove_member(uuid, boolean) TO authenticated, anon;
  `);

  console.log('Strict remove_member RPC deployed successfully.');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
