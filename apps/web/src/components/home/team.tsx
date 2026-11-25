import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./team.module.css";

/**
 * صورتان احترافيتان لمدربي النادي، بلا أسماء ولا صفات غير ما يظهر (لم يؤكد المالك أسماء المدربين).
 * الصورتان أفقيتان وتُقصّان عموديًا: موضع القص على المدرب في كل منهما.
 */
const TEAM_PHOTOS: readonly { key: PhotoKey; focus: string }[] = [
  { key: "trainerPortrait", focus: "34% 50%" },
  { key: "coachTalk", focus: "57% 50%" },
];

/**
 * شريط الفريق بدل صف المدربين بأسمائهم: سطر صادق واحد («مدربين معتمدين» كما يقول موقع النادي الحالي)
 * وصورتان من النادي، ورابط إلى برامج التدريب الشخصي.
 */
export function Team({ dictionary }: { readonly dictionary: Dictionary }) {
  const { team, photos } = dictionary;
  return (
    <section className="section" aria-labelledby="team-title">
      <div className={cx("container", styles.inner)}>
        <div className={styles.text}>
          <SectionHead id="team-title" eyebrow={team.eyebrow} title={team.title} start />
          <p className={styles.lead}>{team.lead}</p>
          <ButtonLink href="#services" variant="outline" external>
            {team.action}
            <Icon name="arrow" />
          </ButtonLink>
        </div>
        {TEAM_PHOTOS.map(({ key, focus }) => (
          <figure key={key} className={cx("reveal", styles.photo)}>
            <Image
              src={PHOTOS[key]}
              alt={photos[key]}
              fill
              placeholder="blur"
              sizes="(min-width: 64rem) 30vw, 50vw"
              style={{ objectPosition: focus }}
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
