import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const trigs = await client.query(`
    SELECT event_object_table, trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_table IN ('users', 'profiles');
  `);
  console.log("TRIGGERS:", trigs.rows);

  const funcs = await client.query(`
    SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%user%' OR proname LIKE '%profile%';
  `);
  console.log("USER/PROFILE FUNCS:", funcs.rows);

  await client.end();
}
run().catch(console.error);
