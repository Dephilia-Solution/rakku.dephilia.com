# @rakku/demo — browser-memory domain reference

One `DemoSandbox` owns one visitor's disposable cafe. All methods are synchronous.
Runtime imports are local domain modules; production types are imported with
`import type` from `@rakku/shared-types`. The engine creates no timers, network
requests, cookies, browser storage, database clients, or global sandbox instance.

## Architecture

`index.ts` exports the domain types, pure constants/helpers, and `DemoSandbox`.
The engine owns private state, generation-scoped IDs, image URLs, and subscribers.
Each command validates and mutates a clone, then publishes a deeply frozen
permission-filtered snapshot. `fixture.ts` supplies deterministic cafe records;
`business.ts` calculates prices, reports, and balances; `entities.ts` validates
CRUD relations; `access.ts` applies menu and outlet boundaries. The subscription
calendar helper is shared by fixture initialization and invoice activation.
Shared production types are compile-time imports; production services are never
part of the domain runtime graph.

The route-group `apps/owner/src/app/demo/(sandbox)/layout.tsx` owns a tab-local
sandbox through `components/demo/DemoProvider.tsx`. Real Next routes under
`/demo/owner/...` and `/demo/pos/...` reuse the existing merchant components,
shared OwnerShell/PosShell, and the explicit merchant runtime context. Navigation
preserves one sandbox without eagerly importing every screen. The public
`/demo/menu/pusat` and `/demo/menu/taman` routes construct a fresh fixture, obtain
a safe menu projection, and destroy that temporary sandbox. Public menu links
therefore show the initial fixture rather than another tab's edits. Repository
integration and deployment details belong in the top-level `DEMO.md`.

Public routes now render `apps/pos/src/components/menu/PublicMenuView.tsx`, the
same presentation used by the production menu route, receiving only `PublicMenu`.
That module imports neither the engine nor fixture. The legacy package menu export
is retained for compatibility but is not used by the current application routes.

## UI integration

```ts
import { createDemoSandbox, type DemoOrder } from "@rakku/demo";

const sandbox = createDemoSandbox();
sandbox.run({ type: "session.owner" });
const state = sandbox.getSnapshot();
const outlet = state.outlets[0];
const tier = state.tiers.find(t => t.outlet_id === outlet.id)!;
const product = state.products.find(p => p.outlet_id === outlet.id)!;
const order = sandbox.run({
  type: "order.create",
  outlet_id: outlet.id,
  tier_id: tier.id,
  items: [{ product_id: product.id, quantity: 2 }],
  status: "draft",
  payment_method: "cash",
}) as DemoOrder;
```

`getSnapshot` and `subscribe` are bound functions, suitable for
`useSyncExternalStore(sandbox.subscribe, sandbox.getSnapshot, sandbox.getSnapshot)`.
Every published snapshot and command result is deeply frozen. Snapshot identity
stays stable for reads, quotes, idempotent commands, and failed commands. A change
commits atomically before subscribers are notified. Subscriber exceptions are
isolated. Subscription callbacks take no arguments; read the latest snapshot.

On reset/unmount call `destroy()` on the old instance, unsubscribe, and dispose of
UI-owned timers, abort controllers, and independently created object URLs.
The sandbox revokes every URL created through `attachImage` on destruction.
Capture both the sandbox and
its `generation` in asynchronous callbacks, then call `run(command, generation)`.
Stale generations and every operation on a destroyed sandbox throw `Error`;
`destroy()` and existing unsubscribe functions are idempotent.

The package exports `@rakku/demo` through `index.ts` and `@rakku/demo/runtime`
through `src/runtime/index.ts`. Hosted React providers and screens live in the
Owner application and are checked by its typecheck/build. The package's secondary
UI typecheck covers only the legacy menu compatibility export.

## Public API

```ts
class DemoSandbox {
  readonly generation: string;
  constructor(now?: Date);
  getSnapshot(): DemoState;
  subscribe(listener: () => void): () => void;
  destroy(): void;
  run(command: DemoCommand, generation?: string): unknown;
  publicMenu(outletId: string): PublicMenu;
  report(outletId?: string, from?: string, to?: string): DemoReport;
  salesReport(outletId?: string, from?: string, to?: string): DemoReport;
  attachImage(file: File): string;
  removeImage(url: string): void;
}
function createDemoSandbox(now?: Date): DemoSandbox;
```

Also exported: domain model types, shared menu/inventory/billing types, audited
constants, `DEMO_IDS`, `fixtureId(outletId, kind, key)`, `jakartaDate`, `productCost`,
`deriveBalance`, and `addSubscriptionPeriod`. Mutable fixture construction is an
internal implementation.

### State and permissions

`DemoState` has `company`, `outlets`, `employees`, `roles`, `categories`, `tiers`,
`products`, `ingredients`, `tables`, `orders`, `movements`, `purchases`, `expenses`,
`taxes`, `discounts`, `payments`, `ledger`, `balance`, `withdrawals`, `banks`,
`invoices`, `outbox`, `plan`, `plans`, `subscription`, `subscription_status`,
`billing_cycle`, `plan_expires_at`, `now`, `session`, `menus`, and `generation`.
Arrays are canonical, with snake_case record fields. `company` is one record;
`balance` is derived from ledger entries, never independently writable.

The billing additions use shared types and are read-only snapshot data:

```ts
subscription: Subscription;
subscription_status: SubscriptionStatus;
billing_cycle: BillingCycle;
plan_expires_at: string | null;
```

`subscription` is the latest activated shared record with `id`, `company_id`,
`plan_id`, `status`, `started_at`, `current_period_start`, `current_period_end`,
`cancelled_at`, and `created_at`. Its `status` follows the effective lifecycle and
matches `subscription_status`; its original `plan_id` remains available after
expiry for renewal. `plan_expires_at` matches `current_period_end`. `plan` is the
effective feature/quota slug, which may become Free while the raw subscription
still records Business or Pro. Invoice states and subscription states are separate.

- Initial session: `{mode:'owner', outlet_id:DEMO_IDS.pusat,
  employee_id:null, authenticated:false}`. Explicit `session.owner` authenticates
  the simulated owner entry. Owner reads all outlets and entities.
- Before authentication the snapshot exposes active outlets and a login roster
  with blank PINs, plus company display name and plan catalog. Business arrays are
  empty. Company protected fields are blank; `balance` is `null`.
- POS snapshots expose only the selected outlet and permitted arrays. Employee,
  role, bank, invoice, withdrawal, ledger, and owner outbox arrays are empty;
  company email/code/owner/password are blank and `balance` is `null`.
- Manager fixture role has all nine existing POS menus: `register`, `orders`,
  `reports`, `products`, `tax-discounts`, `ingredients`, `tables`, `expenses`,
  `purchases`. Cashier role has `register`, `orders`, `reports`, `tax-discounts`.
- `register` permits reading products/categories/tiers/tables/taxes/discounts,
  but product mutations require `products`, table mutations require `tables`,
  and tax/discount mutations require `tax-discounts`. Cashier product recipes are
  empty; managers can read recipes and ingredients. Every business command checks
  its menu/owner boundary and related outlet scope independently.
- `publicMenu` is explicitly public, including when logged out or viewing a
  different outlet. It validates an active outlet and returns only category
  identity plus active product identity/name/base price/description/local image.
- `report` requires `reports`, the plan's `profit_loss` feature, valid date range,
  and allowed outlet/history. Omitted outlet means all outlets for owner and the
  selected outlet for POS. Owners may report a deactivated outlet's history.
- `salesReport` uses the same report permission, outlet scope, inclusive dates,
  and history limit, without requiring `profit_loss`. It returns the same
  `DemoReport` shape. On Free, `cogs`, `expenses`, `grossProfit`, and `netProfit`
  are zero; daily COGS/expenses and product COGS are also zero. Expense-only days
  are excluded. Paid plans with `profit_loss` retain the full report values.
- `attachImage` requires `products` permission (owner or permitted POS manager).
  `removeImage` is lifecycle cleanup and remains available after switching users;
  it changes no entity and cannot revoke foreign or still-referenced images.

Fixture IDs are deterministic and usable in separate visitors. New IDs are
prefixed with the creating sandbox's generation; unknown/foreign IDs cannot be
saved as new records. Only omitted/empty `value.id` creates a new entity.

### Command reference

All commands are discriminated by `type`. Invalid input throws `Error` without
changing snapshot or sequence. `PLAN_LIMIT: ...` identifies plan restrictions.

| Type | Exact parameters after `type` | Result |
| --- | --- | --- |
| `session.owner` | none | `DemoSession` |
| `session.cashier` | `outlet_id`, `employee_id`, `pin` | `DemoSession`; validates active employee, role, outlet assignment, exact PIN |
| `session.selectOutlet` | `outlet_id` | `DemoSession`; preserves a cashier only when assignment remains valid, otherwise clears cashier/authentication |
| `session.switchUser` | none | `DemoSession`; POS mode, cleared cashier, same outlet and cafe data |
| `entity.save` | `entity`, `value:Record<string,unknown>` | saved record; partial updates supported |
| `entity.delete` | `entity`, `id` | `{success:true}`; rejects referenced resources |
| `entity.reorder` | `entity`, `ids:string[]` | `{success:true}`; full unique permutation for one outlet, or all records for unscoped entities |
| `company.save` | `value` with optional `id`, `name`, `code`, `email`, `owner_name` | `DemoCompany`; owner only |
| `company.password` | `current`, `password` | `{success:true}`; owner only, matching current password, at least 8 characters |
| `order.quote` | order input below | normalized `DemoOrder`; no state change |
| `order.create` | order input, `status:'draft'|'completed'|'pending'`, `payment_method`, optional `amount_paid`, `splits` | `DemoOrder` |
| `order.complete` | `id`, `payment_method`, optional `amount_paid`, `splits` | `DemoOrder`; existing completion is idempotent |
| `order.cancel` | `id` | `DemoOrder`; rejects completed orders, cancels pending intents, releases eligible table |
| `stock.adjust` | `ingredient_id`, `quantity`, `note` | `{previous_stock,new_stock,quantity_change}`; quantity is absolute, requires `ingredients` and `inventory_advanced` |
| `purchase.create` | `outlet_id`, `supplier_name`, `note`, optional `purchase_date`, `items:[{ingredient_id,quantity,unit_cost}]` | purchase with items; requires `purchases` and `inventory_advanced` |
| `tables.generate` | `outlet_id`, `count`, optional `prefix` | generated tables; 1–100, default prefix `Meja`, skips existing names |
| `payment.create` | `order_id` | local `PaymentIntent`; existing pending intent is reused |
| `payment.transition` | `id`, `status:'pending'|'success'|'failed'|'expired'|'cancelled'` | intent; only pending-to-final transitions, same status idempotent |
| `payment.retry` | `id` | new intent; cancels current pending attempt, rejects stale attempt or final order |
| `withdrawal.create` | `bank_id`, `amount` | `Withdrawal`; owner only |
| `withdrawal.transition` | `id`, `status:'processing'|'completed'|'rejected'`, optional `note` | withdrawal; same outcome idempotent, final outcome cannot change |
| `subscription.checkout` | `plan:'free'|'pro'|'business'`, `billing_cycle:'monthly'|'yearly'` | `SubscriptionInvoice`; owner only, cancels previous pending invoices |
| `subscription.transition` | `id`, `status:'success'|'failed'|'expired'|'cancelled'` | invoice; success activates/renews one calendar period atomically, terminal outcomes cannot change |
| `subscription.retry` | `id` | new invoice; latest non-successful attempt only |
| `email.preview` | `email`, optional `subject`, `outlet_id`, `from`, `to`; legacy recipient form described below | `DemoReportEmail` with `kind:'report'`, text `body`, and sales-projected `report`; requires `reports` and `email_reports`, applies company-wide monthly report quota |
| `tick` | optional `now` with ISO timestamp and timezone | `{now}`; expires pending records/drafts and resolves subscription grace/fallback; omitted timestamp advances one second |

`entity` is exactly `outlets | employees | roles | categories | tiers | products |
ingredients | tables | taxes | discounts | expenses | banks`.

### Entity value fields

All rows have generated `id` and enforced `company_id`. Scoped rows use
`outlet_id` (defaults to current selected outlet for creation); updates cannot move
resources between outlets. Optional `company_id` must match the sandbox. Unknown
fields are discarded. Audit fields are generated, not writable.

| Entity | Writable fields / creation defaults |
| --- | --- |
| outlets | required `name`; `address:''`, `is_active:true` |
| employees | required `name`, unique normalized `username`, existing `role_id`, six-digit `pin`, nonempty unique active `outlet_ids`; `is_active:true`. PIN must be unique across overlapping assignments. |
| roles | required `name`, `menus:string[]` containing only known POS slugs; owner only; creating roles or changing menu grants requires `custom_roles` |
| categories | required `name`; `sort_order` defaults to next position |
| tiers | required `name`; `slug` defaults to lowercase hyphenated name, unique per outlet; `is_active:true`, next `sort_order` |
| products | required `name`, same-outlet `category_id`; `price:0`, `prices:{}`, `recipe:[]`, `modifiers:[]`, `description:null`, `image_url:null`, `is_active:true`, next `sort_order` |
| ingredients | required `name`, `unit:'gram'|'ml'|'pcs'|'kg'|'liter'`; `stock_quantity:0` on creation, `min_stock_alert:0`, `cost_per_unit:0`, `is_active:true`. Existing stock changes require `stock.adjust`; recipe-linked units cannot change. |
| tables | required `name`; `status:'available'` or `'occupied'`; available disallowed while a draft/pending order holds the table |
| taxes | required `name`, `type:'percentage'|'fixed'`, `value`; `is_active:true`, next `sort_order` |
| discounts | required `name`, `type`, `value`, `start_date`, `end_date`; `product_id:null` means order discount, otherwise same-outlet product; `is_active:true` |
| expenses | required `category`, integer `amount`; `description:null`, `expense_date` defaults to current Jakarta date |
| banks | required `bank_name`, numeric `account_number` (6–30 digits), `account_holder`; `status:'active'`, `is_default:false`; setting a default clears other defaults |

Product `prices` maps existing same-outlet tier IDs to nonnegative integer rupiah.
Missing tier prices fall back to `price`. Recipes contain
`{ingredient_id,quantity_used}` with positive quantity, unique active same-outlet
ingredients. Modifiers contain `{id?,name,group_name?,price_delta?,prices?}`;
existing IDs must belong to that product, new modifiers omit ID. Modifiers use
same-outlet tier deltas and fall back to `price_delta:0`. Images must match a local
`/demo-assets/...svg|png|webp|jpg` path or an active blob URL registered by this
sandbox's `attachImage`. Arbitrary blob, data, and HTTP(S) URLs are rejected.
The fixture uses `/demo-assets/cafe.svg`, `/demo-assets/latte.svg`, and
`/demo-assets/food.svg`.

### Product image lifecycle

`attachImage(file: File): string` accepts a real, nonempty `File` with MIME type
`image/jpeg`, `image/png`, or `image/webp`, at most **2,097,152 bytes (2 MiB)**.
The limits match the production upload contracts; the filename does not determine
format. It synchronously creates an object URL and remembers it in a private
per-sandbox registry. It does not save the product or publish a snapshot.

Use the returned URL as `value.image_url` in `entity.save`. After a successful
replacement/deletion call `removeImage(oldUrl)`. After a failed save or abandoned
upload, call `removeImage(newUrl)` to discard the unused attachment.

```ts
const oldUrl = product.image_url;
const newUrl = sandbox.attachImage(file);
try {
  sandbox.run({
    type: "entity.save",
    entity: "products",
    value: { id: product.id, image_url: newUrl },
  }, sandbox.generation);
} catch (error) {
  sandbox.removeImage(newUrl);
  throw error;
}
if (oldUrl) sandbox.removeImage(oldUrl);
```

Saving/deleting a product never implicitly revokes a URL. `removeImage(url): void`
revokes only a URL owned by this sandbox and unused by **every** product, including
other outlets and inactive products. Still-used, seed, foreign, and already-removed
URLs are no-ops. Shared URLs remain registered until the last product detaches and
cleanup is called, or the sandbox is destroyed. Registry cleanup does not publish
a snapshot. Removed URLs cannot be saved again; attach a new `File` instead.
`destroy()` revokes all remaining registered URLs exactly once, including attached
but unsaved images. Image operations on destroyed sandboxes throw.

Money is finite, nonnegative integer rupiah; physical quantities and unit costs
may be fractional. Order quantities are positive integers up to 10,000; orders
and purchases have 1–100 items. Percentages are 0–100. Date-only fields are real
`YYYY-MM-DD` calendar dates; purchases/expenses cannot be future-dated. Discount
start must not follow end. All date filtering/month quotas use Jakarta (UTC+7).

### Orders, inventory and reports

Order input is `{outlet_id,tier_id,items:[{product_id,quantity,modifier_ids?,note?}],
customer_name?,table_id?,order_type?}`. Defaults: `customer_name:'Pelanggan Demo'`,
no table, `order_type:'dine_in'`. Order types are shared types: `dine_in`,
`take_away`, `delivery`, `gojek`, `grab`, `shopee`. A table must belong to the outlet
and requires dine-in. Create rejects occupied tables.

Quotes contain shared order fields and `items` with `product_id`, `product_name`,
`quantity`, `unit_price`, `subtotal`, `modifier_label`, `note`, generated item IDs,
plus `total` (alias of `total_price`), `tier_id` (alias of `pricing_tier_id`),
`amount_paid`, `change`, `splits`, `completed_at`, company/outlet scope.
Item `unit_price` includes tier/modifier prices before product discount; item
`subtotal` is after product discount. Active date-valid product discounts apply
first, then the first active date-valid order discount, then taxes on the
discounted order amount. Other order discounts do not stack. Each
percentage calculation rounds to integer rupiah. Inactive/expired discounts do
not apply. Completed pricing is retained; reports intentionally recompute COGS
from **current recipe and current last purchase cost**, like the owner contract.

Payment methods are `cash | card | qris_manual | qris`. Drafts store `later` and
reserve for 24 hours without deductions. `pending` command status normalizes to
shared `pending_payment`. Dynamic QRIS must be pending and completes only through
payment success. `order.complete` with `qris` on a draft is rejected atomically;
drafts can complete through cash/card/manual QRIS. For dynamic QRIS create a
separate `pending` order and cancel the old draft as appropriate. `payment.create`
also rejects drafts. Manual methods complete directly, with no balance credit.
Cash overpayment produces change; other methods require exact payment. Omitted
`amount_paid` means exact total. Splits are `[{method,amount}]`, 2–20 positive
parts exactly covering total, and permit cash/card/manual QRIS only. They replace
`amount_paid` and deduct stock once for the entire order.

Completion produces one aggregate sale movement per recipe ingredient/order.
Like production stock deduction, sales can take stock below zero; this signals
low stock and does not silently reject an otherwise valid payment. Purchases add
stock and update last unit cost; opname sets an absolute nonnegative quantity.
An ingredient with negative stock caused by sales remains metadata-editable;
changing its stored quantity still requires `stock.adjust`. New opening stock
and absolute opname quantities must be nonnegative.

`report` defaults to the latest 30 Jakarta calendar days, inclusively. It returns
`revenue,cogs,expenses,grossProfit,netProfit,orders,subtotal,tax,discounts,
averageOrder,from,to,outlet_id,daily,products`. Revenue includes tax and uses only
completed orders; purchases do not count again as operating expenses. No cost
snapshots or modifier recipe consumption are added, matching production recipes.
`salesReport` defaults to the same period and returns the same sales totals and
breakdowns on Free with the cost/profit projection described above. Report-email
previews require the separate `email_reports` feature. Admitted previews use the
same `salesReport` scope/date projection and carry the permitted cost/profit data.

Completed dine-in tables remain `occupied` for cash/card/manual QRIS, completed
drafts, and successful dynamic QRIS, matching the audited production completion
paths. Set the table's status to `available` explicitly when service ends.

### Payment, withdrawal, subscription and clock rules

Payment/invoice QR strings are clearly marked `RAKKU-DEMO-NOT-PAYABLE`; they are
local QR payloads, not provider QRIS codes. Intents expire in 15 minutes. Payment
success deducts once and credits `gross - round(gross * 0.007)` once. Failed,
expired, cancelled, retried, draft, split, and manual payments cannot credit funds.

Withdrawal: active bank, Rp50,000 minimum, Rp0 fee, Rp10,000,000 company-wide per
Jakarta day, one requested/processing withdrawal, sufficient available funds.
Hold transfers available to pending. Processing changes no money. Rejection
releases the hold; completion removes pending and increases total withdrawn.
Daily usage includes requested/processing/completed, excludes rejected.

Checkout creates an invoice even for Free (Rp0). Only simulated invoice success
activates the selected plan. Successful activation replaces the current
`subscription` with a new generation-scoped shared record and updates the invoice,
billing cycle, expiry, effective plan, and simulated confirmation in one commit.
`started_at` and `created_at` are the simulated payment/activation time.

- Same raw plan and a future `plan_expires_at`: `current_period_start` is that
  future expiry, extending the existing entitlement without losing prepaid time.
- Different plan, elapsed expiry, or no expiry: `current_period_start` is `now`.
- Monthly/yearly checkout adds one calendar month/year to that start. The helper
  applies the owner's JavaScript date arithmetic in Jakarta time, independently
  of the browser/Node host timezone. It preserves wall-clock time and JS overflow:
  January 31, 2026 + one month ends March 3; February 29, 2028 + one year ends
  March 1, 2029. It does not clamp to month end or substitute fixed 30/365 days.
- Free success also has a real calendar period and expiry.
- Repeated success for any already-successful invoice does not extend, replace,
  reactivate, or switch the current subscription again. Checkout, retries, failed,
  expired, and cancelled invoice outcomes never change the subscription period.

`tick` derives effective subscription status and plan from the retained raw plan
and expiry. Before expiry the status is `active`. At expiry it becomes `grace`
for seven days with the paid plan's existing features/quotas. At exactly
`plan_expires_at + 7 days`, status becomes `expired` and `plan` falls back to
`free`. Jumping past grace downgrades directly. The raw plan ID, original period,
expiry and billing cycle remain intact. A new successful checkout reactivates
the chosen plan; renewing during or after grace starts at `now`, because the old
period is no longer in the future.

Downgrade preserves all existing cafe data, permits ordinary existing entity
edits, and blocks new capacity/locked features. Limits count all company resources,
including inactive records; `-1` means unlimited. Free/Pro/Business defaults match
the active `scripts/neon-seed.ts` catalog plus `0001_baseline.sql` defaults, with
historical migration 025 covered by parity tests too. Transaction quotas count monthly
completed orders with the existing 10%/3-day grace rule (earlier bound wins).
The full profit report, advanced inventory mutations, and custom-role menu changes are
feature-gated. Email previews are also feature-gated: Free's `features:{}` blocks
them even though its catalog contains `email_reports_month:5`. That numeric value
does not grant the feature. Pro enables the feature with a 100-report monthly
limit; Business enables it with unlimited report previews. The demo enforces both
the feature flag and catalog quota. The production route audit establishes the
feature requirement; it does not establish an actively enforced numeric monthly
email counter in those routes. All previews remain simulated.

### Email preview API and filters

The filtered command uses the production-style `email` recipient field, leaving
`to` available for the optional inclusive report end date:

```ts
{
  type: 'email.preview';
  email: string;
  subject?: string;
  outlet_id?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}
```

Existing `{type:'email.preview',to:'recipient@example.invalid',subject?}` callers
remain supported. In that legacy form, `to` is the recipient and the report end
defaults to today; `outlet_id` and `from` may still be supplied. Use `email` for the
recipient whenever specifying both report dates. Supplying `email` with an email
address in `to` is invalid because that field is then a date.

```ts
const mail = sandbox.run({
  type: 'email.preview',
  email: 'owner@rakku.invalid',
  subject: 'Penjualan Pusat hari ini',
  outlet_id: DEMO_IDS.pusat,
  from: jakartaDate(sandbox.getSnapshot().now),
  to: jakartaDate(sandbox.getSnapshot().now),
}) as DemoReportEmail;
```

Preview requires an authenticated `reports` permission and the effective plan's
`email_reports` flag at the command boundary. Free fails atomically with
`PLAN_LIMIT: email_reports`; it creates no preview and consumes no quota.
Valid previews use exactly `salesReport(outlet_id,from,to)` semantics, including
history limits, completed-only sales, current permitted costs, real calendar
dates, inclusive ranges, and owner/POS outlet scope. Omitted filters mean the
latest 30 Jakarta days, all outlets for owner, or the current outlet for POS.
Cross-outlet POS requests, invalid resources/dates/ranges/recipients, and rejected
history/quota requests create no message or snapshot change.

Only successful `kind:'report'` messages count against the company-wide quota for
their creation month in Jakarta. Filters and user/outlet switching do not create
new allowances. The 101st Pro preview is blocked; its allowance resets at Jakarta
month start. System billing/withdrawal notifications neither require this feature
nor consume report quota and can still be generated on Free or after quota exhaustion.

### Simulated outbox

Every `DemoOutbox` record contains `id`, `to`, `subject`, `body`,
`status:'simulated'`, and `created_at`. It is a discriminated union:

```ts
type DemoOutbox = DemoReportEmail | DemoSystemEmail;
// DemoReportEmail:
// kind: 'report'; report: DemoReport; notification_type: null; reference_id: null
// DemoSystemEmail:
// kind: 'system'; report: null; notification_type: DemoNotificationType;
// reference_id: string
type DemoNotificationType =
  | 'withdrawal_requested' | 'withdrawal_processing'
  | 'withdrawal_completed' | 'withdrawal_rejected' | 'subscription_success';
```

Withdrawal creation and each processing/completed/rejected transition append a
system notification addressed to the current company owner email. Subscription
success appends a plan/invoice confirmation. `reference_id` is the withdrawal or
invoice ID; subscription confirmations include the resulting Jakarta expiry.
Each `(notification_type,reference_id)` is emitted once. Same-status
retries do not duplicate notifications; failed commands emit nothing.
Notifications commit atomically with the simulated business operation and their
bodies are labeled `SIMULASI — tidak dikirim`. They never invoke a mail service.

Only `kind:'report'` consumes monthly report-email quota. System notifications are
generated even when that quota is exhausted and remain owner-only in snapshots.
Check `kind` before accessing `mail.report`; system messages have `report:null`.

`tick` rejects backwards time, expires pending payment intents/invoices, and
cancels expired drafts while releasing eligible tables. It also resolves the
subscription's active/grace/expired state and effective plan. Pending orders remain
retryable. It never turns a payment, invoice, or withdrawal into success.

## Fixture

Company: Rakku Demo Cafe / DEMO_CAFE / Owner Demo Rakku /
owner@rakku.invalid / DemoCafe2026!; fictional Pusat and Taman outlets. Each outlet
has 10 products in Coffee/Non-Coffee/Food, 4 price tiers, 15 ingredients, 8 tables,
60 completed orders across 30 days including today, 2 drafts, 1 pending QR order,
1 cancelled order, 4 multi-item purchases, 6 expenses, and 2 stock opnames.
Opening stock is computed once per ingredient from target stock minus all other
movements. Pusat Matcha and Taman Croissant start below minimum stock.

| Employee | Role | Outlet | PIN |
| --- | --- | --- | --- |
| Rani / rani_pusat | Manager | Pusat | 111111 |
| Bima / bima_pusat | Cashier | Pusat | 222222 |
| Dita / dita_taman | Manager | Taman | 333333 |
| Raka / raka_taman | Cashier | Taman | 444444 |

Business is active initially with a monthly shared Subscription from session
opening to one Jakarta calendar month later. Seed QRIS credits fund completed/rejected/requested
withdrawals and reconcile with the ledger. All credentials and bank identities
are fictional domain data.

## Source audit and verification

Audited source: shared-types `common`, `inventory`, `owner`, `billing`, `ledger`,
`withdrawal`; inventory/pricing/ledger/payments/plans entry points; active plan seed,
baseline plan defaults, historical migration 025;
owner withdrawal service/constants; POS normal/draft/split/QRIS order routes,
POS permission map/cart pricing, owner profit-loss cost contract, product upload
MIME/size rules, and owner/subscription/superadmin withdrawal notification paths.
The Owner report-email route explicitly checks `email_reports` through
`checkFeature`, whose shared resolver reads `features[feature]`. The currently
checked-in POS report-email route has session/company/outlet scoping but no
`checkFeature` call. Domain previews uniformly apply the required feature gate
for both session modes; source tests audit the actual routes and isolate the pure
shared predicate without importing any production service.
Pure browser constants mirror the audited production values. Contract tests
compare those values and catalogs against source text and literal AST nodes,
without importing services or executing seed/migration scripts. Calendar
regressions exercise activation and renewal across Jakarta month/year boundaries.

```sh
pnpm --filter @rakku/demo test
pnpm --filter @rakku/demo typecheck
# Direct tool invocation:
pnpm exec tsx --test packages/demo/src/*.test.ts
pnpm exec tsc --noEmit -p packages/demo/tsconfig.json
pnpm exec tsc --noEmit -p packages/demo/tsconfig.ui.json
```

To run installed tooling without automatic dependency verification, use
`pnpm --config.verify-deps-before-run=false --filter @rakku/demo test` and the
same prefix for `typecheck`.

The isolated provider-sentinel test requires Node 22.15+ (`registerHooks`); the
domain itself targets ES2022 browsers. Tests cover deterministic fixture relations,
stock/merchant ledger reconciliation, permissions, atomic errors, immutable
snapshot lifecycle, visitor isolation, current-cost reports, idempotent payment/
split/withdrawal transitions, plan quotas and Jakarta boundaries, Free sales
projections, draft QRIS rejection, image URL ownership/revocation, correlated
quota-independent notifications, real subscription periods and grace/fallback,
first-only order discounts, editable sales-negative stock, Free email rejection,
Pro 100-report quota/month reset, unlimited Business previews, and report-filter
parity/atomic validation. A fresh process
preloads throwing provider/network/storage sentinels before importing the domain.

## Production browser e2e commands

Build Owner/POS with the corresponding localhost URLs, then run the routed suite:

```powershell
$env:NEXT_PUBLIC_OWNER_URL = 'http://localhost:3000'
$env:NEXT_PUBLIC_POS_URL = 'http://localhost:3001'
pnpm build --concurrency=1
$env:PLAYWRIGHT_MODULE_PATH = Join-Path $env:LOCALAPPDATA 'Temp\opencode\node_modules'
$env:DEMO_E2E_BROWSER_CHANNEL = 'chrome'
pnpm test:demo:browser
```

For servers already running, use `node packages/demo/e2e/routed.mjs` with
`DEMO_OWNER_URL`/`DEMO_POS_URL`. `pnpm test:demo:browser` owns/cleans the server
processes it starts and refuses busy ports. It does not use merchant credentials.
JSON/screenshots are written to a unique OS temporary directory.
See [e2e/README.md](e2e/README.md) for prerequisites, coverage, isolation spies,
BFCache/PWA behavior and the `--dev-owner` StrictMode run.
