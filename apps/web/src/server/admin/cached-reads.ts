import "server-only";
import { countAwaitingPayment, staffMfaCoverage } from "@masar/db";
import { cache } from "react";
import { backupStatus } from "../backup/status";
import { getDb } from "../db";
import { draftSummary } from "./content/overview";

/**
 * قراءات يطلبها أكثر من مكوّن في الطلب الواحد (الشريط الجانبي والدرج، و«نظرة عامة» وقائمتها وحالة
 * النظام): مخزَّنة لطلب واحد بـ`cache` من React، فتُقرأ مرة لكل طلب لا لكل مكوّن.
 */
export const awaitingPaymentCount = cache(
  (clubId: string): Promise<number> => countAwaitingPayment(getDb(), clubId, new Date()),
);

export const clubDraftSummary = cache((clubId: string) => draftSummary(clubId));

export const clubMfaCoverage = cache((clubId: string) => staffMfaCoverage(getDb(), clubId));

export const currentBackupStatus = cache(() => backupStatus());
