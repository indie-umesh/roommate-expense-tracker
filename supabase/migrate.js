import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase Postgres database.");

    // Ensure migrations table exists
    await client.query(`
      create table if not exists public._schema_migrations (
        version text primary key,
        applied_at timestamptz default now()
      );
    `);

    // Fetch applied migrations
    const appliedRes = await client.query("select version from public._schema_migrations");
    const applied = new Set(appliedRes.rows.map((r) => r.version));

    // If 000001 was already applied before tracking table was created, mark it
    if (!applied.has("20261121000001_initial_schema.sql")) {
      const checkTables = await client.query(
        "select 1 from information_schema.tables where table_name = 'profiles'"
      );
      if (checkTables.rows.length > 0) {
        await client.query(
          "insert into public._schema_migrations (version) values ('20261121000001_initial_schema.sql') on conflict do nothing"
        );
        applied.add("20261121000001_initial_schema.sql");
      }
    }

    const migrationsDir = path.resolve("supabase/migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
      await client.query(
        "insert into public._schema_migrations (version) values ($1)",
        [file]
      );
      console.log(`Migration ${file} applied successfully.`);
    }

    console.log("All pending migrations executed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
