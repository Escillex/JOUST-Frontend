/**
 * The Edit profile page's controls, shared by its sections so the page reads
 * as one form: 44px controls, 11px floor, secondary text at 55–70% white
 * (the old 20–40% failed contrast).
 */
const btn =
  "h-11 px-6 inline-flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] font-poppins transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export const formStyles = {
  card: "bg-component-background border border-component-border p-5 md:p-6",
  btnPrimary: `${btn} bg-primary text-black hover:bg-primary-light`,
  btnSecondary: `${btn} border border-component-border text-white/85 hover:border-primary/60 hover:text-white`,
  btnDanger: `${btn} border border-[#FF4D4D]/50 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white disabled:hover:bg-transparent disabled:hover:text-[#FF4D4D]`,
  label: "block text-[13px] font-semibold font-poppins text-white",
  help: "text-xs leading-relaxed text-white/60",
  input:
    "w-full h-11 bg-background border border-component-border px-3 text-sm text-white focus:outline-none focus:border-primary placeholder:text-white/40",
  ok: "text-xs text-primary",
  error: "text-xs text-[#FF4D4D]",
} as const;
