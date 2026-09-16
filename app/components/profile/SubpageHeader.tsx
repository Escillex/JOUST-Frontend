import Link from "next/link";
import ProfileAvatar from "./ProfileAvatar";

/** The top of a profile sub-page (all awards, all matches): the way back, who
 *  it is about, and what the page is. */
export default function SubpageHeader({
  name,
  avatarUrl,
  href,
  title,
  meta,
}: {
  name: string;
  avatarUrl?: string | null;
  /** The profile this page belongs to. */
  href: string;
  title: string;
  meta?: string;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-component-border pb-6">
      <Link
        href={href}
        className="self-start h-11 -ml-1 px-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary font-poppins hover:text-primary-light"
      >
        <span className="text-lg leading-none" aria-hidden="true">‹</span> Back to profile
      </Link>
      <div className="flex items-center gap-4">
        <ProfileAvatar name={name} avatarUrl={avatarUrl} accent className="w-14 h-14 text-2xl" />
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-2xl md:text-3xl leading-none font-black uppercase tracking-tight text-white font-poppins truncate">
            {title}
          </h1>
          <p className="text-sm text-white/70 truncate">
            {name}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
      </div>
    </header>
  );
}
