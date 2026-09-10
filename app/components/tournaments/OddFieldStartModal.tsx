"use client";

/** What kind of bye problem starting this field creates, or null when it creates
 *  none. Every system is checked (2026-09-10): an earlier version warned only for
 *  Swiss and round robin, on the reasoning that elimination byes are ordinary
 *  bracket padding — but an organizer filling a 6-player single elimination still
 *  deserves to know two people advance without playing.
 *
 *  Note the two systems fail differently, so this is NOT one odd/even test:
 *   - points systems (Swiss, round robin, and HYBRID — whose phase 1 *is* Swiss,
 *     `initHybrid` calls `initSwiss`) pair everyone each round, so only an ODD
 *     field leaves someone out, and it does so every single round;
 *   - elimination needs a power-of-two bracket, so 6 players is even and still
 *     hands out 2 first-round byes.
 *
 *  Shared so the manage page and the bracket page — both of which can start a
 *  tournament — cannot drift apart. */
export interface ByeWarning {
  /** EVERY_ROUND: one player sits out each round. FIRST_ROUND: the bracket is
   *  padded once, at the start. */
  kind: "EVERY_ROUND" | "FIRST_ROUND";
  /** Players entered. */
  count: number;
  /** How many byes are handed out (per round, or in round one). */
  byes: number;
  /** Elimination only: the full bracket size this field is padded up to. */
  bracketSize?: number;
}

const POINTS_SYSTEMS = ["SWISS", "ROUND_ROBIN", "HYBRID"];
const ELIMINATION_SYSTEMS = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"];

export function byeWarningFor(
  system: string | undefined,
  participantCount: number,
): ByeWarning | null {
  if (!system || participantCount < 2) return null;

  if (POINTS_SYSTEMS.includes(system)) {
    return participantCount % 2 === 1
      ? { kind: "EVERY_ROUND", count: participantCount, byes: 1 }
      : null;
  }

  if (ELIMINATION_SYSTEMS.includes(system)) {
    const bracketSize = 2 ** Math.ceil(Math.log2(participantCount));
    const byes = bracketSize - participantCount;
    return byes > 0
      ? { kind: "FIRST_ROUND", count: participantCount, byes, bracketSize }
      : null;
  }

  return null;
}

/** Phrase describing what a bye is worth, matching the configured `byeResult`. */
function byePhrase(byeResult: string): string {
  if (byeResult === "DRAW") return "automatically count as a draw";
  if (byeResult === "NONE") return "score nothing for that player";
  return "automatically count as a win";
}

interface Props {
  warning: ByeWarning;
  byeResult: string;
  isStarting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Inline confirmation shown when an organizer starts a Swiss/round-robin
 *  tournament with an odd field. Not a `window.confirm` (Core Rule 5). */
export default function OddFieldStartModal({
  warning,
  byeResult,
  isStarting,
  onCancel,
  onConfirm,
}: Props) {
  const { kind, count, byes, bracketSize } = warning;
  const title =
    kind === "EVERY_ROUND" ? "Odd number of players" : "Bracket is not full";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#1B1B1B] border border-white/20 rounded max-w-md w-full p-6 space-y-4 shadow-[0_0_40px_rgba(0,0,0,1)]">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-[#F5A623] flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {kind === "EVERY_ROUND" ? (
              <p className="text-[13px] text-[#B0B0B0] leading-relaxed">
                You have <span className="text-white font-semibold">{count}</span>{" "}
                players. In each round one player can&apos;t be paired and receives a{" "}
                <span className="text-white font-semibold">bye</span> — which will{" "}
                {byePhrase(byeResult)}. Add or remove a player for even pairings, or
                start anyway.
              </p>
            ) : (
              <p className="text-[13px] text-[#B0B0B0] leading-relaxed">
                You have <span className="text-white font-semibold">{count}</span>{" "}
                players, which pads up to a{" "}
                <span className="text-white font-semibold">{bracketSize}</span>-player
                bracket.{" "}
                <span className="text-white font-semibold">
                  {byes} {byes === 1 ? "player" : "players"}
                </span>{" "}
                will receive a first-round{" "}
                <span className="text-white font-semibold">bye</span> and advance
                without playing — the top seeds. Add{" "}
                {(bracketSize ?? count) - count} more for a full bracket, or start
                anyway.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isStarting}
            className="flex-1 h-10 text-xs font-semibold border border-white/20 text-[#B0B0B0] hover:text-white transition-colors rounded disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isStarting}
            className="flex-1 h-10 text-xs font-semibold bg-primary text-black rounded hover:brightness-90 transition-colors disabled:opacity-50"
          >
            {isStarting ? "Starting…" : "Start anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
