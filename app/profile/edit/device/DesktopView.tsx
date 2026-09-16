"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { profileHref } from "../../../utils/api";
import { formStyles } from "../../../components/profile/formStyles";
import { GROUPS, isSectionKey, renderSection, type SectionContext, type SectionKey } from "../sections";

/**
 * Settings on desktop (1024px and up): a rail of every setting beside one
 * scrolling column — the shape the profile uses. The rail follows the scroll,
 * and a click scrolls to that setting. `#password` in the address opens there.
 */
export default function DesktopView({ ctx, keys }: { ctx: SectionContext; keys: SectionKey[] }) {
  const [active, setActive] = useState<SectionKey>(keys[0]);

  // Arriving with a hash (a link from elsewhere, or a reload) lands on it.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (isSectionKey(h) && keys.includes(h)) {
      requestAnimationFrame(() => document.getElementById(`s-${h}`)?.scrollIntoView({ block: "start" }));
    }
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The highlighted rail item is the section whose top is nearest the top of
  // the window, below the sticky navbar.
  useEffect(() => {
    const els = keys.map((k) => document.getElementById(`s-${k}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.slice(2) as SectionKey);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [keys]);

  const go = (k: SectionKey) => {
    setActive(k);
    document.getElementById(`s-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      history.replaceState(null, "", `#${k}`);
    } catch {}
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-8 flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 border-b border-component-border pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none font-black uppercase tracking-tight text-white font-poppins">Settings</h1>
          <p className="text-sm text-white/70">Your public profile, and the account behind it.</p>
        </div>
        <Link href={profileHref(ctx.user)} className={formStyles.btnSecondary}>View profile</Link>
      </header>

      <div className="grid grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
        <nav aria-label="Settings" className="sticky top-28 bg-component-background border border-component-border py-3 flex flex-col">
          {GROUPS.map((g, gi) => {
            const items = g.items.filter((i) => keys.includes(i.key));
            if (items.length === 0) return null;
            return (
              <div key={gi} className={`flex flex-col ${gi > 0 ? "border-t border-component-border mt-2 pt-2" : ""}`}>
                {g.label && (
                  <p className="px-4 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 font-poppins">{g.label}</p>
                )}
                {items.map((i) => {
                  const on = active === i.key;
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() => go(i.key)}
                      aria-current={on ? "location" : undefined}
                      className={`h-11 px-4 text-left text-sm border-l-2 transition-colors ${
                        on ? "border-primary bg-primary/10 text-white font-semibold font-poppins" : "border-transparent hover:bg-white/[0.03]"
                      } ${i.danger ? "text-[#FF4D4D]" : on ? "" : "text-white/80"}`}
                    >
                      {i.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-12 min-w-0 max-w-3xl">
          {keys.map((k) => (
            <div key={k} id={`s-${k}`} className="scroll-mt-28">
              {renderSection(k, ctx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
