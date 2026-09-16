import type { ProfileStats } from "../../tournaments/types";

/**
 * A person's record in one strip: five cells in a row on desktop, a 3 + 2 grid
 * on a phone. Replaces StatsGrid, whose six tiles in a four-column grid left a
 * half-empty second row.
 *
 * There is no Rank cell: the only cross-game ranking is the combined
 * leaderboard, which the backend keeps admin-only, so a public profile has no
 * rank to show.
 */
export default function StatsStrip({ stats, compact = false }: { stats: ProfileStats; compact?: boolean }) {
  const cells = [
    { label: "Points", value: String(stats.points) },
    { label: "Win rate", value: `${Math.round(stats.winRate * 100)}%`, accent: true },
    { label: "Record W–L–D", value: `${stats.wins}–${stats.losses}–${stats.draws}` },
    { label: "Tournaments", value: String(stats.tournamentsPlayed) },
    { label: "Titles", value: String(stats.tournamentsWon) },
  ];

  const cell = (c: (typeof cells)[number], className: string) => (
    <div key={c.label} className={`flex flex-col gap-2 min-w-0 ${className}`}>
      <dt className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.08em] xl:tracking-[0.12em] text-white/55 font-poppins truncate">
        {c.label}
      </dt>
      <dd className={`text-2xl md:text-[32px] leading-none font-black font-poppins ${c.accent ? "text-primary" : "text-white"}`}>
        {c.value}
      </dd>
    </div>
  );

  if (compact) {
    // The two long labels get the two-wide row; a third of a phone cuts
    // "Record W–L–D" and "Tournaments".
    const [points, winRate, record, played, titles] = cells;
    return (
      <dl className="bg-component-background border border-component-border">
        <div className="grid grid-cols-3 divide-x divide-component-border">
          {[points, winRate, titles].map((c) => cell(c, "px-4 py-3.5"))}
        </div>
        <div className="grid grid-cols-2 divide-x divide-component-border border-t border-component-border">
          {[record, played].map((c) => cell(c, "px-4 py-3.5"))}
        </div>
      </dl>
    );
  }

  return (
    <dl className="grid grid-cols-5 divide-x divide-component-border bg-component-background border border-component-border">
      {cells.map((c) => cell(c, "px-3 min-[1180px]:px-4 xl:px-6 py-5"))}
    </dl>
  );
}
