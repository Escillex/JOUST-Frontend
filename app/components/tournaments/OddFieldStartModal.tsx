"use client";

/** True when starting this field will force a bye every round: an odd player count
 *  in a points-scored system (Swiss / round robin). Elimination byes are normal
 *  bracket padding and are not warned about. Shared so the manage page and the
 *  bracket page — both of which can start a tournament — cannot drift apart. */
export function shouldWarnOddField(
  system: string | undefined,
  participantCount: number,
): boolean {
  const pointsSystem = system === "SWISS" || system === "ROUND_ROBIN";
  return pointsSystem && participantCount % 2 === 1;
}

/** Phrase describing what a bye is worth, matching the configured `byeResult`. */
function byePhrase(byeResult: string): string {
  if (byeResult === "DRAW") return "automatically count as a draw";
  if (byeResult === "NONE") return "score nothing for that player";
  return "automatically count as a win";
}

interface Props {
  count: number;
  byeResult: string;
  isStarting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Inline confirmation shown when an organizer starts a Swiss/round-robin
 *  tournament with an odd field. Not a `window.confirm` (Core Rule 5). */
export default function OddFieldStartModal({
  count,
  byeResult,
  isStarting,
  onCancel,
  onConfirm,
}: Props) {
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
            <h3 className="text-sm font-semibold text-white">
              Odd number of players
            </h3>
            <p className="text-[13px] text-[#B0B0B0] leading-relaxed">
              You have <span className="text-white font-semibold">{count}</span>{" "}
              players. In each round one player can&apos;t be paired and receives a{" "}
              <span className="text-white font-semibold">bye</span> — which will{" "}
              {byePhrase(byeResult)}. Add or remove a player for even pairings, or
              start anyway.
            </p>
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
