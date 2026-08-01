/** Placeholder blocks for content that has not arrived yet.
 *
 *  These replace full-screen spinners. A spinner tells the user only "wait";
 *  a skeleton tells them what is coming and lets the page chrome — header,
 *  navigation, back button — render and stay usable immediately. On a slow
 *  connection that is the difference between a page that looks broken and one
 *  that looks busy, and it is why the navigation stays reachable instead of
 *  being hidden behind the load.
 *
 *  Not a client component: these are pure presentation with no hooks, so they
 *  render on the server too. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-white/[0.06] ${className}`}
    />
  );
}

/** A stack of skeleton lines, for list and table regions. */
export function SkeletonRows({
  rows = 5,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** A bordered panel placeholder, matching the panel chrome used across the
 *  organizer console. */
export function SkeletonPanel({
  rows = 4,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-4 border border-white/10 p-5 ${className}`}
    >
      <Skeleton className="h-3 w-32" />
      <SkeletonRows rows={rows} />
    </div>
  );
}

/** Announces to assistive technology that content is loading. Paired with the
 *  visual skeletons, which are aria-hidden. */
export function SkeletonStatus({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}
