import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();

  await client.query(`
    CREATE OR REPLACE FUNCTION public.auto_confirm_user()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

    CREATE TRIGGER on_auth_user_created_auto_confirm
      BEFORE INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_user();
  `);

  console.log("Auto-confirm trigger created successfully!");
  await client.end();
}
run().catch(console.error);
