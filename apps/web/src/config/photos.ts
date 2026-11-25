import type { StaticImageData } from "next/image";
import benches from "@/assets/photos/gym-benches.jpg";
import curlMachine from "@/assets/photos/gym-curl-machine.jpg";
import dumbbell from "@/assets/photos/gym-dumbbell.jpg";
import functional from "@/assets/photos/gym-functional.jpg";
import ropes from "@/assets/photos/gym-ropes.jpg";
import poolMural from "@/assets/photos/pool-mural.jpg";
import type { Dictionary } from "@/i18n/dictionaries";

export type PhotoKey = keyof Dictionary["photos"];

/**
 * صور حقيقية من داخل النادي أرسلها المالك (2026-11-25). الأصول في docs/design-lab/originals،
 * وهذه نسخ الويب. لا صورة مخزون ولا صورة مولَّدة. النص البديل لكل صورة في القاموس (dictionary.photos).
 */
export const PHOTOS: Readonly<Record<PhotoKey, StaticImageData>> = {
  benches,
  curlMachine,
  dumbbell,
  ropes,
  functional,
  poolMural,
};
