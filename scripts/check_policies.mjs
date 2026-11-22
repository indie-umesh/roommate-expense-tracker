import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const policies = await client.query("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'groups';");
  console.log("POLICIES ON GROUPS:\n", JSON.stringify(policies.rows, null, 2));

  // Check create_group function definition
  const func = await client.query(`SELECT prosrc FROM pg_proc WHERE proname = 'create_group';`);
  console.log("create_group func:\n", func.rows[0]?.prosrc);

  await client.end();
}
run().catch(console.error);
