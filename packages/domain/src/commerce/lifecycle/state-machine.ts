import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";
import type { OpenPolicy } from "./open-policies";

/** صف في جدول آلة حالة. `blockedBy` يعني أن الانتقال موجود لكنه ينتظر قرار المالك. */
export interface Transition<S extends string, E extends string> {
  readonly from: S;
  readonly event: E;
  readonly to: S;
  readonly blockedBy?: OpenPolicy;
}

/** انتقال الإنشاء (صف «—» في جداول التصميم): لا حالة سابقة له. */
export interface InitialTransition<S extends string, E extends string> {
  readonly event: E;
  readonly to: S;
  readonly blockedBy?: OpenPolicy;
}

function undecided(policy: OpenPolicy): DomainError {
  return new DomainError("conflict", `policy.undecided.${policy}`);
}

/**
 * الدالة العامة الوحيدة لكل آلات الحالة.
 * ما ليس في الجدول ⇒ `<machine>.invalid_transition`، والمحجوب ⇒ `policy.undecided.<policy>`.
 */
export function nextState<S extends string, E extends string>(
  machine: string,
  table: readonly Transition<S, E>[],
  from: S,
  event: E,
): Result<S, DomainError> {
  const row = table.find((transition) => transition.from === from && transition.event === event);
  if (row === undefined) {
    return err(new DomainError("conflict", `${machine}.invalid_transition`));
  }
  if (row.blockedBy !== undefined) {
    return err(undecided(row.blockedBy));
  }
  return ok(row.to);
}

/** يقرر انتقال الإنشاء بالقاعدة نفسها: المحجوب يرجع `policy.undecided.<policy>`. */
export function initialState<S extends string, E extends string>(
  transition: InitialTransition<S, E>,
): Result<S, DomainError> {
  if (transition.blockedBy !== undefined) {
    return err(undecided(transition.blockedBy));
  }
  return ok(transition.to);
}
