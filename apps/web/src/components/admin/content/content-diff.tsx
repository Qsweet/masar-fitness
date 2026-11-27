import type { ContentChange, SliderChange } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { SliderDiff } from "../slider/slider-diff";
import { DiffList } from "./diff-list";

/** الفرق كاملًا: النصوص مجمّعة بالمساحة، ثم الشريط تحت الواجهة. */
export function ContentDiff({
  changes,
  sliderChanges,
  dictionary,
}: {
  readonly changes: readonly ContentChange[];
  readonly sliderChanges: readonly SliderChange[];
  readonly dictionary: AdminDictionary;
}) {
  return (
    <>
      {changes.length === 0 ? null : <DiffList changes={changes} text={dictionary.content} />}
      {sliderChanges.length === 0 ? null : (
        <SliderDiff
          changes={sliderChanges}
          text={dictionary.slider}
          separator={dictionary.content.listSeparator}
        />
      )}
    </>
  );
}
