import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query(`
    -- 1. Ensure security columns on profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_question text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_answer text;

    -- 2. Create remove_member function
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
      v_member_user_id uuid;
      v_total_members int;
      v_expenses_paid_count int;
      v_splits_count int;
      v_settlements_count int;
      v_total_tx_count int;
    BEGIN
      v_caller_user_id := auth.uid();
      IF v_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: must be logged in';
      END IF;

      -- Get target member info
      SELECT group_id, display_name, user_id
      INTO v_group_id, v_member_name, v_member_user_id
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
        RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the last roommate of the flat');
      END IF;

      -- Count transactions
      SELECT COUNT(*) INTO v_expenses_paid_count
      FROM public.expenses
      WHERE paid_by_member_id = p_member_id AND deleted_at IS NULL;

      SELECT COUNT(*) INTO v_splits_count
      FROM public.expense_splits es
      JOIN public.expenses e ON e.id = es.expense_id
      WHERE es.member_id = p_member_id AND e.deleted_at IS NULL;

      SELECT COUNT(*) INTO v_settlements_count
      FROM public.settlements
      WHERE (from_member_id = p_member_id OR to_member_id = p_member_id)
        AND deleted_at IS NULL;

      v_total_tx_count := v_expenses_paid_count + v_splits_count + v_settlements_count;

      -- Case 1: Member has no active transactions -> Clean delete
      IF v_total_tx_count = 0 THEN
        DELETE FROM public.expense_splits WHERE member_id = p_member_id;
        DELETE FROM public.expenses WHERE paid_by_member_id = p_member_id;
        DELETE FROM public.settlements WHERE from_member_id = p_member_id OR to_member_id = p_member_id;
        DELETE FROM public.members WHERE id = p_member_id;
        RETURN jsonb_build_object('success', true, 'action', 'deleted', 'name', v_member_name);
      END IF;

      -- Case 2: Member has transactions but force is false
      IF NOT p_force THEN
        RETURN jsonb_build_object(
          'success', false,
          'has_transactions', true,
          'tx_count', v_total_tx_count,
          'expenses_paid', v_expenses_paid_count,
          'splits_count', v_splits_count,
          'name', v_member_name,
          'error', v_member_name || ' has ' || v_total_tx_count || ' transaction(s). Confirm removal to clear debts.'
        );
      END IF;

      -- Case 3: Force remove -> Clean up their participation
      DELETE FROM public.settlements WHERE from_member_id = p_member_id OR to_member_id = p_member_id;
      DELETE FROM public.expense_splits WHERE member_id = p_member_id;
      UPDATE public.expenses SET deleted_at = now() WHERE paid_by_member_id = p_member_id AND deleted_at IS NULL;
      DELETE FROM public.members WHERE id = p_member_id;

      RETURN jsonb_build_object('success', true, 'action', 'force_removed', 'name', v_member_name);
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.remove_member(uuid, boolean) TO authenticated, anon;

    -- 3. Security Question Lookup RPC
    CREATE OR REPLACE FUNCTION public.get_security_question(p_phone text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $$
    DECLARE
      v_clean_phone text;
      v_question text;
    BEGIN
      v_clean_phone := regexp_replace(p_phone, '\\D', '', 'g');
      IF length(v_clean_phone) = 12 AND v_clean_phone LIKE '91%' THEN
        v_clean_phone := substr(v_clean_phone, 3);
      END IF;

      SELECT security_question INTO v_question
      FROM public.profiles
      WHERE phone = v_clean_phone
         OR phone = '+91' || v_clean_phone
         OR phone = '91' || v_clean_phone
         OR phone = '+91' || substr(v_clean_phone, 1)
      LIMIT 1;

      IF v_question IS NULL THEN
        RETURN jsonb_build_object('found', false, 'message', 'Security question not found for this mobile number.');
      END IF;

      RETURN jsonb_build_object('found', true, 'question', v_question);
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.get_security_question(text) TO authenticated, anon;

    -- 4. PIN Reset with Security Answer RPC
    CREATE OR REPLACE FUNCTION public.reset_pin_with_security_answer(
      p_phone text,
      p_answer text,
      p_new_pin text
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth, extensions
    AS $$
    DECLARE
      v_clean_phone text;
      v_user_id uuid;
      v_stored_answer text;
      v_synthetic_email text;
    BEGIN
      v_clean_phone := regexp_replace(p_phone, '\\D', '', 'g');
      IF length(v_clean_phone) = 12 AND v_clean_phone LIKE '91%' THEN
        v_clean_phone := substr(v_clean_phone, 3);
      END IF;

      IF length(v_clean_phone) <> 10 THEN
        RETURN jsonb_build_object('success', false, 'message', '10-digit mobile number enter karein');
      END IF;

      IF length(p_new_pin) <> 6 OR p_new_pin !~ '^\\d{6}$' THEN
        RETURN jsonb_build_object('success', false, 'message', 'New PIN exactly 6 digits ka hona chahiye');
      END IF;

      SELECT id, security_answer INTO v_user_id, v_stored_answer
      FROM public.profiles
      WHERE phone = v_clean_phone
         OR phone = '+91' || v_clean_phone
         OR phone = '91' || v_clean_phone
      LIMIT 1;

      IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Is number ka koi account nahi mila');
      END IF;

      IF v_stored_answer IS NULL OR lower(trim(v_stored_answer)) <> lower(trim(p_answer)) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Galat answer! Kripya sahi security answer dalein.');
      END IF;

      -- Update password in auth.users
      v_synthetic_email := 'phone_' || v_clean_phone || '@roommate.app';
      UPDATE auth.users
      SET encrypted_password = crypt(p_new_pin, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_user_id;

      RETURN jsonb_build_object('success', true, 'message', 'PIN successfully reset ho gaya! Ab naye PIN se login karein.');
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.reset_pin_with_security_answer(text, text, text) TO authenticated, anon;
  `);

  console.log('Database functions and security columns configured successfully!');
  await client.end();
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
