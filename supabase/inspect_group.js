import pg from "pg";

const client = new pg.Client({
  connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const gId = '6ba81de6-91e2-4f49-8a12-4524da7f9250';
  const grp = await client.query('SELECT * FROM groups WHERE id = $1', [gId]);
  console.log('Group:', grp.rows);
  const mems = await client.query('SELECT * FROM members WHERE group_id = $1', [gId]);
  console.log('Members:', mems.rows);
  const exps = await client.query('SELECT * FROM expenses WHERE group_id = $1', [gId]);
  console.log('Expenses:', exps.rows);
  const splits = await client.query('SELECT * FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = $1)', [gId]);
  console.log('Splits:', splits.rows);
  await client.end();
}

run().catch(console.error);
