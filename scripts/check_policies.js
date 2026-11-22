const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const policies = await client.query("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies;");
  console.log("POLICIES:\n", JSON.stringify(policies.rows, null, 2));
  await client.end();
}
run().catch(console.error);
