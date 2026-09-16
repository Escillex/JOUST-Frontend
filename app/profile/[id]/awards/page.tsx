"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_ENDPOINTS, authenticatedFetch, displayNameOf, profileHref, safeJson } from "../../../utils/api";
import type { UserAward } from "../../../tournaments/types";
import Medal from "../../../components/awards/Medal";
import Plaque from "../../../components/awards/Plaque";
import { groupAwards, type AwardGroup } from "../../../components/awards/group";
import SubpageHeader from "../../../components/profile/SubpageHeader";
import { formatDay } from "../../../components/profile/format";

/**
 * Every award a person holds — the page behind an award on their profile,
 * which shows only what they pinned. Repeats are one entry with each date and
 * note; the award you clicked is highlighted.
 */
interface Bundle {
  displayName?: string | null;
  username: string;
  slug?: string | null;
  id: string;
  avatarUrl?: string | null;
  awards: UserAward[];
}

export default function AwardsPage() {
  const handle = useParams().id as string;
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.AUTH.USER_PROFILE(handle))
      .then(async (res) => {
        const data = await safeJson(res);
        if (!alive) return;
        if (res.ok && data) {
          setBundle(data as Bundle);
          setState("ready");
          // The award that was clicked, from the link's #award-<id>.
          const id = window.location.hash.startsWith("#award-") ? window.location.hash.slice(7) : "";
          if (id) {
            setTarget(id);
            requestAnimationFrame(() => document.getElementById(`award-${id}`)?.scrollIntoView({ block: "center" }));
          }
        } else {
          setState("missing");
        }
      })
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [handle]);

  if (state !== "ready" || !bundle) {
    return (
      <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
        <p className="w-full max-w-4xl mx-auto px-4 md:px-8 text-sm text-white/60" role="status">
          {state === "missing" ? "No profile at this address." : "Loading awards…"}
        </p>
      </div>
    );
  }

  const groups = groupAwards(bundle.awards);
  const medals = groups.filter((g) => g.kind === "MEDAL");
  const plaques = groups.filter((g) => g.kind === "PLAQUE");
  const name = displayNameOf(bundle);

  return (
    <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
      <div className="w-full max-w-4xl mx-auto px-4 md:px-8 flex flex-col gap-8">
        <SubpageHeader
          name={name}
          avatarUrl={bundle.avatarUrl}
          href={profileHref(bundle)}
          title="Awards"
          meta={`${groups.length} award${groups.length === 1 ? "" : "s"}`}
        />

        {groups.length === 0 ? (
          <p className="bg-component-background border border-component-border py-10 text-center text-sm text-white/60">
            No awards yet.
          </p>
        ) : (
          <>
            {medals.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white font-poppins">Medals</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {medals.map((g) => (
                    <AwardCard key={g.awardId} group={g} highlighted={target === g.awardId}>
                      <Medal name={g.name} imageUrl={g.imageUrl} grants={g.grants} sizeClass="w-20 h-20" showDetail={false} />
                    </AwardCard>
                  ))}
                </ul>
              </section>
            )}

            {plaques.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white font-poppins">Plaques</h2>
                <ul className="flex flex-col gap-4">
                  {plaques.map((g) => (
                    <AwardCard key={g.awardId} group={g} highlighted={target === g.awardId} wide>
                      <Plaque name={g.name} imageUrl={g.imageUrl} size="md" count={g.grants.length} />
                    </AwardCard>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AwardCard({
  group,
  highlighted,
  wide = false,
  children,
}: {
  group: AwardGroup;
  highlighted: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const onProfile = !!group.pinSlot || group.displayed;
  return (
    <li
      id={`award-${group.awardId}`}
      className={`bg-component-background border p-4 md:p-5 flex ${wide ? "flex-col sm:flex-row" : "flex-row"} items-start gap-4 scroll-mt-28 transition-colors ${
        highlighted ? "border-primary" : "border-component-border"
      }`}
    >
      {/* A plaque is a wide strip that sizes from its container, so the cell
          needs a width of its own; a medal is square and does not. */}
      <div className={wide ? "w-full sm:w-[300px] shrink-0" : "shrink-0"}>{children}</div>
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[15px] font-semibold font-poppins text-white">{group.name}</h3>
          {group.grants.length > 1 && (
            <span className="text-[11px] font-bold text-primary font-poppins">×{group.grants.length}</span>
          )}
          {onProfile && (
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] border border-primary/45 text-primary px-1.5 py-0.5 font-poppins">
              On their profile
            </span>
          )}
        </div>
        {group.description && <p className="text-xs leading-relaxed text-white/60">{group.description}</p>}
        <ul className="flex flex-col gap-1">
          {group.grants.map((grant) => (
            <li key={grant.id} className="text-xs text-white/60">
              {formatDay(grant.awardedAt)}
              {grant.note ? ` — ${grant.note}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
