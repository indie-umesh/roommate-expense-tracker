import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function clearDatabase() {
  console.log("Connecting to Supabase PostgreSQL database...");
  await client.connect();

  console.log("\n--- Checking Current Data Counts Before Purge ---");
  const tables = [
    "public.expense_splits",
    "public.expense_audit",
    "public.expenses",
    "public.settlements",
    "public.checkpoints",
    "public.members",
    "public.groups",
    "public.suggestions",
    "public.profiles",
    "auth.users"
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`  ${table.padEnd(25)}: ${res.rows[0].cnt} records`);
    } catch (e) {
      console.log(`  ${table.padEnd(25)}: [Table check error: ${e.message}]`);
    }
  }

  console.log("\n--- Purging All Data (Fresh Live Testing Setup) ---");

  // Disable triggers temporarily if needed, or truncate with CASCADE
  await client.query(`
    TRUNCATE TABLE 
      public.expense_splits,
      public.expense_audit,
      public.expenses,
      public.settlements,
      public.checkpoints,
      public.members,
      public.groups,
      public.suggestions,
      public.profiles
    CASCADE;
  `);

  try {
    const deletedUsers = await client.query(`DELETE FROM auth.users;`);
    console.log(`  auth.users purged successfully (${deletedUsers.rowCount || 0} users deleted)`);
  } catch (e) {
    console.log(`  auth.users deletion note: ${e.message}`);
  }

  console.log("\n--- Verifying Data After Purge ---");
  let allClean = true;
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      const count = parseInt(res.rows[0].cnt, 10);
      console.log(`  ${table.padEnd(25)}: ${count} records remaining`);
      if (count !== 0) allClean = false;
    } catch (e) {
      console.log(`  ${table.padEnd(25)}: [Check error: ${e.message}]`);
    }
  }

  await client.end();

  if (allClean) {
    console.log("\nDatabase completely wiped! 100% clean slate ready for fresh live testing.");
  } else {
    console.log("\nDatabase wipe completed with some non-zero counts above.");
  }
}

clearDatabase().catch((err) => {
  console.error("Fatal error during database purge:", err);
  process.exit(1);
});
