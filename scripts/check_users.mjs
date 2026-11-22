import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const users = await client.query("SELECT id, email, created_at, email_confirmed_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC LIMIT 10;");
  console.log("USERS:", users.rows);

  const profiles = await client.query("SELECT * FROM public.profiles;");
  console.log("PROFILES:", profiles.rows);

  await client.end();
}
run().catch(console.error);
