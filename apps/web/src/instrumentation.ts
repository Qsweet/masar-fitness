/**
 * يُستدعى مرة عند إقلاع الخادم. الفحص في ملف خاص ببيئة Node
 * حتى لا يُحزَم كود Node مع بيئة Edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvAtBoot } = await import("./instrumentation-node");
    assertEnvAtBoot();
  }
}
