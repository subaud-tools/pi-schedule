/**
 * Origin-first delivery ladder — the pure decision that keeps a scheduled job
 * from barging into an arbitrary session when several are open on a project.
 *
 * A due job is evaluated independently inside every live session. This
 * function tells one session what role it should play for that job, using
 * only inputs every session can compute identically (its own id, the job's
 * recorded origin, and the shared live-session set). The runner still holds a
 * single-flight lock as the race backstop; this decision governs *intent*.
 *
 * Ladder:
 *  1. Origin session alive  → that session delivers a full agent turn;
 *                             every other session defers.
 *  2. Origin gone, lone session → full turn (a single session is never the
 *                             confusing case, so it keeps today's behavior).
 *  3. Origin gone, many sessions → every session WAITS: nothing about the job
 *                             reaches any session and its due run is kept
 *                             until rung 1 or 2 applies (or run_now takes it
 *                             over). The runner uses {@link electedSession}
 *                             only to pick the one session that records the
 *                             wait (and runs a shell job's command silently).
 *
 * Determinism matters: because every session sorts the same live set, they
 * all agree on the elected session, so at most one session acts even before
 * the lock.
 */
export type DeliveryRole = "turn" | "wait" | "defer";

export interface DeliveryDecisionInput {
  /** The evaluating session's own id. */
  selfSessionId: string;
  /** The session that created the job, if recorded (legacy rows omit it). */
  originSessionId?: string | null;
  /** Live session ids sharing this job's scope. Self is treated as alive. */
  aliveSessionIds: string[];
}

function aliveSet(input: { selfSessionId: string; aliveSessionIds: string[] }): Set<string> {
  // Self is always alive — presence may not have recorded it yet.
  const alive = new Set(input.aliveSessionIds);
  alive.add(input.selfSessionId);
  return alive;
}

export function decideDelivery(input: DeliveryDecisionInput): DeliveryRole {
  const { selfSessionId, originSessionId } = input;
  const alive = aliveSet(input);

  const originAlive = Boolean(originSessionId) && alive.has(originSessionId as string);
  if (originAlive) {
    return selfSessionId === originSessionId ? "turn" : "defer";
  }

  // Origin absent/dead.
  if (alive.size <= 1) {
    return "turn"; // lone session — not confusing, keep the full turn
  }

  return "wait";
}

/**
 * The one live session (lexicographically smallest id, self included) that
 * does the bookkeeping for a waiting job. Every session computes the same one.
 */
export function electedSession(input: {
  selfSessionId: string;
  aliveSessionIds: string[];
}): string {
  return [...aliveSet(input)].sort()[0] as string;
}
