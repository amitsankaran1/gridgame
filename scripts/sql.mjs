// Ad-hoc SQL runner. There is no psql on this machine, and using `pg` here means
// the migration and the checks go through the exact driver the app uses.
//   node --env-file=.env.local scripts/sql.mjs "select 1"
//   node --env-file=.env.local scripts/sql.mjs --file supabase/migrations/0001_init.sql
import { readFileSync } from "node:fs";
import { Client } from "pg";

const args = process.argv.slice(2);
const sql =
  args[0] === "--file" ? readFileSync(args[1], "utf8") : args.join(" ");
if (!sql.trim()) {
  console.error("nothing to run");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: /@(localhost|127\.0\.0\.1)/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});
await client.connect();
try {
  const result = await client.query(sql);
  for (const r of Array.isArray(result) ? result : [result]) {
    if (r.rows?.length) console.table(r.rows);
    else console.log(`${r.command ?? "ok"} ${r.rowCount ?? ""}`.trim());
  }
} finally {
  await client.end();
}
