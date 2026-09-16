"use client";
import { useEffect, useState } from "react";
import { Game } from "../../tournaments/types";
import { API_ENDPOINTS, authenticatedFetch, safeJson } from "../../utils/api";
import GameIcon from "../ui/GameIcon";

/**
 * Pick the games you play.
 *
 * Shared by the step after signup and the Settings section, so the two can
 * never drift on what the catalog contains or how a choice looks. Controlled:
 * the parent owns the value and decides when to save, because the two callers
 * save at different moments (a Continue button vs. on every toggle).
 */

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** "tiles" for the signup grid, "rows" for the settings list. */
  variant?: "tiles" | "rows";
  disabled?: boolean;
}

export default function GamesPicker({ value, onChange, variant = "tiles", disabled }: Props) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.GAMES.BASE);
        const body = await safeJson(res);
        if (!alive) return;
        if (res.ok && Array.isArray(body)) setGames(body);
        else setFailed(true);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((g) => g !== id) : [...value, id]);
  };

  if (failed) {
    return <p className="text-sm text-white/50 py-6">Couldn&apos;t load the game list.</p>;
  }
  if (!games) {
    return <p className="text-sm text-white/40 py-6">Loading games…</p>;
  }
  if (games.length === 0) {
    return (
      <p className="text-sm text-white/50 py-6">
        No games have been added yet. Once an organizer adds one, you can pick it here.
      </p>
    );
  }

  if (variant === "rows") {
    return (
      <ul className="flex flex-col">
        {games.map((g) => {
          const on = value.includes(g.id);
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                disabled={disabled}
                aria-pressed={on}
                className="w-full flex items-center gap-3 py-3 border-b border-component-border text-left disabled:opacity-50"
              >
                <GameIcon game={g} size="row" />
                <span className="flex-1 text-sm text-white truncate">{g.name}</span>
                <span
                  aria-hidden
                  className={`w-11 h-6 border shrink-0 relative transition-colors ${
                    on ? "border-primary bg-primary/20" : "border-component-border"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] w-[18px] h-[18px] transition-all ${
                      on ? "right-[3px] bg-primary" : "left-[3px] bg-white/30"
                    }`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {games.map((g) => {
        const on = value.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.id)}
            disabled={disabled}
            aria-pressed={on}
            className={`relative flex flex-col items-center gap-2.5 px-2 py-4 border text-center transition-colors disabled:opacity-50 ${
              on
                ? "border-primary bg-primary/10"
                : "border-component-border bg-component-background hover:border-white/30"
            }`}
          >
            {on && (
              <span
                aria-hidden
                className="absolute top-2 right-2 w-[18px] h-[18px] bg-primary flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
            )}
            <GameIcon game={g} size="tile" className={on ? "outline outline-2 outline-primary outline-offset-2" : ""} />
            <span className="text-xs font-semibold text-white leading-tight">{g.name}</span>
          </button>
        );
      })}
    </div>
  );
}
