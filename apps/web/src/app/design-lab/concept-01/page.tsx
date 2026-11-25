import type { Metadata } from "next";
import { Footer, Header, StickyBar } from "@/design-lab/concept-01/chrome";
import { Benefits, Final, Payment, Trust, Visit } from "@/design-lab/concept-01/closing";
import { Plans } from "@/design-lab/concept-01/plans";
import { Gallery, Hero, Pool, Value } from "@/design-lab/concept-01/story";
import styles from "@/design-lab/concept-01/c1.module.css";
import { getLabData } from "@/design-lab/data";
import { cx } from "@/design-lab/cx";
import { alexandria } from "@/design-lab/fonts";

export const metadata: Metadata = { title: "المفهوم 01: الفخامة الرياضية" };

export default async function ConceptOne() {
  const { plans, bestValue, fromPrice } = await getLabData();
  return (
    <div className={cx(styles.page, alexandria.variable)}>
      <Header />
      <main>
        <Hero />
        <Value />
        <Plans plans={plans} />
        <Gallery />
        <Pool />
        <Benefits benefits={bestValue?.benefits ?? plans[0]?.benefits ?? []} />
        <Payment />
        <Trust />
        <Visit />
        <Final />
      </main>
      <Footer />
      <StickyBar fromPrice={fromPrice} />
    </div>
  );
}
