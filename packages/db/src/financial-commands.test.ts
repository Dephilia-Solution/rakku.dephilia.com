import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { FinancialCommandError, runFinancialCommand } from "./financial-commands";

const pg = new PGlite();
const dialect = new PgDialect();
let catalog: Catalog;
const executor = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
};
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog,
  work => pg.transaction(tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let companyId: string;
let outletId: string;

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values('CMD-A','Command A','hash') returning id`))[0].id);
  outletId = String((await execute(sql`insert into public.outlets(company_id,name)
    values(${companyId},'Command Outlet') returning id`))[0].id);
});
after(() => pg.close());

async function expense(tx: DatabaseClient, amount: number) {
  const result = await tx.from("expenses").insert({
    company_id: companyId, outlet_id: outletId, category: "Test", amount,
    expense_date: new Date().toISOString(),
  }).select().single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "expense failed");
  return result.data;
}

test("financial request identity replays the stored result and prevents duplicate side effects", async () => {
  const requestId = `req-${randomUUID()}`;
  const first = await runFinancialCommand(db, {
    companyId, requestId, command: "expense.create", payload: { amount: 1000 },
    execute: tx => expense(tx, 1000),
  });
  const second = await runFinancialCommand(db, {
    companyId, requestId, command: "expense.create", payload: { amount: 1000 },
    execute: tx => expense(tx, 1000),
  });
  assert.equal(second.id, first.id);
  const count = await execute(sql`select count(*)::int as count from public.expenses
    where company_id=${companyId} and category='Test'`);
  assert.equal(count[0].count, 1);
});

test("same request identity with a different command or payload fails closed", async () => {
  const requestId = `req-${randomUUID()}`;
  await runFinancialCommand(db, {
    companyId, requestId, command: "expense.create", payload: { amount: 1000 },
    execute: tx => expense(tx, 1000),
  });
  await assert.rejects(() => runFinancialCommand(db, {
    companyId, requestId, command: "expense.create", payload: { amount: 2000 },
    execute: tx => expense(tx, 2000),
  }), (error: unknown) => error instanceof FinancialCommandError && error.code === "REQUEST_CONFLICT");
  await assert.rejects(() => runFinancialCommand(db, {
    companyId, requestId, command: "purchase.create", payload: { amount: 1000 },
    execute: tx => expense(tx, 1000),
  }), (error: unknown) => error instanceof FinancialCommandError && error.code === "REQUEST_CONFLICT");
  const count = await execute(sql`select count(*)::int as count from public.expenses
    where company_id=${companyId} and category='Test'`);
  assert.equal(count[0].count, 2);
});

test("failed command rolls back its side effect and request record", async () => {
  const requestId = `req-${randomUUID()}`;
  await assert.rejects(() => runFinancialCommand(db, {
    companyId, requestId, command: "expense.create", payload: { amount: 3000 },
    execute: async tx => { await expense(tx, 3000); throw new Error("after side effect"); },
  }), /after side effect/);
  assert.equal((await execute(sql`select count(*)::int as count from public.expenses
    where company_id=${companyId} and category='Test'`))[0].count, 2);
  assert.equal((await execute(sql`select count(*)::int as count from app_private.financial_requests
    where company_id=${companyId} and request_id=${requestId}`))[0].count, 0);
});

test("without a request identity the command executes normally; invalid identities are rejected", async () => {
  await runFinancialCommand(db, { companyId, requestId: null, command: "expense.create", payload: { amount: 4000 }, execute: tx => expense(tx, 4000) });
  await runFinancialCommand(db, { companyId, requestId: null, command: "expense.create", payload: { amount: 4000 }, execute: tx => expense(tx, 4000) });
  assert.equal((await execute(sql`select count(*)::int as count from public.expenses
    where company_id=${companyId} and category='Test'`))[0].count, 4);
  await assert.rejects(() => runFinancialCommand(db, {
    companyId, requestId: "bad key with spaces", command: "expense.create", payload: {},
    execute: tx => expense(tx, 1),
  }), (error: unknown) => error instanceof FinancialCommandError && error.code === "INVALID_REQUEST_ID");
});

test("financial request rows are platform-only under RLS", async () => {
  await pg.exec(`CREATE ROLE financial_tenant_test;
    GRANT USAGE ON SCHEMA app_private TO financial_tenant_test;
    GRANT EXECUTE ON FUNCTION app_private.platform() TO financial_tenant_test;
    GRANT SELECT,INSERT ON app_private.financial_requests TO financial_tenant_test`);
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE financial_tenant_test");
    await tx.exec("select set_config('app.scope','tenant',true)");
    assert.deepEqual((await tx.query("select * from app_private.financial_requests")).rows, []);
    await assert.rejects(() => tx.query(`insert into app_private.financial_requests
      (company_id,request_id,command,request_hash,result)
      values ('${companyId}','rls-${randomUUID()}','x','h','{}'::jsonb)`));
  });
});
