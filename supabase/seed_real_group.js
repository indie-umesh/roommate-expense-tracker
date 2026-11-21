import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  try {
    await client.connect();
    console.log("Connected to Supabase Postgres. Seeding real roommate group...");

    // Check if group already exists
    const existingGroup = await client.query(
      "select id, name, invite_code from public.groups where name = 'Indore Flat' or invite_code = 'INDORE'"
    );

    let groupId;
    if (existingGroup.rows.length > 0) {
      groupId = existingGroup.rows[0].id;
      console.log(`Using existing group: ${existingGroup.rows[0].name} (Code: ${existingGroup.rows[0].invite_code})`);
    } else {
      const newGroup = await client.query(`
        insert into public.groups (name, invite_code)
        values ('Indore Flat', 'INDORE')
        returning id;
      `);
      groupId = newGroup.rows[0].id;
      console.log("Created 'Indore Flat' group with invite code: INDORE");
    }

    // Seed/Ensure the 3 roommates exist as members with paydays
    const membersToSeed = [
      { name: "Ritesh", payday: 1, role: "member" },
      { name: "Aman", payday: 5, role: "member" },
      { name: "Umesh", payday: 15, role: "admin" },
    ];

    for (const m of membersToSeed) {
      const existingMember = await client.query(
        "select id from public.members where group_id = $1 and display_name = $2",
        [groupId, m.name]
      );

      if (existingMember.rows.length === 0) {
        await client.query(`
          insert into public.members (group_id, display_name, role, payday_day)
          values ($1, $2, $3, $4)
        `, [groupId, m.name, m.role, m.payday]);
        console.log(`✓ Added member: ${m.name} (Payday: ${m.payday}th)`);
      } else {
        await client.query(`
          update public.members
          set payday_day = $1
          where id = $2
        `, [m.payday, existingMember.rows[0].id]);
        console.log(`✓ Updated payday for member: ${m.name} (${m.payday}th)`);
      }
    }

    console.log("\nRoommate group ready!");
    console.log("Group: Indore Flat");
    console.log("Invite code: INDORE");
    console.log("Members: Ritesh (1st), Aman (5th), Umesh (15th)");
  } catch (err) {
    console.error("Seed failed:", err);
  } finally {
    await client.end();
  }
}

seed();
