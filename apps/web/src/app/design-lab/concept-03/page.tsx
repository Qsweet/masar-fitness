import type { Metadata } from "next";
import {
  Final,
  Footer,
  Header,
  Payment,
  StickyBar,
  Trust,
  Visit,
} from "@/design-lab/concept-03/closing";
import { Buy, Chapters, Hero, Inside, Pool } from "@/design-lab/concept-03/sections";
import styles from "@/design-lab/concept-03/c3.module.css";
import { cx } from "@/design-lab/cx";
import { getLabData } from "@/design-lab/data";
import { plexArabic } from "@/design-lab/fonts";

export const metadata: Metadata = { title: "المفهوم 03: تجارة اللياقة" };

export default async function ConceptThree() {
  const { plans, bestValue, fromPrice } = await getLabData();
  return (
    <div className={cx(styles.page, plexArabic.variable)}>
      <Header />
      <main>
        <Hero fromPrice={fromPrice} />
        <Inside />
        <Buy plans={plans} best={bestValue} />
        <Chapters />
        <Pool />
        <Payment />
        <Trust />
        <Visit />
        <Final fromPrice={fromPrice} />
      </main>
      <Footer />
      <StickyBar fromPrice={fromPrice} />
    </div>
  );
}
