import type { Metadata } from "next";
import { Footer, Header, StickyBar } from "@/design-lab/concept-02/chrome";
import { Benefits, Final, Payment, Trust, Visit } from "@/design-lab/concept-02/closing";
import { Plans } from "@/design-lab/concept-02/plans";
import { Hero, Train, Value, Water } from "@/design-lab/concept-02/story";
import styles from "@/design-lab/concept-02/c2.module.css";
import { cx } from "@/design-lab/cx";
import { getLabData } from "@/design-lab/data";
import { alexandria, changa } from "@/design-lab/fonts";

export const metadata: Metadata = { title: "المفهوم 02: ثورة الأداء" };

export default async function ConceptTwo() {
  const { plans, bestValue, fromPrice } = await getLabData();
  return (
    <div className={cx(styles.page, changa.variable, alexandria.variable)}>
      <Header />
      <main>
        <Hero />
        <Value />
        <Plans plans={plans} best={bestValue} />
        <Train />
        <Water />
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
