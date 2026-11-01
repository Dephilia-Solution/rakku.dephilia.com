// Two-connection PostgreSQL harness. It refuses to run unless an explicitly
// disposable database is supplied. It never reads application env or provider
// credentials and never targets the configured production/staging database.
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log("SKIPPED: TEST_DATABASE_URL is not set; no PostgreSQL concurrency acceptance was run.");
  process.exit(0);
}
if (process.env.RAKKU_ALLOW_DISPOSABLE_DB !== "1") {
  console.error("Refusing to run: set RAKKU_ALLOW_DISPOSABLE_DB=1 for a disposable database.");
  process.exit(2);
}
if (url === process.env.DATABASE_URL || url === process.env.DATABASE_URL_UNPOOLED) {
  console.error("Refusing to run: TEST_DATABASE_URL must differ from application database variables.");
  process.exit(2);
}

const first = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const second = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const companyId = randomUUID();
const outletId = randomUUID();

async function createFixture() {
  await first`insert into public.companies(id,code,name,password_hash) values(${companyId},${`CONC-${companyId.slice(0, 8)}`},'Concurrency fixture','hash')`;
  await first`insert into public.outlets(id,company_id,name) values(${outletId},${companyId},'Concurrency outlet')`;
  await first`insert into public.merchant_balances(company_id,available_balance) values(${companyId},1000)`;
}
async function call(sql, params) {
  const rows = await sql`select * from public.apply_balance_transaction(
    ${params.company}, ${params.outlet}, ${params.type}, ${params.amount},
    ${params.pending}, ${params.unsettled}, ${params.fee},
    ${params.referenceType}, ${params.referenceId}, ${params.note}, ${params.actor})`;
  return rows[0];
}
async function balance() {
  const [row] = await first`select available_balance,pending_balance,unsettled_balance from public.merchant_balances where company_id=${companyId}`;
  return row;
}

try {
  await createFixture();
  const holdRef1 = randomUUID();
  const holdRef2 = randomUUID();
  const params = (referenceId) => ({
    company: companyId, outlet: outletId, type: "withdrawal_hold", amount: -800,
    pending: 800, unsettled: 0, fee: 0, referenceType: "withdrawal", referenceId,
    note: "concurrency fixture", actor: "harness",
  });
  const results = await Promise.allSettled([
    first.begin(tx => call(tx, params(holdRef1))),
    second.begin(tx => call(tx, params(holdRef2))),
  ]);
  const fulfilled = results.filter(result => result.status === "fulfilled");
  const afterHold = await balance();
  if (fulfilled.length !== 1 || Number(afterHold.available_balance) !== 200 || Number(afterHold.pending_balance) !== 800) {
    throw new Error(`withdrawal concurrency invariant failed: ${JSON.stringify({ fulfilled: fulfilled.length, afterHold })}`);
  }

  await first`update public.merchant_balances set available_balance=0,pending_balance=0,unsettled_balance=0 where company_id=${companyId}`;
  const credit = (referenceId) => ({
    company: companyId, outlet: outletId, type: "sale_credit", amount: 1000,
    pending: 0, unsettled: 1000, fee: 7, referenceType: "concurrency_sale", referenceId,
    note: "concurrency fixture", actor: "harness",
  });
  const sameRef = randomUUID();
  const credits = await Promise.allSettled([
    first.begin(tx => call(tx, credit(sameRef))),
    second.begin(tx => call(tx, credit(sameRef))),
  ]);
  const inserted = credits
    .filter(result => result.status === "fulfilled")
    .map(result => result.value.inserted)
    .filter(Boolean);
  const afterCredit = await balance();
  if (inserted.length !== 1 || Number(afterCredit.unsettled_balance) !== 1000) {
    throw new Error(`idempotent credit invariant failed: ${JSON.stringify({ inserted, afterCredit })}`);
  }
  console.log("PASS: two-connection withdrawal lock and duplicate financial request invariants");
} finally {
  await first`delete from public.companies where id=${companyId}`.catch(() => {});
  await Promise.all([first.end(), second.end()]);
}
