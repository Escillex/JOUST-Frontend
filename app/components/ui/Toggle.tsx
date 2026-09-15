"use client";

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  /** What the control does, for screen readers and the hover tooltip. */
  ariaLabel: string;
  /** Optional words beside the switch — use where the row has space for them. */
  label?: string;
  disabled?: boolean;
  /** `sm` fits a 44px list row; `md` matches the switches on the manage pages. */
  size?: "sm" | "md";
  title?: string;
}

const SIZES = {
  sm: { track: "w-8 h-[18px]", knob: "w-3.5 h-3.5", on: "left-[16px]", off: "left-0.5" },
  md: { track: "w-9 h-5", knob: "w-4 h-4", on: "left-[18px]", off: "left-0.5" },
};

/**
 * An on/off switch. Visibility is a state, not a verb, so it reads as a switch
 * rather than a word that has to be interpreted — the same shape already used
 * for the build-requirement switches on the manage page.
 */
export default function Toggle({
  checked,
  onChange,
  ariaLabel,
  label,
  disabled,
  size = "sm",
  title,
}: Props) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      {label && (
        <span
          className={`text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
            checked ? "text-primary" : "text-white/55 group-hover:text-white/80"
          }`}
        >
          {label}
        </span>
      )}
      <span
        className={`shrink-0 ${s.track} rounded-full relative transition-colors ${
          checked ? "bg-primary" : "bg-white/25 group-hover:bg-white/40"
        }`}
      >
        <span
          className={`absolute top-0.5 ${s.knob} rounded-full bg-black transition-all ${
            checked ? s.on : s.off
          }`}
        />
      </span>
    </button>
  );
}
