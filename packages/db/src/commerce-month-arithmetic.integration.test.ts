import { addMonthsClamped, formatPlainDate, plainDate, type PlainDate } from "@masar/domain";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import { testDatabaseUrl } from "./test-support/commerce-orders";

const SAMPLES = 1_000;
const SEED = 20_261_125;
const FIRST_YEAR = 1999;
const YEAR_SPAN = 104;
/** نصف العينات في آخر أيام الشهر حيث يعمل القصّ. */
const MONTH_END_DAYS = [28, 29, 30, 31];
const MAX_MONTHS = 61;

/** مولّد شبه عشوائي ببذرة ثابتة (mulberry32): العينات نفسها في كل تشغيل. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sample(random: () => number): { start: PlainDate; months: number } {
  const year = FIRST_YEAR + Math.floor(random() * YEAR_SPAN);
  const month = 1 + Math.floor(random() * 12);
  const preferred = MONTH_END_DAYS[Math.floor(random() * MONTH_END_DAYS.length)] ?? 1;
  const day = random() < 0.5 ? 1 + Math.floor(random() * 31) : preferred;
  const start = plainDate(year, month, Math.min(day, daysIn(year, month)));
  return { start, months: 1 + Math.floor(random() * MAX_MONTHS) };
}

let db: Db;

beforeAll(() => {
  db = createDb(testDatabaseUrl());
});

afterAll(async () => {
  await db.$disconnect();
});

it("addMonthsClamped يطابق date + make_interval في PostgreSQL لألف مدخل مولّد", async () => {
  const random = mulberry32(SEED);
  const inputs = Array.from({ length: SAMPLES }, () => sample(random));
  const starts = inputs.map((input) => formatPlainDate(input.start));
  const months = inputs.map((input) => input.months);
  const rows = await db.$queryRaw<{ ends_on: string }[]>`
    SELECT (s.start + make_interval(months => s.months))::date::text AS ends_on
    FROM unnest(${starts}::date[], ${months}::int[]) WITH ORDINALITY AS s(start, months, n)
    ORDER BY s.n`;
  const expected = inputs.map((input) =>
    formatPlainDate(addMonthsClamped(input.start, input.months)),
  );
  expect(rows.map((row) => row.ends_on)).toEqual(expected);
  expect(starts.filter((start) => start.endsWith("-31")).length).toBeGreaterThan(SAMPLES / 20);
});
