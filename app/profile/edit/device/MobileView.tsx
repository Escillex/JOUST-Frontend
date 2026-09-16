"use client";

import { useEffect, useRef, useState } from "react";
import { resolveImageUrl } from "../../../utils/api";
import { formStyles } from "../../../components/profile/formStyles";
import { GROUPS, isSectionKey, renderSection, type SectionContext, type SectionKey } from "../sections";

/**
 * Settings on a phone (under 1024px): a list, and each setting on its own
 * screen — the pattern phone settings apps use, so one form at a time instead
 * of a page of them. The open setting is the URL hash, so the phone's back
 * gesture returns to the list.
 */
export default function MobileView({ ctx, keys, onSignOut }: { ctx: SectionContext; keys: SectionKey[]; onSignOut: () => void }) {
  const read = (): SectionKey | null => {
    const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return isSectionKey(h) && keys.includes(h) ? h : null;
  };
  const [open, setOpen] = useState<SectionKey | null>(read);
  // Whether this page pushed the history entry being viewed, so Back can pop
  // it instead of stacking another.
  const pushed = useRef(false);

  // The back gesture (or button) returns to the list. Browsers report a
  // history step between two hashes as popstate, and some also as hashchange.
  useEffect(() => {
    const onNav = () => {
      setOpen(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("hashchange", onNav);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const show = (k: SectionKey) => {
    pushed.current = true;
    history.pushState(null, "", `#${k}`);
    setOpen(k);
    window.scrollTo(0, 0);
  };

  const back = () => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      history.replaceState(null, "", window.location.pathname);
      setOpen(null);
      window.scrollTo(0, 0);
    }
  };

  if (open) {
    return (
      <div className="w-full px-4 flex flex-col gap-4">
        <button
          type="button"
          onClick={back}
          className="self-start h-11 -ml-1 px-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary font-poppins"
        >
          <span className="text-lg leading-none" aria-hidden="true">‹</span> Settings
        </button>
        {/* The page is still Settings; the setting's own h2 follows. */}
        <h1 className="sr-only">Settings</h1>
        {renderSection(open, ctx)}
      </div>
    );
  }

  const summary = (k: SectionKey): React.ReactNode => {
    if (k === "name") return `@${ctx.user.username}`;
    if (k === "email") return ctx.security?.email ?? null;
    if (k === "games") {
      const g = ctx.user.games ?? [];
      if (g.length === 0) return null;
      return g.length <= 2
        ? g.map((x) => x.name).join(", ")
        : `${g[0].name}, ${g[1].name} +${g.length - 2}`;
    }
    if (k === "security" && ctx.user.googleLinked) {
      return <span className="text-[10px] font-bold uppercase tracking-[0.1em] border border-primary/45 text-primary px-1.5 py-0.5 font-poppins">Google</span>;
    }
    return null;
  };

  return (
    <div className="w-full px-4 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-none font-black uppercase tracking-tight text-white font-poppins">Settings</h1>
        <p className="text-[13px] text-white/70">Your public profile, and the account behind it.</p>
      </div>

      {GROUPS.map((g, gi) => {
        const items = g.items.filter((i) => keys.includes(i.key));
        if (items.length === 0) return null;
        return (
          <div key={gi} className="flex flex-col gap-2.5">
            {g.label && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 font-poppins">{g.label}</p>}
            <ul className="bg-component-background border border-component-border divide-y divide-component-border/60">
              {items.map((i) => (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => show(i.key)}
                    className={`w-full min-h-14 px-4 flex items-center justify-between gap-3 text-left text-[15px] ${i.danger ? "text-[#FF4D4D]" : "text-white"}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {i.key === "picture" && (
                        <span className="relative w-8 h-8 shrink-0 border-2 border-primary overflow-hidden flex items-center justify-center text-primary text-sm font-black font-poppins">
                          {ctx.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveImageUrl(ctx.user.avatarUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            ctx.user.username[0]?.toUpperCase()
                          )}
                        </span>
                      )}
                      {i.label}
                    </span>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-white/60 truncate max-w-[150px]">{summary(i.key)}</span>
                      <span className="text-lg text-white/55 leading-none" aria-hidden="true">›</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <button type="button" onClick={onSignOut} className={`${formStyles.btnSecondary} w-full`}>
        Sign out
      </button>
    </div>
  );
}
