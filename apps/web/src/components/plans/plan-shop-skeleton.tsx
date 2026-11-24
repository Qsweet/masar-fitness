const PLACEHOLDER_ROWS = ["a", "b", "c", "d"] as const;

/** هيكل تحميل بنفس إيقاع قائمة المدد والملخص، حتى لا يقفز المحتوى عند وصول الباقات. */
export function PlanShopSkeleton({ label }: { readonly label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-6 md:grid-cols-12 md:gap-10">
      <div className="space-y-2 md:col-span-7">
        {PLACEHOLDER_ROWS.map((row) => (
          <div key={row} className="skeleton h-20" />
        ))}
      </div>
      <div className="skeleton h-72 md:col-span-5" />
    </div>
  );
}
