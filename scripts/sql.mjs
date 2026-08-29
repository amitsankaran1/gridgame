// Ad-hoc SQL runner. There is no psql on this machine, and using `pg` here means
// the migration and the checks go through the exact driver the app uses.
//   node --env-file=.env.local scripts/sql.mjs "select 1"
//   node --env-file=.env.local scripts/sql.mjs --file supabase/migrations/0001_init.sql
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const args = process.argv.slice(2);

/**
 * --dir runs every .sql file in a directory in filename order, which is what
 * `npm run migrate` uses. It used to name 0001_init.sql directly, so adding
 * 0002 silently did nothing on anyone's database until they noticed.
 * Every migration is written to be re-runnable, so this stays safe to repeat.
 */
function read() {
  if (args[0] === "--dir") {
    const dir = args[1];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n;\n");
  }
  return args[0] === "--file" ? readFileSync(args[1], "utf8") : args.join(" ");
}

const sql = read();
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
