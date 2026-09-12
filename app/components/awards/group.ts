import type { UserAward } from "../../tournaments/types";

/** One award as a person holds it: the award itself plus every grant of it.
 *  Repeats are separate grants on the server and a ×N badge on screen. */
export interface AwardGroup {
  awardId: string;
  kind: UserAward["kind"];
  name: string;
  description: string | null;
  imageUrl: string;
  grants: UserAward[];
  /** Pin slot if any grant of this medal is pinned. */
  pinSlot: number | null;
  displayed: boolean;
}

export function groupAwards(awards: UserAward[] = []): AwardGroup[] {
  const byId = new Map<string, AwardGroup>();
  for (const a of awards) {
    const g = byId.get(a.awardId);
    if (g) {
      g.grants.push(a);
      g.pinSlot = g.pinSlot ?? a.pinSlot;
      g.displayed = g.displayed || a.displayed;
    } else {
      byId.set(a.awardId, {
        awardId: a.awardId,
        kind: a.kind,
        name: a.name,
        description: a.description,
        imageUrl: a.imageUrl,
        grants: [a],
        pinSlot: a.pinSlot,
        displayed: a.displayed,
      });
    }
  }
  return [...byId.values()];
}

/** What the header shows: pinned medals in slot order, and the one plaque. */
export function showcaseOf(awards: UserAward[] = []) {
  const groups = groupAwards(awards);
  const pinned = groups
    .filter((g) => g.kind === "MEDAL" && g.pinSlot)
    .sort((a, b) => (a.pinSlot ?? 0) - (b.pinSlot ?? 0));
  const plaque = groups.find((g) => g.kind === "PLAQUE" && g.displayed) ?? null;
  return { pinned, plaque, groups };
}
