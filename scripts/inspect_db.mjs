import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'members';
  `);
  console.log('MEMBERS COLS:', cols.rows);
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  `);
  console.log('PUBLIC TABLES:', tables.rows.map(r => r.tablename));
  const counts = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM auth.users) as auth_users_count,
      (SELECT COUNT(*) FROM profiles) as profiles_count,
      (SELECT COUNT(*) FROM groups) as groups_count,
      (SELECT COUNT(*) FROM members) as members_count,
      (SELECT COUNT(*) FROM expenses) as expenses_count,
      (SELECT COUNT(*) FROM expense_splits) as splits_count,
      (SELECT COUNT(*) FROM settlements) as settlements_count;
  `);
  console.log('COUNTS:', counts.rows[0]);
  await client.end();
}
run().catch(console.error);
