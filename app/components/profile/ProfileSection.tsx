import React from "react";

/** The one heading pattern every profile section uses: icon, h2, count. */
export default function ProfileSection({
  title,
  icon,
  meta,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  /** Right-hand count, e.g. "15 recent". */
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-lg md:text-xl font-black uppercase tracking-[0.08em] text-white font-poppins">
          <span className="text-primary" aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 font-poppins">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

const svg = "w-5 h-5";
export const Icons = {
  matches: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20v-9M10 20V4M16 20v-7M2 20h20" /></svg>
  ),
  tournaments: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M6 3h12v5a6 6 0 0 1-12 0V3z" /><path d="M6 5H3v2a4 4 0 0 0 3 3.87M18 5h3v2a4 4 0 0 1-3 3.87" /></svg>
  ),
  awards: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6" /><path d="M8.5 14 7 22l5-3 5 3-1.5-8" /></svg>
  ),
  gallery: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" /><path d="m3 16 5-5 4 4 3-3 6 6" /></svg>
  ),
  picture: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" /><circle cx="12" cy="10" r="3" /><path d="M7 21v-1a5 5 0 0 1 10 0v1" /></svg>
  ),
  about: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
  ),
  link: (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
  ),
  edit: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
  ),
};
