import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();

  // Test inserting into groups as authenticated user
  const res = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity 
    FROM pg_class 
    WHERE relname = 'groups';
  `);
  console.log("GROUPS TABLE RLS FLAGS:", res.rows);

  const policies = await client.query(`
    SELECT * FROM pg_policies WHERE tablename = 'groups';
  `);
  console.log("ALL POLICIES ON GROUPS:", policies.rows);

  await client.end();
}
run().catch(console.error);
