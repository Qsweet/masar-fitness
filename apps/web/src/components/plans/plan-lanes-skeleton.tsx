const PLACEHOLDER_LANES = ["a", "b", "c", "d"] as const;

/** هيكل تحميل بنفس إيقاع الحارات، حتى لا يقفز المحتوى عند وصول الباقات. */
export function PlanLanesSkeleton({ label }: { readonly label: string }) {
  return (
    <div role="status" aria-label={label} className="rule border-b">
      {PLACEHOLDER_LANES.map((lane) => (
        <div key={lane} className="rule border-t py-8 md:py-10">
          <div className="flex items-end justify-between gap-6">
            <div className="skeleton h-14 w-28" />
            <div className="skeleton h-10 w-36" />
          </div>
          <div className="skeleton mt-6 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
