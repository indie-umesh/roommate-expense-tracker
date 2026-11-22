import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const groupId = '6ba81de6-91e2-4f49-8a12-4524da7f9250';
  await client.query('DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = $1);', [groupId]);
  await client.query('DELETE FROM expenses WHERE group_id = $1;', [groupId]);
  await client.query('DELETE FROM settlements WHERE group_id = $1;', [groupId]);
  await client.query('DELETE FROM members WHERE group_id = $1;', [groupId]);
  await client.query('DELETE FROM groups WHERE id = $1;', [groupId]);
  console.log('Cleaned up test group aa successfully!');
  await client.end();
}
run().catch(console.error);
