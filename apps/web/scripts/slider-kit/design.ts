/**
 * يصمم صور عدّة الشريط من صور النادي الحقيقية: `pnpm --filter @masar/web slider:design`
 * (docs/SLIDER_KIT.md §2). حتمي: التكوينات والبذور ثابتة، فإعادة التشغيل تكتب الملفات نفسها. الناتج في
 * `src/assets/slider-kit/` ويدخل git وصورة Docker، ويستورده الأمر `slider:launch-kit` بخط الرفع نفسه.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { kitImageFile, SLIDE_KIT_DIR } from "../../src/content/slider-kit/kit";
import { COMPOSITIONS } from "./compositions";
import { renderLayout, type Target } from "./render";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** الحاسوب 21:9 حتى 2560 بكسل (عرض الإطار 1280 بكثافة 2)، والهاتف 4:5 حتى 1280. */
const RATIO = { desktopW: 21, desktopH: 9, mobileW: 4, mobileH: 5 };
const DESKTOP: Target = { aspect: RATIO.desktopW / RATIO.desktopH, maxWidth: 2_560 };
const MOBILE: Target = { aspect: RATIO.mobileW / RATIO.mobileH, maxWidth: 1_280 };
const KIB = 1_024;

async function main(): Promise<void> {
  const out = join(WEB_ROOT, SLIDE_KIT_DIR);
  await mkdir(out, { recursive: true });
  for (const composition of COMPOSITIONS) {
    const look = { grade: composition.grade, seed: composition.seed };
    for (const [kind, layout, target] of [
      ["desktop", composition.desktop, DESKTOP],
      ["mobile", composition.mobile, MOBILE],
    ] as const) {
      const image = await renderLayout(WEB_ROOT, layout, target, look);
      const file = kitImageFile(composition.id, kind);
      await writeFile(join(out, file), image.bytes);
      process.stdout.write(
        `${file}: ${String(image.width)}×${String(image.height)}, ${String(Math.round(image.bytes.length / KIB))} KB\n`,
      );
    }
  }
}

await main();
