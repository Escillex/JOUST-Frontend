"use client";

import { useEffect, useRef, useState } from "react";

const DEVICES = {
  desktop: { label: "Desktop", width: 1440 },
  mobile: { label: "Mobile", width: 390 },
} as const;

type DeviceKey = keyof typeof DEVICES;

interface Props {
  /** Bumped by the editor after every save; each change reloads the frame. */
  reloadKey: number;
  onReload: () => void;
}

/**
 * The home page itself, in an iframe.
 *
 * The editor used to preview a hand-built copy of the page, which drifted from
 * the real one and quietly lied about what a change would look like
 * (docs/home-blocks-plan.md). Framing the real route cannot drift: it renders
 * the same components, from the same API, that a visitor gets.
 */
export default function PagePreview({ reloadKey, onReload }: Props) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const paneRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const measure = () =>
      setPane({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = DEVICES[device].width;
  // Never scale above 1:1 — a 390px phone frame blown up to 500px would
  // misrepresent every font size on the page.
  const scale = pane.width ? Math.min(1, pane.width / width) : 1;

  return (
    <div className="flex flex-col h-full bg-[#171717]">
      <div className="h-12 flex items-center justify-between px-4 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/65">
            Live page
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(DEVICES) as DeviceKey[]).map(key => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                device === key ? "bg-primary text-black" : "text-white/65 hover:text-white"
              }`}
            >
              {DEVICES[key].label}
            </button>
          ))}
          <button
            onClick={onReload}
            className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/65 hover:text-white transition-colors"
          >
            Reload
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/65 hover:text-primary transition-colors"
          >
            Open
          </a>
        </div>
      </div>

      <div ref={paneRef} className="flex-1 overflow-hidden relative bg-black">
        {pane.width > 0 && (
          <iframe
            key={reloadKey}
            src={`/?preview=${reloadKey}`}
            title="Home page preview"
            className="border-0 bg-background"
            style={{
              width: `${width}px`,
              height: `${pane.height / scale}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        )}
      </div>

      <p className="px-4 py-2 text-[10px] text-white/45 uppercase tracking-[0.3em] border-t border-white/20 flex-shrink-0">
        {DEVICES[device].label} — {width}px at {Math.round(scale * 100)}%
      </p>
    </div>
  );
}
