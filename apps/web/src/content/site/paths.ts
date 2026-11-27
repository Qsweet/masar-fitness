import type { Dictionary } from "@/i18n/dictionaries";

/**
 * مسارات القاموس كأنواع حرفية (ADMIN_A3_CONTENT §3.2): مسار خاطئ في قائمة السماح خطأ أنواع لا خلل
 * وقت التشغيل. الفهرس في المصفوفة رقم (`about.paragraphs.0`).
 */
type Segment<K> = K extends string ? K : never;

/** المسار وكل بادئة له: ‎hero‎ و‎hero.title‎ و‎about.features.0.title‎. */
export type PathPrefixes<T> = T extends string
  ? never
  : T extends readonly (infer Item)[]
    ? `${number}` | `${number}.${PathPrefixes<Item>}`
    : {
        [K in keyof T]: Segment<K> | `${Segment<K>}.${PathPrefixes<T[K]>}`;
      }[keyof T];

/** أوراق النص وحدها. */
export type LeafPaths<T> = T extends string
  ? never
  : T extends readonly (infer Item)[]
    ? Item extends string
      ? `${number}`
      : `${number}.${LeafPaths<Item>}`
    : {
        [K in keyof T]: T[K] extends string ? Segment<K> : `${Segment<K>}.${LeafPaths<T[K]>}`;
      }[keyof T];

export type ContentPath = LeafPaths<Dictionary>;
export type ContentPrefix = PathPrefixes<Dictionary>;
