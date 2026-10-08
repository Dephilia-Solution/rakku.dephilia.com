import { sql, type SQL } from "drizzle-orm";

// Compatibility at the application boundary only. Every operation is compiled
// to parameterized SQL; there is no REST endpoint, API key, or browser client.
export type Row = Record<string, any>;
export interface DatabaseError { message: string; code: string; details?: string; }
export interface QueryResult<T = any[]> { data: T | null; error: DatabaseError | null; count: number | null; }
export interface ForeignKey {
  name: string; source: string; target: string; columns: string[]; references: string[]; unique: boolean;
}
export interface Catalog { tables: Record<string, string[]>; foreignKeys: ForeignKey[]; }
export type Executor = (query: SQL) => Promise<Row[]>;

export function identifier(value: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Invalid database identifier: ${value}`);
  return sql`${sql.identifier(value)}`;
}

export function splitFields(value: string): string[] {
  let depth = 0;
  let start = 0;
  const fields: string[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++;
    if (value[index] === ")" && --depth < 0) throw new Error("Invalid selection");
    if (value[index] === "," && depth === 0) {
      fields.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (depth !== 0) throw new Error("Invalid selection");
  fields.push(value.slice(start).trim());
  return fields.filter(Boolean);
}

type Filter = { column: string; operator: string; value: unknown; negate?: boolean };
type Ordering = { column: string; ascending: boolean; referencedTable?: string };
type Selection = { fields: string[]; relations: Relation[] };
type Relation = { key: string; table: string; hint?: string; inner: boolean; selection: Selection };

function parseSelection(input: string): Selection {
  const fields: string[] = [];
  const relations: Relation[] = [];
  for (const item of splitFields(input)) {
    const open = item.indexOf("(");
    if (open < 0) { fields.push(item); continue; }
    const [name, ...hints] = item.slice(0, open).split("!");
    const [key, target] = name.includes(":") ? name.split(":") : [name, name];
    identifier(key); identifier(target);
    relations.push({ key, table: target, hint: hints.find(hint => hint !== "inner" && hint !== "left"),
      inner: hints.includes("inner"), selection: parseSelection(item.slice(open + 1, -1)) });
  }
  return { fields, relations };
}

function databaseError(error: unknown): DatabaseError {
  const cause = error as { message?: string; code?: string; detail?: string; cause?: unknown };
  if (cause.cause) return databaseError(cause.cause);
  return { message: cause.message ?? "Database operation failed", code: cause.code ?? "DB_ERROR", details: cause.detail };
}

export class DatabaseClient {
  constructor(public readonly execute: Executor, private readonly getCatalog: () => Promise<Catalog>,
    private readonly begin?: <T>(work: (client: DatabaseClient) => Promise<T>) => Promise<T>) {}

  from(table: string): Query { identifier(table); return new Query(this, table); }
  catalog(): Promise<Catalog> { return this.getCatalog(); }
  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    // A transaction-scoped client can be passed through all existing helpers.
    if (!this.begin) return work(this);
    return this.begin(work);
  }
  async rpc(name: string, params: Record<string, unknown>): Promise<QueryResult> {
    if (!["apply_balance_transaction", "deduct_stock_for_order"].includes(name)) {
      return { data: null, count: null, error: { code: "DB_FUNCTION", message: "Function is not an application RPC" } };
    }
    try {
      const args = Object.entries(params).map(([key, value]) => sql`${identifier(key)} => ${value}`);
      const data = await this.execute(sql`select * from public.${identifier(name)}(${sql.join(args, sql`, `)})`);
      return { data, error: null, count: null };
    } catch (error) { return { data: null, error: databaseError(error), count: null }; }
  }
}

export class Query<T = any[]> implements PromiseLike<QueryResult<T>> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selection = "*";
  private returning = false;
  private values: Row[] = [];
  private filters: Filter[] = [];
  private alternatives: Filter[][] = [];
  private ordering: Ordering[] = [];
  private rowLimit?: number;
  private offset = 0;
  private cardinality?: "one" | "optional";
  private countRequested = false;
  private head = false;
  private conflict: string[] = [];
  private ignoreDuplicates = false;
  private promise?: Promise<QueryResult<any>>;
  constructor(private readonly client: DatabaseClient, private readonly table: string) {}

  select(selection = "*", options: { count?: "exact"; head?: boolean } = {}): this {
    this.selection = selection;
    this.returning = this.operation !== "select";
    this.countRequested = options.count === "exact";
    this.head = options.head ?? false;
    return this;
  }
  insert(values: Row | Row[]): this { this.operation = "insert"; this.values = Array.isArray(values) ? values : [values]; return this; }
  update(values: Row): this { this.operation = "update"; this.values = [values]; return this; }
  delete(): this { this.operation = "delete"; return this; }
  upsert(values: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.insert(values); this.operation = "upsert";
    this.conflict = (options.onConflict ?? "id").split(",").map(key => key.trim());
    this.ignoreDuplicates = options.ignoreDuplicates ?? false;
    return this;
  }
  private filter(column: string, operator: string, value: unknown, negate = false): this {
    this.filters.push({ column, operator, value, negate }); return this;
  }
  eq(column: string, value: unknown): this { return this.filter(column, "=", value); }
  neq(column: string, value: unknown): this { return this.filter(column, "<>", value); }
  gt(column: string, value: unknown): this { return this.filter(column, ">", value); }
  gte(column: string, value: unknown): this { return this.filter(column, ">=", value); }
  lt(column: string, value: unknown): this { return this.filter(column, "<", value); }
  lte(column: string, value: unknown): this { return this.filter(column, "<=", value); }
  in(column: string, values: unknown[]): this { return this.filter(column, "in", values); }
  is(column: string, value: null | boolean): this { return this.filter(column, "is", value); }
  not(column: string, operator: string, value: unknown): this {
    if (operator !== "is") throw new Error("Unsupported negated filter");
    return this.filter(column, "is", value, true);
  }
  or(expression: string): this {
    this.alternatives.push(splitFields(expression).map(item => {
      const match = /^(\w+)\.(eq|in)\.(.*)$/.exec(item);
      if (!match) throw new Error("Unsupported OR filter");
      const [, column, operator, raw] = match;
      const value = operator === "in" ? raw.slice(1, -1).split(",").filter(Boolean)
        : raw === "true" ? true : raw === "false" ? false : raw;
      return { column, operator: operator === "eq" ? "=" : "in", value };
    }));
    return this;
  }
  order(column: string, options: { ascending?: boolean; referencedTable?: string } = {}): this {
    this.ordering.push({ column, ascending: options.ascending ?? true, referencedTable: options.referencedTable }); return this;
  }
  limit(limit: number): this { this.rowLimit = this.integer(limit); return this; }
  range(from: number, to: number): this { this.offset = this.integer(from); this.rowLimit = this.integer(to - from + 1); return this; }
  single(): Query<any> { this.cardinality = "one"; return this as unknown as Query<any>; }
  maybeSingle(): Query<any> { this.cardinality = "optional"; return this as unknown as Query<any>; }
  private integer(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid pagination");
    return value;
  }
  private column(catalog: Catalog, table: string, alias: string, name: string): SQL {
    if (!catalog.tables[table]?.includes(name)) throw new Error(`Unknown column ${table}.${name}`);
    return sql`${identifier(alias)}.${identifier(name)}`;
  }
  private predicate(catalog: Catalog, table: string, alias: string, filter: Filter): SQL {
    const column = this.column(catalog, table, alias, filter.column);
    let condition: SQL;
    if (filter.operator === "in") {
      const values = filter.value as unknown[];
      condition = values.length ? sql`${column} in (${sql.join(values.map(value => sql`${value}`), sql`, `)})` : sql`false`;
    } else if (filter.operator === "is") {
      if (filter.value === null) condition = sql`${column} is null`;
      else if (filter.value === true || filter.value === false) condition = sql`${column} is ${sql.raw(String(filter.value))}`;
      else throw new Error("IS only supports null or boolean");
    } else {
      if (!["=", "<>", ">", ">=", "<", "<="].includes(filter.operator)) throw new Error("Invalid operator");
      // SQL equality to NULL is deliberately not rewritten to IS NULL.
      condition = sql`${column} ${sql.raw(filter.operator)} ${filter.value}`;
    }
    return filter.negate ? sql`not (${condition})` : condition;
  }
  private relationship(catalog: Catalog, table: string, relation: Relation): { fk: ForeignKey; reverse: boolean } {
    const matches = catalog.foreignKeys.filter(fk =>
      ((fk.source === table && fk.target === relation.table) || (fk.target === table && fk.source === relation.table)) &&
      (!relation.hint || fk.name === relation.hint || fk.columns.includes(relation.hint)));
    if (matches.length !== 1) throw new Error(`Missing or ambiguous relationship ${table} -> ${relation.table}`);
    return { fk: matches[0], reverse: matches[0].target === table };
  }
  private relationJoin(catalog: Catalog, table: string, alias: string, relation: Relation, child: string): { condition: SQL; many: boolean } {
    const { fk, reverse } = this.relationship(catalog, table, relation);
    const condition = sql.join(fk.columns.map((column, index) => reverse
      ? sql`${this.column(catalog, table, alias, fk.references[index])} = ${this.column(catalog, relation.table, child, column)}`
      : sql`${this.column(catalog, table, alias, column)} = ${this.column(catalog, relation.table, child, fk.references[index])}`), sql` and `);
    return { condition, many: reverse && !fk.unique };
  }
  private innerPredicates(catalog: Catalog, table: string, alias: string, selection: Selection): SQL[] {
    return selection.relations.filter(relation => relation.inner).map((relation, index) => {
      const child = `${alias}_i${index}`;
      const { condition } = this.relationJoin(catalog, table, alias, relation, child);
      const predicates = [condition, ...this.relationFilters(catalog, relation, child), ...this.innerPredicates(catalog, relation.table, child, relation.selection)];
      return sql`exists (select 1 from public.${identifier(relation.table)} ${identifier(child)} where ${sql.join(predicates, sql` and `)})`;
    });
  }
  private relationFilters(catalog: Catalog, relation: Relation, alias: string): SQL[] {
    return this.filters.filter(filter => filter.column.startsWith(`${relation.key}.`) || filter.column.startsWith(`${relation.table}.`))
      .map(filter => this.predicate(catalog, relation.table, alias, { ...filter, column: filter.column.split(".").slice(1).join(".") }));
  }
  private json(catalog: Catalog, table: string, alias: string, selection: Selection): SQL {
    const parts: SQL[] = [];
    if (selection.fields.includes("*")) parts.push(sql`to_jsonb(${identifier(alias)})`);
    const fields = selection.fields.filter(field => field !== "*");
    if (fields.length) parts.push(sql`jsonb_build_object(${sql.join(fields.flatMap(field => {
      const [key, column] = field.includes(":") ? field.split(":") : [field, field];
      return [sql`${key}::text`, this.column(catalog, table, alias, column)];
    }), sql`, `)})`);
    selection.relations.forEach((relation, index) => {
      const child = `${alias}_r${index}`;
      const { condition, many } = this.relationJoin(catalog, table, alias, relation, child);
      const predicates = [condition, ...this.relationFilters(catalog, relation, child), ...this.innerPredicates(catalog, relation.table, child, relation.selection)];
      const childJson = this.json(catalog, relation.table, child, relation.selection);
      const selected = sql`select ${childJson} as data from public.${identifier(relation.table)} ${identifier(child)} where ${sql.join(predicates, sql` and `)}`;
      const order = this.orderClause(catalog, relation.table, child, this.ordering.filter(item => item.referencedTable === relation.table));
      const value = many ? sql`(select coalesce(jsonb_agg(r.data), '[]'::jsonb) from (${selected}${order}) r)`
        : sql`(${selected}${order} limit 1)`;
      parts.push(sql`jsonb_build_object(${relation.key}::text, ${value})`);
    });
    return parts.length ? sql.join(parts, sql` || `) : sql`'{}'::jsonb`;
  }
  private orderClause(catalog: Catalog, table: string, alias: string, items: Ordering[]): SQL {
    if (!items.length) return sql``;
    return sql` order by ${sql.join(items.map(item => sql`${this.column(catalog, table, alias, item.column)} ${sql.raw(item.ascending ? "asc" : "desc")}`), sql`, `)}`;
  }
  private where(catalog: Catalog, alias: string, selection?: Selection): SQL {
    const predicates = this.filters.filter(filter => !filter.column.includes(".")).map(filter => this.predicate(catalog, this.table, alias, filter));
    for (const group of this.alternatives) predicates.push(sql`(${sql.join(group.map(filter => this.predicate(catalog, this.table, alias, filter)), sql` or `)})`);
    if (selection) predicates.push(...this.innerPredicates(catalog, this.table, alias, selection));
    return predicates.length ? sql` where ${sql.join(predicates, sql` and `)}` : sql``;
  }
  async compile(catalog: Catalog): Promise<{ query: SQL; count?: SQL }> {
    if (!catalog.tables[this.table]) throw new Error(`Unknown table ${this.table}`);
    const table = sql`public.${identifier(this.table)}`;
    const selection = parseSelection(this.selection);
    for (const filter of this.filters.filter(filter => filter.column.includes("."))) {
      const [related, column, extra] = filter.column.split(".");
      const relation = selection.relations.find(item => item.table === related || item.key === related);
      if (!relation || extra || !catalog.tables[relation.table]?.includes(column)) throw new Error("Invalid related-table filter");
    }
    let count: SQL | undefined;
    let query: SQL;
    if (this.operation === "select") {
      const where = this.where(catalog, "t", selection);
      if (this.countRequested) count = sql`select count(*)::int as count from ${table} t${where}`;
      query = sql`select ${this.json(catalog, this.table, "t", selection)} as data from ${table} t${where}${this.orderClause(catalog, this.table, "t", this.ordering.filter(item => !item.referencedTable))}`;
      if (this.rowLimit !== undefined) query = sql`${query} limit ${this.rowLimit}`;
      if (this.offset) query = sql`${query} offset ${this.offset}`;
    } else {
      if ((this.operation === "update" || this.operation === "delete") && !this.filters.length && !this.alternatives.length) throw new Error("Unfiltered mutations are not allowed");
      if (this.operation === "delete") query = sql`delete from ${table} t${this.where(catalog, "t")}`;
      else if (this.operation === "update") {
        const entries = Object.entries(this.values[0]).filter(([, value]) => value !== undefined);
        if (!entries.length) throw new Error("Empty update");
        query = sql`update ${table} t set ${sql.join(entries.map(([key, value]) => {
          this.column(catalog, this.table, "t", key);
          return sql`${identifier(key)} = ${this.value(value)}`;
        }), sql`, `)}${this.where(catalog, "t")}`;
      } else {
        const columns = Array.from(new Set(this.values.flatMap(row => Object.keys(row).filter(key => row[key] !== undefined))));
        if (!this.values.length || !columns.length) throw new Error("Empty insert");
        columns.forEach(column => this.column(catalog, this.table, "t", column));
        const rows = this.values.map(row => sql`(${sql.join(columns.map(column => row[column] === undefined ? sql`default` : this.value(row[column])), sql`, `)})`);
        query = sql`insert into ${table} (${sql.join(columns.map(identifier), sql`, `)}) values ${sql.join(rows, sql`, `)}`;
        if (this.operation === "upsert") {
          this.conflict.forEach(column => this.column(catalog, this.table, "t", column));
          const updates = columns.filter(column => !this.conflict.includes(column));
          query = sql`${query} on conflict (${sql.join(this.conflict.map(identifier), sql`, `)}) ${this.ignoreDuplicates || !updates.length ? sql`do nothing` : sql`do update set ${sql.join(updates.map(column => sql`${identifier(column)} = excluded.${identifier(column)}`), sql`, `)}`}`;
        }
      }
      if (this.returning) query = sql`with mutated as (${query} returning *) select ${this.json(catalog, this.table, "t", selection)} as data from mutated t`;
    }
    return { query, count };
  }
  private value(value: unknown): SQL {
    return value !== null && typeof value === "object" && !(value instanceof Date)
      ? sql`${JSON.stringify(value)}::jsonb` : sql`${value}`;
  }
  private async run(): Promise<QueryResult<any>> {
    try {
      if (["insert", "upsert"].includes(this.operation) && !this.values.length) return { data: this.returning ? [] : null, error: null, count: null };
      const { query, count } = await this.compile(await this.client.catalog());
      // Count and page are returned by one SQL statement and share a snapshot.
      return await this.client.transaction(async client => {
        const countRows = count ? await client.execute(sql`select (${count}) as count,
          ${this.head ? sql`null::jsonb` : sql`(select coalesce(jsonb_agg(page.data),'[]'::jsonb) from (${query}) page)`} as data`) : null;
        const rows: Row[] = countRows ? (countRows[0]?.data ?? []).map((data: Row) => ({ data })) : this.head ? [] : await client.execute(query);
        const data = this.operation !== "select" && !this.returning ? null : rows.map(row => row.data);
        if (this.cardinality && !this.head) {
          if (rows.length > 1 || (rows.length === 0 && this.cardinality === "one")) {
            throw Object.assign(new Error("Expected a single row"), { code: "DB_CARDINALITY" });
          }
          return { data: data?.[0] ?? null, count: countRows?.[0]?.count ?? null, error: null };
        }
        return { data: this.head ? null : data, count: countRows?.[0]?.count ?? null, error: null };
      });
    } catch (error) {
      // Let Next.js request-context/redirect signals reach the renderer.
      const digest = (error as { digest?: string }).digest;
      if (digest === "DYNAMIC_SERVER_USAGE" || digest?.startsWith("NEXT_REDIRECT")) throw error;
      return { data: null, count: null, error: databaseError(error) };
    }
  }
  then<TResult1 = QueryResult<T>, TResult2 = never>(onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    this.promise ??= this.run();
    return this.promise.then(onfulfilled, onrejected);
  }
}
