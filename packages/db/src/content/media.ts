/**
 * مكتبة الوسائط (ADMIN_A3_SLIDER §6): صف لكل صورة بعد إعادة ترميزها، باسم بصمة بايتاتها. الأصل لا
 * يتغير (C2)، وصورة تستعملها شريحة في المسودة أو أي إصدار لا تُحذف: يفحصها المستودع ويذكر أين تُستعمل،
 * وFK RESTRICT في القاعدة سدّها الأخير. كل كتابة في معاملة مع سطر تدقيقها.
 */
import { randomUUID } from "node:crypto";
import { DomainError, err, ok, type Result, type SlideImage } from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { ensureTransaction, inTransaction, type Tx } from "../commerce/transaction";
import { lockContent } from "./lock";

export const MEDIA_AUDIT_ACTIONS = ["media_asset_uploaded", "media_asset_deleted"] as const;

export interface MediaAsset extends SlideImage {
  readonly bytes: number;
  readonly originalName: string;
  readonly createdAt: Date;
}

interface AssetRow {
  readonly id: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly variantWidths: number[];
  readonly blurDataUrl: string;
  readonly dominantColor: string;
  readonly originalName: string;
  readonly createdAt: Date;
}

export function assetOf(row: AssetRow): MediaAsset {
  return {
    id: row.id,
    hash: row.sha256,
    width: row.width,
    height: row.height,
    widths: row.variantWidths,
    blur: row.blurDataUrl,
    color: row.dominantColor,
    bytes: row.bytes,
    originalName: row.originalName,
    createdAt: row.createdAt,
  };
}

export interface NewMediaAsset {
  readonly clubId: string;
  readonly staffId: string;
  readonly actor: StaffAuditActor;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly variantWidths: readonly number[];
  readonly blurDataUrl: string;
  readonly dominantColor: string;
  readonly originalName: string;
  readonly now: Date;
}

export async function findAssetByHash(
  db: Db | Tx,
  clubId: string,
  sha256: string,
): Promise<MediaAsset | null> {
  const row = await db.mediaAsset.findUnique({ where: { clubId_sha256: { clubId, sha256 } } });
  return row === null ? null : assetOf(row);
}

export async function findAsset(
  db: Db | Tx,
  clubId: string,
  id: string,
): Promise<MediaAsset | null> {
  const row = await db.mediaAsset.findFirst({ where: { id, clubId } });
  return row === null ? null : assetOf(row);
}

async function insertAsset(tx: Tx, input: NewMediaAsset): Promise<MediaAsset> {
  const row = await tx.mediaAsset.create({
    data: {
      id: randomUUID(),
      clubId: input.clubId,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      bytes: input.bytes,
      variantWidths: [...input.variantWidths],
      blurDataUrl: input.blurDataUrl,
      dominantColor: input.dominantColor,
      originalName: input.originalName,
      createdBy: input.staffId,
      createdAt: input.now,
    },
  });
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "media_asset",
    entityId: row.id,
    action: "media_asset_uploaded",
    fromState: null,
    toState: null,
    actor: input.actor,
    data: { width: row.width, height: row.height, bytes: row.bytes },
    at: input.now,
  });
  return assetOf(row);
}

export interface CreatedAsset {
  readonly asset: MediaAsset;
  /** الصورة نفسها رُفعت من قبل: يرجع الأصل القائم ولا يُكتب صف. */
  readonly existing: boolean;
}

/**
 * يضمن ملفات الأصل على القرص تحت القفل نفسه: يكتبها لأصل جديد، ويصلحها لأصل قائم ناقص الملفات. يرميه
 * المستدعي (الويب) لأن القرص خارج القاعدة.
 */
export type EnsureFiles = (existing: MediaAsset | null) => Promise<void>;

/**
 * يسجّل صورة تحت قفل محتوى النادي: فحص البصمة، والملفات، والصف في معاملة واحدة، فلا يتقاطع رفع مع حذف
 * الصورة نفسها (الحذف يأخذ القفل نفسه ويحذف ملفاته قبل أن يتركه). البصمة المكررة ترجع الأصل القائم بعد
 * إصلاح ملفاته إن نقصت.
 */
export function createMediaAsset(
  db: Db,
  input: NewMediaAsset,
  ensureFiles: EnsureFiles,
): Promise<CreatedAsset> {
  return ensureTransaction(db, async (tx) => {
    await lockContent(tx, input.clubId);
    const existing = await findAssetByHash(tx, input.clubId, input.sha256);
    await ensureFiles(existing);
    return existing === null
      ? { asset: await insertAsset(tx, input), existing: false }
      : { asset: existing, existing: true };
  });
}

export interface AssetUsage {
  /** مواضع الشرائح في المسودة التي تستعمله (من الصفر). */
  readonly draftSlides: readonly number[];
  /** أرقام الإصدارات التي دخلها. */
  readonly releases: readonly number[];
}

export async function assetUsage(db: Db | Tx, assetId: string): Promise<AssetUsage> {
  const [slides, releases] = await Promise.all([
    db.contentSlide.findMany({
      where: { OR: [{ desktopAssetId: assetId }, { mobileAssetId: assetId }] },
      select: { position: true },
      orderBy: { position: "asc" },
    }),
    db.contentReleaseMedia.findMany({
      where: { assetId },
      select: { release: { select: { seq: true } } },
      orderBy: { release: { seq: "asc" } },
    }),
  ]);
  return {
    draftSlides: slides.map((slide) => slide.position),
    releases: releases.map((row) => row.release.seq),
  };
}

export function isUnused(usage: AssetUsage): boolean {
  return usage.draftSlides.length === 0 && usage.releases.length === 0;
}

export interface MediaListItem extends MediaAsset {
  readonly usage: AssetUsage;
}

export interface MediaPage {
  readonly items: readonly MediaListItem[];
  readonly total: number;
}

interface ListedRow extends AssetRow {
  readonly draftSlides: number[];
  readonly releases: number[];
}

/** صور النادي، الأحدث أولًا، بصفحات، واستعمال كلٍّ في الاستعلام نفسه (لا استعلام لكل صورة). */
export async function listMediaAssets(
  db: Db,
  clubId: string,
  page: { readonly offset: number; readonly limit: number },
): Promise<MediaPage> {
  const [rows, total] = await Promise.all([
    db.$queryRaw<ListedRow[]>`
      SELECT ma.id::text AS id, ma.sha256, ma.width, ma.height, ma.bytes,
        ma.variant_widths AS "variantWidths", ma.blur_data_url AS "blurDataUrl",
        ma.dominant_color AS "dominantColor", ma.original_name AS "originalName",
        ma.created_at AS "createdAt",
        ARRAY(SELECT s.position FROM content_slides s
          WHERE s.desktop_asset_id = ma.id OR s.mobile_asset_id = ma.id ORDER BY s.position)
          AS "draftSlides",
        ARRAY(SELECT r.seq FROM content_release_media crm
          JOIN content_releases r ON r.id = crm.release_id
          WHERE crm.asset_id = ma.id ORDER BY r.seq) AS releases
      FROM media_assets ma WHERE ma.club_id = ${clubId}::uuid
      ORDER BY ma.created_at DESC, ma.id LIMIT ${page.limit} OFFSET ${page.offset}`,
    db.mediaAsset.count({ where: { clubId } }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      ...assetOf(row),
      usage: { draftSlides: row.draftSlides, releases: row.releases },
    })),
  };
}

/** صور النادي لمنتقي الشريحة (بلا الاستعمال)، الأحدث أولًا، حتى `limit`. */
export async function listMediaImages(
  db: Db,
  clubId: string,
  limit: number,
): Promise<MediaAsset[]> {
  const rows = await db.mediaAsset.findMany({
    where: { clubId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map(assetOf);
}

export interface DeleteAssetInput {
  readonly clubId: string;
  readonly assetId: string;
  readonly actor: StaffAuditActor;
  readonly now: Date;
  /**
   * يحذف ملفات الأصل وهو تحت القفل، قبل أن يتركه: رفع الصورة نفسها ينتظر القفل، فيجد الصف والملفات
   * محذوفين معًا. فشل نادر بعده يترك صفًا بلا ملفات يصلحه أول رفع للصورة نفسها.
   */
  readonly removeFiles: (asset: MediaAsset) => Promise<void>;
}

async function deleteInTransaction(
  tx: Tx,
  input: DeleteAssetInput,
): Promise<Result<MediaAsset, DomainError>> {
  // قفل المحتوى: لا تُضاف شريحة بالصورة ولا تُنشر بين الفحص والحذف
  await lockContent(tx, input.clubId);
  const asset = await findAsset(tx, input.clubId, input.assetId);
  if (asset === null) {
    return err(new DomainError("not_found", "media.not_found"));
  }
  if (!isUnused(await assetUsage(tx, asset.id))) {
    return err(new DomainError("conflict", "media.in_use"));
  }
  await tx.mediaAsset.delete({ where: { id: asset.id } });
  await input.removeFiles(asset);
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "media_asset",
    entityId: asset.id,
    action: "media_asset_deleted",
    fromState: null,
    toState: null,
    actor: input.actor,
    data: { width: asset.width, height: asset.height, bytes: asset.bytes },
    at: input.now,
  });
  return ok(asset);
}

/** يحذف صورة لا يستعملها شيء: الصف وملفاتها تحت قفل المحتوى. */
export function deleteMediaAsset(
  db: Db,
  input: DeleteAssetInput,
): Promise<Result<MediaAsset, DomainError>> {
  return inTransaction(db, (tx) => deleteInTransaction(tx, input));
}
