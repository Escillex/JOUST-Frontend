"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ENDPOINTS, authenticatedFetch, displayNameOf, profileHref, safeJson } from "../../../utils/api";
import type { MatchHistoryGroup, MatchHistoryPage } from "../../../tournaments/types";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import SubpageHeader from "../../../components/profile/SubpageHeader";
import { formatDay, RESULT_CHIP, RESULT_LABEL } from "../../../components/profile/format";
import { formStyles } from "../../../components/profile/formStyles";

/**
 * Every match a person has played, grouped by the tournament it belongs to —
 * the page behind the profile's "View all matches". Tournaments arrive eight
 * at a time, so a long career never lands as one payload.
 */
interface Who {
  id: string;
  username: string;
  displayName?: string | null;
  slug?: string | null;
  avatarUrl?: string | null;
}

export default function MatchesPage() {
  const handle = useParams().id as string;
  const [who, setWho] = useState<Who | null>(null);
  const [groups, setGroups] = useState<MatchHistoryGroup[]>([]);
  const [page, setPage] = useState<MatchHistoryPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.USER_MATCH_HISTORY(handle, offset));
      const data = await safeJson(res);
      if (!res.ok || !data) return null;
      return data as MatchHistoryPage;
    },
    [handle],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profRes, first] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.AUTH.USER_PROFILE(handle)).then(async (r) => (r.ok ? await safeJson(r) : null)),
        load(0),
      ]);
      if (!alive) return;
      if (!profRes || !first) {
        setState("missing");
        return;
      }
      setWho(profRes as Who);
      setGroups(first.groups);
      setPage(first);
      setState("ready");
    })().catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [handle, load]);

  const more = async () => {
    if (page?.nextOffset == null) return;
    setLoadingMore(true);
    setError(null);
    const next = await load(page.nextOffset);
    setLoadingMore(false);
    if (!next) {
      setError("Could not load more. Check the connection and try again.");
      return;
    }
    setGroups((g) => [...g, ...next.groups]);
    setPage(next);
  };

  if (state !== "ready" || !who || !page) {
    return (
      <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
        <p className="w-full max-w-4xl mx-auto px-4 md:px-8 text-sm text-white/60" role="status">
          {state === "missing" ? "No profile at this address." : "Loading matches…"}
        </p>
      </div>
    );
  }

  const played = groups.reduce((n, g) => n + g.matches.length, 0);

  return (
    <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
      <div className="w-full max-w-4xl mx-auto px-4 md:px-8 flex flex-col gap-8">
        <SubpageHeader
          name={displayNameOf(who)}
          avatarUrl={who.avatarUrl}
          href={profileHref(who)}
          title="Matches"
          meta={`${page.totalTournaments} tournament${page.totalTournaments === 1 ? "" : "s"}`}
        />

        {groups.length === 0 ? (
          <p className="bg-component-background border border-component-border py-10 text-center text-sm text-white/60">
            No matches played yet.
          </p>
        ) : (
          <>
            {groups.map((g) => (
              <TournamentGroup key={g.tournament.id} group={g} />
            ))}

            <div className="flex flex-col items-center gap-3">
              {error && <p className={formStyles.error} role="alert">{error}</p>}
              {page.nextOffset != null ? (
                <button type="button" onClick={more} disabled={loadingMore} className={formStyles.btnSecondary}>
                  {loadingMore ? "Loading…" : "Show earlier tournaments"}
                </button>
              ) : (
                <p className="text-xs text-white/55">
                  {played} match{played === 1 ? "" : "es"} across {page.totalTournaments} tournament
                  {page.totalTournaments === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PODIUM: Record<number, string> = {
  1: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300",
  2: "border-[#C9CDD3]/50 bg-[#C9CDD3]/10 text-[#C9CDD3]",
  3: "border-[#C98A4B]/50 bg-[#C98A4B]/10 text-[#D99A5B]",
};

function TournamentGroup({ group }: { group: MatchHistoryGroup }) {
  const { tournament: t } = group;
  const record = group.matches.reduce(
    (acc, m) => ({ ...acc, [m.result]: acc[m.result] + 1 }),
    { win: 0, loss: 0, draw: 0 } as Record<"win" | "loss" | "draw", number>,
  );

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-4 bg-component-background border border-component-border border-b-0 p-4 md:px-5">
        {t.placement && (
          <span
            className={`w-10 h-10 shrink-0 flex items-center justify-center border text-xs font-black font-poppins ${
              PODIUM[t.placement] ?? "border-component-border bg-white/[0.03] text-white/70"
            }`}
            title={`Finished #${t.placement}`}
          >
            #{t.placement}
          </span>
        )}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <h2 className="text-[15px] md:text-base font-semibold font-poppins text-white truncate">
            <Link href={`/tournaments/${t.id}`} className="hover:text-primary transition-colors">{t.name}</Link>
          </h2>
          <p className="text-xs text-white/60 truncate">
            {[t.game, t.format && t.format.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), formatDay(t.date)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-white/70 font-poppins">
          {record.win}–{record.loss}{record.draw ? `–${record.draw}` : ""}
        </span>
      </div>

      <ul className="bg-component-background border border-component-border divide-y divide-component-border/60">
        {group.matches.map((m) => (
          <li key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 md:px-5 py-3">
            <span className="w-full sm:w-36 shrink-0 text-xs text-white/60 capitalize">{m.roundLabel}</span>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <ProfileAvatar name={m.opponent.name} avatarUrl={m.opponent.avatarUrl} className="w-8 h-8 text-xs" />
              <span className="truncate text-[15px] font-semibold font-poppins text-white">
                <span className="text-white/55 font-normal font-sans">vs </span>
                {m.opponent.id ? (
                  <Link href={profileHref(m.opponent)} className="hover:text-primary transition-colors">{m.opponent.name}</Link>
                ) : (
                  m.opponent.name
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-baseline gap-1.5 font-black font-poppins">
                <span className={`text-lg ${m.myScore > m.oppScore ? "text-primary" : "text-white"}`}>{m.myScore}</span>
                <span className="text-xs text-white/55" aria-label="to">–</span>
                <span className={`text-lg ${m.oppScore > m.myScore ? "text-primary" : "text-white"}`}>{m.oppScore}</span>
              </span>
              <span className={`w-14 text-center text-[10px] font-bold uppercase tracking-[0.12em] border py-1 font-poppins ${RESULT_CHIP[m.result]}`}>
                {RESULT_LABEL[m.result]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
