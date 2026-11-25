import Image from "next/image";
import type { LabPlan } from "../data";
import { CLUB_FACTS, FACILITIES } from "../facts";
import type { MoneyParts } from "@/i18n/format";
import { PHOTOS, type LabPhoto } from "../photos";
import { C3 } from "./copy";
import { Configurator } from "./configurator";
import styles from "./c3.module.css";

/** صورة المنتج: جدار المسبح وعليه شعار النادي، أوضح دليل على المكان نفسه. */
export function Hero({ fromPrice }: { readonly fromPrice: MoneyParts | undefined }) {
  return (
    <section id="top" className={styles.hero} aria-labelledby="c3-hero">
      <div className={styles.heroText}>
        <h1 id="c3-hero" className={styles.heroTitle}>
          {C3.hero.title}
        </h1>
        <p className={styles.heroLead}>{C3.hero.lead}</p>
        {fromPrice === undefined ? null : (
          <p className={styles.heroFrom}>
            {C3.hero.from}{" "}
            <strong>
              <bdi>{fromPrice.amount}</bdi> {fromPrice.unit}
            </strong>
          </p>
        )}
        <div className={styles.heroActions}>
          <a href="#buy" className={styles.buttonPrimary}>
            {C3.hero.primary}
          </a>
          <a href="#inside" className={styles.linkArrow}>
            {C3.hero.secondary}
          </a>
        </div>
      </div>
      <figure className={styles.heroImage}>
        <Image
          src={PHOTOS.poolWall.src}
          alt={PHOTOS.poolWall.alt}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 64rem) 58vw, 100vw"
        />
      </figure>
    </section>
  );
}

interface Tile {
  readonly name: string;
  readonly photo: LabPhoto | undefined;
}

/** المرافق كصور منتج: صف يُمرَّر أفقيًا على الجوال وشبكة على الحاسب. ما لا صورة له يُعلَّم صراحةً. */
export function Inside() {
  const photoFor: Record<string, LabPhoto> = {
    [FACILITIES[0]?.name ?? ""]: PHOTOS.benches,
    [FACILITIES[1]?.name ?? ""]: PHOTOS.functional,
    [FACILITIES[2]?.name ?? ""]: PHOTOS.poolMural,
  };
  const tiles: Tile[] = FACILITIES.map((facility) => ({
    name: facility.name,
    photo: photoFor[facility.name],
  }));
  return (
    <section id="inside" className={styles.inside} aria-labelledby="c3-inside">
      <div className={styles.head}>
        <h2 id="c3-inside" className={styles.h2}>
          {C3.inside.title}
        </h2>
        <p className={styles.muted}>{C3.inside.lead}</p>
      </div>
      {/* يُمرَّر أفقيًا على الجوال: قابل للتركيز ليصل إليه مستخدم لوحة المفاتيح */}
      <ul className={styles.tiles} tabIndex={0} aria-label={C3.inside.title}>
        {tiles.map((tile) => (
          <li key={tile.name} className={styles.tile}>
            <div className={styles.tileImage}>
              {tile.photo === undefined ? (
                <span className={styles.tileMissing}>{C3.inside.missing}</span>
              ) : (
                <Image
                  src={tile.photo.src}
                  alt={tile.photo.alt}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 64rem) 20vw, 70vw"
                />
              )}
            </div>
            <p className={styles.tileName}>{tile.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Buy({
  plans,
  best,
}: {
  readonly plans: readonly LabPlan[];
  readonly best: LabPlan | undefined;
}) {
  const initial = best ?? plans[0];
  return (
    <section id="buy" className={styles.buy} aria-labelledby="c3-buy">
      <div className={styles.head}>
        <h2 id="c3-buy" className={styles.h2}>
          {C3.buy.title}
        </h2>
        <p className={styles.muted}>{C3.buy.lead}</p>
      </div>
      {initial === undefined ? (
        <p>{C3.buy.empty}</p>
      ) : (
        <Configurator plans={plans} initialSlug={initial.slug} />
      )}
    </section>
  );
}

/** فصلان متناوبان: صورة ونص، كصفحات المنتجات التي تشرح ميزة في كل فقرة. */
export function Chapters() {
  const photos = [PHOTOS.dumbbell, PHOTOS.ropes];
  return (
    <section className={styles.chapters} aria-label="المرافق بالتفصيل">
      {C3.chapters.map((chapter, index) => {
        const photo = photos[index];
        return (
          <article key={chapter.title} className={styles.chapter}>
            {photo === undefined ? null : (
              <figure className={styles.chapterImage}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 64rem) 50vw, 100vw"
                />
              </figure>
            )}
            <div className={styles.chapterText}>
              <h2 className={styles.h3}>{chapter.title}</h2>
              <p className={styles.muted}>{chapter.text}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function Pool() {
  return (
    <section id="pool" className={styles.pool} aria-labelledby="c3-pool">
      <figure className={styles.poolImage}>
        <Image
          src={PHOTOS.poolSurface.src}
          alt={PHOTOS.poolSurface.alt}
          fill
          placeholder="blur"
          sizes="(min-width: 64rem) 84rem, 100vw"
        />
      </figure>
      <div className={styles.poolText}>
        <h2 id="c3-pool" className={styles.h2}>
          {C3.pool.title}
        </h2>
        <p className={styles.muted}>{C3.pool.lead}</p>
        <p className={styles.poolDistrict}>{CLUB_FACTS.district}</p>
      </div>
    </section>
  );
}
