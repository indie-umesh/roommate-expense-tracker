import pg from 'pg';
const client = new pg.Client({ connectionString: 'postgresql://postgres:-D8zk8DkPPzjk,r@db.jwmbpehhosqhcrgvyfeb.supabase.co:5432/postgres' });

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query(`
    CREATE TABLE IF NOT EXISTS group_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name text NOT NULL,
      emoji text NOT NULL DEFAULT '🧾',
      created_at timestamptz DEFAULT now(),
      UNIQUE(group_id, name)
    );

    ALTER TABLE group_categories ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_categories' AND policyname = 'Group members can manage categories'
      ) THEN
        CREATE POLICY "Group members can manage categories" 
        ON group_categories
        FOR ALL 
        USING (is_group_member(group_id)) 
        WITH CHECK (is_group_member(group_id));
      END IF;
    END
    $$;
  `);

  console.log('group_categories table and RLS policy configured successfully!');
  await client.end();
}

run().catch(console.error);
