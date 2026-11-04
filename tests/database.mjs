process.on("uncaughtException", (error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
grant usage on schema auth,public to authenticated,anon;
grant execute on all functions in schema auth to authenticated,anon;
`);
for (const name of [
  "schema.sql",
  "seed_diarios.sql",
  "002_gestora_multiempresa.sql",
]) {
  const sql = (
    await readFile(new URL("../supabase/" + name, import.meta.url), "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
}
const owner = "00000000-0000-0000-0000-000000000001",
  leader = "00000000-0000-0000-0000-000000000002",
  other = "00000000-0000-0000-0000-000000000003";
await db.query(
  "insert into auth.users(id,email,email_confirmed_at) values ($1,'owner@test.com',now()),($2,'leader@test.com',now()),($3,'other@test.com',now())",
  [owner, leader, other],
);
// Existing legacy data must survive the upgrade.
await db.query(
  "insert into companies(id,name) values('10000000-0000-0000-0000-000000000001','Legado')",
);
await db.query(
  "insert into memberships values('10000000-0000-0000-0000-000000000001',$1,'owner')",
  [owner],
);
await db.query(
  "insert into units(id,company_id,name) values('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Legado')",
);
const legacyTemplate = (
  await db.query("select id from templates where cadence='daily' limit 1")
).rows[0].id;
const legacyItem = (
  await db.query(
    "select i.id from items i join sections s on s.id=i.section_id where s.template_id=$1 limit 1",
    [legacyTemplate],
  )
).rows[0].id;
const legacyId = (
  await db.query(
    "insert into entries(company_id,unit_id,template_id,author_id,period_start,details) values('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',$1,$2,'2026-10-01',$3) returning id",
    [legacyTemplate, owner, JSON.stringify({ sales: "100", shift: "Manhã" })],
  )
).rows[0].id;
await db.query("insert into entry_answers values($1,$2,true)", [
  legacyId,
  legacyItem,
]);
await db.query("update entries set status='submitted' where id=$1", [legacyId]);
await db.exec(
  await readFile(
    new URL("../supabase/003_versions_security.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  "grant select,insert,update,delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;",
);
await db.query(
  "insert into platform_managers values($1) on conflict do nothing",
  [owner],
);
const migrated = (
  await db.query("select * from entries where id=$1", [legacyId])
).rows[0];
assert.equal(migrated.responses[legacyItem], true);
assert.equal(migrated.responses.shift, "Manhã");
assert.equal(migrated.responses.sales, "100");
assert.equal(migrated.due_at, null);
assert.ok(migrated.version_id);
async function login(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function one(sql, args = []) {
  return (await db.query(sql, args)).rows[0];
}
let checks = 0;
async function denied(sql, args = []) {
  await assert.rejects(() => db.query(sql, args));
  checks++;
}
await login(owner);
const ca = (await one("select new_company('Empresa A','Unidade A') id")).id;
const cb = (await one("select new_company('Empresa B','Unidade B') id")).id;
const ua = (await one("select id from units where company_id=$1", [ca])).id;
const ub = (await one("select id from units where company_id=$1", [cb])).id;
const invite = (
  await one("select create_invitation($1,'leader@test.com','member',$2) id", [
    ca,
    ua,
  ])
).id;
await login(leader);
await one("select accept_invitation($1)", [invite]);
checks++;
await denied("select new_company('Forbidden')");
assert.equal((await db.query("select * from companies")).rows.length, 1);
checks++;
assert.equal((await db.query("select * from units")).rows.length, 1);
checks++;
assert.equal((await db.query("select * from memberships")).rows.length, 1);
checks++;
await login(owner);
const fields = [
  {
    id: "goal",
    category: "Resultados",
    label: "Meta",
    type: "number",
    required: true,
    options: [],
  },
  {
    id: "ok",
    category: "Pessoas",
    label: "Revisado",
    type: "boolean",
    required: true,
    options: [],
  },
];
const version = (
  await one(
    "select publish_template($1,null,'Modelo A','Teste','daily',$2::jsonb) id",
    [ca, JSON.stringify(fields)],
  )
).id;
const tid = (
  await one("select template_id from template_versions where id=$1", [version])
).template_id;
const eid = (
  await one(
    "select assign_diary($1,$2,$3,$4,'2026-11-03','2026-11-04T02:59:00Z') id",
    [ca, ua, leader, version],
  )
).id;
const originalVersion = (
  await one("select id from template_versions where company_id is null limit 1")
).id;
const foreign = (
  await one(
    "select assign_diary($1,$2,$3,$4,'2026-11-03','2026-11-04T02:59:00Z') id",
    [ca, ua, leader, originalVersion],
  )
).id;
await one(
  "select publish_template($1,$2,'Modelo A','Segunda versão','weekly',$3::jsonb)",
  [ca, tid, JSON.stringify([{ ...fields[0], label: "Nova meta" }])],
);
checks++;
await denied("select save_diary($1,$2,$3,$4,'2026-11-03','{}',false)", [
  eid,
  ca,
  ua,
  version,
]);
await login(leader);
assert.equal(
  (await db.query("select * from templates where company_id=$1", [cb])).rows
    .length,
  0,
);
checks++;
await denied("select save_diary(null,$1,$2,$3,'2026-11-03','{}',false)", [
  cb,
  ub,
  version,
]);
await denied("select save_diary($1,$2,$3,$4,'2026-11-03','{}',true)", [
  eid,
  ca,
  ua,
  version,
]);
await one("select save_diary($1,$2,$3,$4,'2026-11-03',$5::jsonb,false)", [
  eid,
  ca,
  ua,
  version,
  JSON.stringify({ goal: 0, ok: false }),
]);
checks++;
const draft = await one("select * from entries where id=$1", [eid]);
assert.deepEqual(draft.responses, { goal: 0, ok: false });
checks++;
await one("select save_diary($1,$2,$3,$4,'2026-11-03',$5::jsonb,true)", [
  eid,
  ca,
  ua,
  version,
  JSON.stringify({ goal: 0, ok: false }),
]);
checks++;
await denied("select save_diary($1,$2,$3,$4,'2026-11-03','{}',false)", [
  eid,
  ca,
  ua,
  version,
]);
const record = await one("select * from entries where id=$1", [eid]);
assert.equal(record.version_id, version);
assert.equal(record.status, "submitted");
checks++;
await login(other);
assert.equal((await db.query("select * from entries")).rows.length, 0);
checks++;
assert.equal((await one("select entry_company($1) id", [foreign])).id, null);
checks++;
await denied("select publish_template($1,null,'Exploit','x','daily',$2)", [
  ca,
  JSON.stringify(fields),
]);
await login(owner);
assert.equal(
  (await one("select count(*)::int n from entries where company_id=$1", [ca]))
    .n,
  2,
);
checks++;
assert.ok((await one("select count(*)::int n from audit_log")).n >= 4);
checks++;
await one("select manage_unit_access($1,$2,$3,false)", [ca, ua, leader]);
await login(leader);
assert.equal((await db.query("select * from entries")).rows.length, 0);
checks++;
await denied("select save_diary($1,$2,$3,$4,'2026-11-03','{}',false)", [
  foreign,
  ca,
  ua,
  originalVersion,
]);
await denied("select manage_unit_access($1,$2,$3,true)", [ca, ua, leader]);
await login(owner);
await one("select manage_unit_access($1,$2,$3,true)", [ca, ua, leader]);
checks++;
const revoked = (
  await one("select create_invitation($1,'other@test.com','member',$2) id", [
    ca,
    ua,
  ])
).id;
await one("select revoke_invitation($1)", [revoked]);
await login(other);
await denied("select accept_invitation($1)", [revoked]);
await login(leader);
const direct = (
  await db.query("update entries set responses='{}' where id=$1 returning id", [
    eid,
  ])
).rows;
assert.equal(direct.length, 0);
checks++;
await denied("select save_diary(null,$1,$2,$3,'2026-11-04',$4,true)", [
  ca,
  ua,
  version,
  JSON.stringify({ goal: "invalid", ok: true }),
]);

await login(owner);
const fresh = (
  await one("select create_invitation($1,'other@test.com','member',$2) id", [
    ca,
    ua,
  ])
).id;
await login(leader);
await denied("select accept_invitation($1)", [fresh]);
await db.exec("reset role");
await db.query("update auth.users set email_confirmed_at=null where id=$1", [
  other,
]);
await login(other);
await denied("select accept_invitation($1)", [fresh]);
await db.exec("reset role");
assert.equal(
  (
    await one(
      "select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity",
    )
  ).n,
  0,
);
checks++;
console.log(
  "PASS: migrations e " +
    checks +
    " verificações de banco, RLS, convites, versões e submissão.",
);
await db.close();
