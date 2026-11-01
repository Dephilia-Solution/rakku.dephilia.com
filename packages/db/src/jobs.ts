import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";

export type JobState = "pending" | "leased" | "done" | "dead_letter";

export interface JobRecord {
  id: string;
  kind: string;
  unique_key: string;
  payload: Record<string, unknown>;
  state: JobState;
  attempts: number;
  max_attempts: number;
  run_at: string;
  lease_until: string | null;
  locked_by: string | null;
  last_error: string | null;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  dead_lettered_at: string | null;
  replayed_at: string | null;
  replay_count: number;
}

export class JobPermanentError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "JobPermanentError";
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(bearer|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]").slice(0, 1000);
}

function job(row: Row): JobRecord {
  return {
    ...(row as JobRecord),
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
    replay_count: Number(row.replay_count),
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

export async function enqueueJob(db: DatabaseClient, input: {
  kind: string;
  uniqueKey: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  runAt?: Date;
  correlationId?: string | null;
}): Promise<{ job: JobRecord; inserted: boolean }> {
  if (!input.kind.trim() || !input.uniqueKey.trim()) throw new Error("Job kind and unique key are required");
  const maxAttempts = input.maxAttempts ?? 8;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) throw new Error("Invalid max attempts");
  const runAt = input.runAt ?? new Date();
  const rows = await db.execute(sql`insert into app_private.job_queue
    (kind, unique_key, payload, max_attempts, run_at, correlation_id)
    values (${input.kind},${input.uniqueKey},${JSON.stringify(input.payload ?? {})}::jsonb,
      ${maxAttempts},${runAt},${input.correlationId ?? null})
    on conflict (kind, unique_key) do nothing returning *`);
  if (rows.length) return { job: job(rows[0]), inserted: true };
  const [existing] = await db.execute(sql`select * from app_private.job_queue
    where kind=${input.kind} and unique_key=${input.uniqueKey}`);
  if (!existing) throw new Error("Job could not be read after enqueue");
  return { job: job(existing), inserted: false };
}

export async function claimJobs(db: DatabaseClient, input: {
  workerId: string;
  limit?: number;
  leaseSeconds?: number;
}): Promise<JobRecord[]> {
  const limit = input.limit ?? 20;
  const leaseSeconds = input.leaseSeconds ?? 60;
  if (!input.workerId.trim() || input.workerId.length > 200) throw new Error("Invalid worker ID");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid job limit");
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 3600) throw new Error("Invalid lease");
  const rows = await db.execute(sql`with due as (
      select id from app_private.job_queue
      where attempts < max_attempts and run_at <= now()
        and (state = 'pending' or (state = 'leased' and lease_until < now()))
      order by run_at, created_at, id
      limit ${limit}
      for update skip locked
    )
    update app_private.job_queue q set state='leased', attempts=q.attempts+1,
      lease_until=now() + ${leaseSeconds} * interval '1 second',
      locked_by=${input.workerId}, updated_at=now()
    from due where q.id=due.id returning q.*`);
  return rows.map(job);
}

export async function completeJob(db: DatabaseClient, jobId: string, workerId: string): Promise<boolean> {
  const rows = await db.execute(sql`update app_private.job_queue
    set state='done', finished_at=now(), lease_until=null, locked_by=null, last_error=null, updated_at=now()
    where id=${jobId} and state='leased' and locked_by=${workerId} returning id`);
  return rows.length === 1;
}

export async function failJob(db: DatabaseClient, input: {
  jobId: string;
  workerId: string;
  error: unknown;
  retryable?: boolean;
  now?: Date;
  jitter?: () => number;
}): Promise<{ failed: boolean; deadLettered: boolean; retryAt: string | null }> {
  const retryable = input.retryable ?? ((input.error as { retryable?: boolean })?.retryable !== false);
  return db.transaction(async tx => {
    const [row] = await tx.execute(sql`select * from app_private.job_queue
      where id=${input.jobId} and state='leased' and locked_by=${input.workerId} for update`);
    if (!row) return { failed: false, deadLettered: false, retryAt: null };
    const attempts = Number(row.attempts);
    const maxAttempts = Number(row.max_attempts);
    const dead = !retryable || attempts >= maxAttempts;
    if (dead) {
      await tx.execute(sql`update app_private.job_queue set state='dead_letter',
        dead_lettered_at=now(), lease_until=null, locked_by=null, last_error=${safeError(input.error)}, updated_at=now()
        where id=${input.jobId}`);
      return { failed: true, deadLettered: true, retryAt: null };
    }
    const base = Math.min(3600, 2 ** Math.min(attempts, 10));
    const jitter = Math.floor(base * 0.2 * Math.max(0, Math.min(1, (input.jitter ?? Math.random)())));
    const retryAt = new Date((input.now ?? new Date()).getTime() + (base + jitter) * 1000);
    await tx.execute(sql`update app_private.job_queue set state='pending', run_at=${retryAt},
      lease_until=null, locked_by=null, last_error=${safeError(input.error)}, updated_at=now()
      where id=${input.jobId}`);
    return { failed: true, deadLettered: false, retryAt: retryAt.toISOString() };
  });
}

export async function replayDeadLetter(db: DatabaseClient, jobId: string): Promise<JobRecord | null> {
  const rows = await db.execute(sql`update app_private.job_queue set state='pending', attempts=0,
    run_at=now(), lease_until=null, locked_by=null, last_error=null,
    replayed_at=now(), replay_count=replay_count+1, dead_lettered_at=null, updated_at=now()
    where id=${jobId} and state='dead_letter' returning *`);
  return rows.length ? job(rows[0]) : null;
}

export async function countJobs(db: DatabaseClient): Promise<{
  pending: number;
  leased: number;
  done: number;
  dead_letter: number;
  due: number;
}> {
  const rows = await db.execute(sql`select state, count(*)::int as count from app_private.job_queue group by state`);
  const counts = { pending: 0, leased: 0, done: 0, dead_letter: 0, due: 0 };
  for (const row of rows) {
    if (row.state in counts) counts[row.state as keyof typeof counts] = Number(row.count);
  }
  const [due] = await db.execute(sql`select count(*)::int as count from app_private.job_queue
    where attempts < max_attempts and run_at <= now()
      and (state='pending' or (state='leased' and lease_until < now()))`);
  counts.due = Number(due?.count ?? 0);
  return counts;
}
