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

async function runTests() {
  try {
    await client.connect();
    console.log("Connected to DB. Beginning RLS isolation verification tests...\n");

    const user1Id = "11111111-1111-1111-1111-111111111111";
    const user2Id = "22222222-2222-2222-2222-222222222222";

    // Clean up test artifacts if any
    await client.query("begin");

    // 1. Setup mock profiles for user1 and user2
    await client.query(`
      insert into auth.users (id, email)
      values ('${user1Id}', 'test1@example.com'), ('${user2Id}', 'test2@example.com')
      on conflict (id) do nothing;
    `);

    await client.query(`
      insert into public.profiles (id, phone, display_name)
      values ('${user1Id}', '+919999900001', 'Umesh Test'),
             ('${user2Id}', '+919999900002', 'Aman Test')
      on conflict (id) do nothing;
    `);

    // 2. User 1 creates Group 1 and Member 1
    const groupRes = await client.query(`
      insert into public.groups (name, invite_code, created_by)
      values ('Test Apartment 101', 'INVITE-TEST-99', '${user1Id}')
      returning id;
    `);
    const groupId = groupRes.rows[0].id;

    const member1Res = await client.query(`
      insert into public.members (group_id, user_id, display_name, role)
      values ('${groupId}', '${user1Id}', 'Umesh Test', 'admin')
      returning id;
    `);
    const member1Id = member1Res.rows[0].id;

    // User 1 adds an expense
    await client.query(`
      select set_config('request.jwt.claim.sub', '${user1Id}', true);
      select set_config('role', 'authenticated', true);
    `);

    const expIdRes = await client.query(`
      select public.create_expense(
        '${groupId}'::uuid,
        '${member1Id}'::uuid,
        30000::bigint,
        'Groceries & Milk',
        current_date,
        array['${member1Id}'::uuid]
      ) as id;
    `);
    const expenseId = expIdRes.rows[0].id;
    console.log("✓ User 1 created group and expense:", expenseId);

    // 3. User 2 (not a member) checks access to Group 1
    await client.query(`
      select set_config('request.jwt.claim.sub', '${user2Id}', true);
      select set_config('role', 'authenticated', true);
    `);

    const user2Expenses = await client.query(`
      select * from public.expenses where group_id = '${groupId}';
    `);
    if (user2Expenses.rows.length !== 0) {
      throw new Error(`RLS breach: User 2 saw ${user2Expenses.rows.length} expenses from group 1!`);
    }
    console.log("✓ User 2 sees 0 expenses from Group 1 (RLS enforced)");

    const user2Members = await client.query(`
      select * from public.members where group_id = '${groupId}';
    `);
    if (user2Members.rows.length !== 0) {
      throw new Error(`RLS breach: User 2 saw members from group 1!`);
    }
    console.log("✓ User 2 sees 0 members from Group 1 (RLS enforced)");

    // User 2 attempts unauthorized write to Group 1 with SAVEPOINT
    await client.query("savepoint sp_unauth");
    let writeBlocked = false;
    try {
      await client.query(`
        select public.create_expense(
          '${groupId}'::uuid,
          '${member1Id}'::uuid,
          5000::bigint,
          'Hacked expense',
          current_date,
          array['${member1Id}'::uuid]
        );
      `);
    } catch {
      writeBlocked = true;
      await client.query("rollback to savepoint sp_unauth");
    }
    if (!writeBlocked) {
      throw new Error("RLS breach: User 2 was able to write an expense to Group 1!");
    }
    console.log("✓ User 2 unauthorized expense insertion was blocked by RLS/RPC");

    // 4. User 2 joins Group 1 via invite code
    const joinedGroupIdRes = await client.query(`
      select public.join_group('INVITE-TEST-99') as id;
    `);
    const joinedGroupId = joinedGroupIdRes.rows[0].id;
    if (joinedGroupId !== groupId) {
      throw new Error("Failed to join group with invite code");
    }
    console.log("✓ User 2 joined Group 1 via invite code");

    // 5. Now User 2 can view Group 1 expenses and members
    const user2ExpensesAfterJoin = await client.query(`
      select * from public.expenses where group_id = '${groupId}';
    `);
    if (user2ExpensesAfterJoin.rows.length !== 1) {
      throw new Error(`User 2 should see 1 expense after joining, saw ${user2ExpensesAfterJoin.rows.length}`);
    }
    console.log("✓ User 2 successfully sees Group 1 expenses after joining");

    // Rollback test changes to leave database clean
    await client.query("rollback");
    console.log("\nAll RLS isolation and security verification tests passed successfully!");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
