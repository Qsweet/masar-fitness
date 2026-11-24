import { DomainError, type DomainErrorCode } from "@masar/domain";

/** جسم الخطأ الموحّد لكل الواجهات (RFC 9457 — application/problem+json). */
export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  /** مفتاح ثابت تُترجِم الواجهة رسالته؛ لا نص حر من الخادم. */
  readonly code: string;
  readonly field?: string;
  /** يظهر للعميل ويُسجَّل مع الخطأ، ليربط الدعم بلاغ العميل بسجل الخادم. */
  readonly requestId: string;
}

const HTTP_UNPROCESSABLE = 422;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNAUTHENTICATED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL = 500;

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  validation: HTTP_UNPROCESSABLE,
  not_found: HTTP_NOT_FOUND,
  conflict: HTTP_CONFLICT,
  unauthenticated: HTTP_UNAUTHENTICATED,
  forbidden: HTTP_FORBIDDEN,
  invariant: HTTP_INTERNAL,
};

const TITLE_BY_STATUS: Record<number, string> = {
  [HTTP_UNPROCESSABLE]: "Unprocessable Content",
  [HTTP_NOT_FOUND]: "Not Found",
  [HTTP_CONFLICT]: "Conflict",
  [HTTP_UNAUTHENTICATED]: "Unauthorized",
  [HTTP_FORBIDDEN]: "Forbidden",
  [HTTP_INTERNAL]: "Internal Server Error",
};

const INTERNAL_CODE = "internal_error";

function buildProblem(status: number, code: string, requestId: string, field?: string): Problem {
  return {
    type: `urn:masar:problem:${code}`,
    title: TITLE_BY_STATUS[status] ?? "Error",
    status,
    code,
    ...(field === undefined ? {} : { field }),
    requestId,
  };
}

/**
 * يحوّل أي خطأ إلى جسم آمن للعميل.
 * أخطاء العمل المتوقعة تكشف مفتاح سببها؛ كل ما عداها (ومنها خرق الثوابت) يرجع 500 عامًا بلا أي تفصيل داخلي.
 */
export function problemFromError(error: unknown, requestId: string): Problem {
  if (error instanceof DomainError && error.code !== "invariant") {
    return buildProblem(STATUS_BY_CODE[error.code], error.reason, requestId, error.field);
  }
  return buildProblem(HTTP_INTERNAL, INTERNAL_CODE, requestId);
}

export function isServerFault(problem: Problem): boolean {
  return problem.status >= HTTP_INTERNAL;
}

export function problemResponse(problem: Problem): Response {
  return Response.json(problem, {
    status: problem.status,
    headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
  });
}
