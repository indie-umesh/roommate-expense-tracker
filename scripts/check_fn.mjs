import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const funcs = await client.query("SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('create_group', 'join_group');");
  console.log("FUNCS SECURITY DEFINER:", funcs.rows);

  const policies = await client.query("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('groups', 'members');");
  console.log("POLICIES:", JSON.stringify(policies.rows, null, 2));

  await client.end();
}
run().catch(console.error);
