import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const groupId = "c7bbce93-c594-45eb-ae27-8768982bf9e0";
  const activeRitesh = "10b756a2-8c22-4175-8130-6608e27740f1";
  const ghostRitesh = "9a82a350-fb9f-4f9f-9a08-317f521a004a";

  await client.query("UPDATE public.expenses SET paid_by_member_id = $1 WHERE paid_by_member_id = $2", [activeRitesh, ghostRitesh]);
  await client.query("UPDATE public.settlements SET from_member_id = $1 WHERE from_member_id = $2", [activeRitesh, ghostRitesh]);
  await client.query("UPDATE public.settlements SET to_member_id = $1 WHERE to_member_id = $2", [activeRitesh, ghostRitesh]);
  await client.query("DELETE FROM public.expense_splits WHERE member_id = $1", [ghostRitesh]);
  await client.query("DELETE FROM public.members WHERE id = $1", [ghostRitesh]);

  console.log("Cleaned up duplicate member Ritesh successfully!");
  await client.end();
}

run().catch(console.error);
