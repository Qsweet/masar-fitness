/**
 * مكتبة الوسائط (ADMIN_A3_SLIDER §6): صف لكل صورة بعد إعادة ترميزها، باسم بصمة بايتاتها. الأصل لا
 * يتغير (C2)، وصورة تستعملها شريحة في المسودة أو أي إصدار لا تُحذف: يفحصها المستودع ويذكر أين تُستعمل،
 * وFK RESTRICT في القاعدة سدّها الأخير. كل كتابة في معاملة مع سطر تدقيقها.
 */
import { randomUUID } from "node:crypto";
import { DomainError, err, ok, type Result, type SlideImage } from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { isUniqueViolation } from "../commerce/sql-errors";
import { ensureTransaction, inTransaction, type Tx } from "../commerce/transaction";
import { lockContent } from "./lock";

export const MEDIA_AUDIT_ACTIONS = ["media_asset_uploaded", "media_asset_deleted"] as const;
const SHA_UNIQUE = "media_assets_club_id_sha256_key";

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
  /** الصورة نفسها رُفعت من قبل: يرجع الأصل القائم ولا يُكتب شيء. */
  readonly existing: boolean;
}

/** يسجّل صورة بعد كتابة ملفاتها؛ البصمة المكررة ترجع الأصل القائم (ومنها رفعان متزامنان). */
export async function createMediaAsset(db: Db, input: NewMediaAsset): Promise<CreatedAsset> {
  const existing = await findAssetByHash(db, input.clubId, input.sha256);
  if (existing !== null) {
    return { asset: existing, existing: true };
  }
  try {
    const asset = await ensureTransaction(db, (tx) => insertAsset(tx, input));
    return { asset, existing: false };
  } catch (error) {
    const raced = isUniqueViolation(error, SHA_UNIQUE)
      ? await findAssetByHash(db, input.clubId, input.sha256)
      : null;
    if (raced === null) {
      throw error;
    }
    return { asset: raced, existing: true };
  }
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

/** صور النادي، الأحدث أولًا، مع استعمال كلٍّ. */
export async function listMediaAssets(db: Db, clubId: string): Promise<MediaListItem[]> {
  const rows = await db.mediaAsset.findMany({
    where: { clubId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return Promise.all(
    rows.map(async (row) => ({ ...assetOf(row), usage: await assetUsage(db, row.id) })),
  );
}

export interface DeleteAssetInput {
  readonly clubId: string;
  readonly assetId: string;
  readonly actor: StaffAuditActor;
  readonly now: Date;
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

/** يحذف صف صورة لا يستعملها شيء (الملفات يحذفها المستدعي بعد النجاح). */
export function deleteMediaAsset(
  db: Db,
  input: DeleteAssetInput,
): Promise<Result<MediaAsset, DomainError>> {
  return inTransaction(db, (tx) => deleteInTransaction(tx, input));
}

/**
 * هل تُخدَّم الصورة للعامة؟ فقط إن كانت في آخر إصدار لنادي الموقع: صورة مسودة أو إصدار سابق لا تُرى
 * من خارج اللوحة.
 */
export async function isPublishedAsset(db: Db, clubId: string, sha256: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ found: number }[]>`
    SELECT 1 AS found FROM content_release_media crm
    JOIN media_assets ma ON ma.id = crm.asset_id
    WHERE ma.club_id = ${clubId}::uuid AND ma.sha256 = ${sha256}
      AND crm.release_id = (SELECT id FROM content_releases WHERE club_id = ${clubId}::uuid
        ORDER BY seq DESC LIMIT 1)
    LIMIT 1`;
  return rows.length > 0;
}
