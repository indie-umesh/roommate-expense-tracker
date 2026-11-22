import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function fix() {
  await client.connect();
  await client.query(`
    UPDATE expense_splits
    SET share_paise = 25000
    WHERE expense_id = 'cc02f4b4-0536-4716-9a34-08aac75b04fb';
  `);
  console.log('Fixed split discrepancy successfully!');
  await client.end();
}
fix().catch(console.error);
