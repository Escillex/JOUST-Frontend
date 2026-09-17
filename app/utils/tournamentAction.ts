import { Tournament } from "../tournaments/types";
import { displayNameOf } from "./api";
import { formatDay, seatsLeft } from "./tournamentStatus";

/**
 * The one thing a viewer can do about a tournament, and why.
 *
 * This exists because the page used to decide with a six-way ternary that
 * disagreed with the server: it offered "JOIN TOURNAMENT" on an UPCOMING
 * tournament, which `joinTournament` refuses (OPEN only) with "Tournament has
 * already started — registration is closed" — wrong on both counts for an event
 * that has not begun. Its fallback was a grey "REGISTRATION_CLOSED" tile that
 * never said whether the thing was full, started, or not open yet.
 *
 * So: one function, one answer, and it never offers what the API would refuse.
 * The helper line is the part that was missing entirely — a disabled button with
 * no reason is a dead end.
 */

export type ActionTone = "primary" | "neutral" | "ghost" | "disabled";

export interface TournamentAction {
  label: string;
  /** The line under the button. Always says why, never just restates the label. */
  helper?: string;
  href?: string;
  /** Set only for Join, which posts rather than navigates. */
  join?: boolean;
  disabled?: boolean;
  tone: ActionTone;
}

interface Args {
  tournament: Tournament;
  /** Null when signed out. */
  userId?: string | null;
  isJoined: boolean;
}

function seatLine(t: Tournament): string {
  const left = seatsLeft(t);
  const taken = t.participants?.length ?? 0;
  if (left === 0) return `${taken} of ${t.maxPlayers} seats taken`;
  return `${left} of ${t.maxPlayers} seat${left === 1 ? "" : "s"} left`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function actionFor({ tournament: t, userId, isJoined }: Args): TournamentAction {
  // Both surfaces are tabs on the tournament page now (phase 3): the lobby
  // merged into Overview/Players, and the bracket is a tab. next.config still
  // redirects the old routes for links already in the wild.
  const lobby = `/tournaments/${t.id}`;
  const bracket = `/tournaments/${t.id}?tab=bracket`;
  const full = seatsLeft(t) === 0;

  if (t.status === "COMPLETED") {
    const me = userId ? t.participants?.find((p) => p.userId === userId) : undefined;
    const winner = t.winner ? displayNameOf(t.winner) : null;
    return {
      label: "See results",
      helper: me?.placement
        ? `You finished ${ordinal(me.placement)}`
        : winner
          ? `Winner: ${winner}`
          : undefined,
      href: bracket,
      tone: "ghost",
    };
  }

  if (t.status === "ONGOING") {
    if (isJoined) {
      return { label: "Go to lobby", helper: "This tournament is under way", href: lobby, tone: "primary" };
    }
    return {
      label: "Watch bracket",
      helper: "Registration closed when it started",
      href: bracket,
      tone: "ghost",
    };
  }

  // UPCOMING: the server flips it to OPEN once the date passes, so the honest
  // answer is a time, not a refusal.
  if (t.status === "UPCOMING") {
    const day = formatDay(t.date);
    return {
      label: day ? `Registration opens ${day}` : "Registration not open yet",
      helper: `${t.maxPlayers} seats${day ? ` · you can join from ${day}` : ""}`,
      disabled: true,
      tone: "disabled",
    };
  }

  // OPEN — the only status the server accepts a join on.
  if (isJoined) {
    const seat = userId
      ? (t.participants?.findIndex((p) => p.userId === userId) ?? -1) + 1
      : 0;
    return {
      label: "Go to lobby",
      helper: seat > 0 ? `You're in · seat ${seat} of ${t.maxPlayers}` : "You're in",
      href: lobby,
      tone: "primary",
    };
  }

  if (full) {
    return {
      label: "Tournament full",
      helper: `${seatLine(t)} · a seat frees up if someone leaves`,
      disabled: true,
      tone: "disabled",
    };
  }

  if (!userId) {
    return {
      label: "Sign in to join",
      helper: seatLine(t),
      href: "/auth",
      tone: "neutral",
    };
  }

  return { label: "Join tournament", helper: seatLine(t), join: true, tone: "primary" };
}
