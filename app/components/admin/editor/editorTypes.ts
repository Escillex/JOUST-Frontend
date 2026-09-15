/** Shared vocabulary of the home page editor's rail ⇄ editor panes. */

/**
 * What the editor pane is showing. The left rail lists these directly, two
 * levels deep (section → part), so every part of the page is one click away —
 * the old single scrolling column put slide 10 several screens down.
 */
export type GroupKey =
  | "hero:tagline"
  | "hero:slides"
  | "hero:buttons"
  | "shop:heading"
  | "shop:products"
  | "tournaments:heading";

export const GROUPS: Record<
  string,
  { key: GroupKey; title: string; hint: string }[]
> = {
  hero: [
    { key: "hero:tagline", title: "Tagline", hint: "The sentence under the logo" },
    { key: "hero:slides", title: "Slides", hint: "Background images in rotation" },
    { key: "hero:buttons", title: "Buttons", hint: "Storefront links" },
  ],
  shop: [
    { key: "shop:heading", title: "Heading", hint: "The marquee band" },
    { key: "shop:products", title: "Products", hint: "The carousel" },
  ],
  tournaments: [
    { key: "tournaments:heading", title: "Heading", hint: "The marquee band" },
  ],
};

export function firstGroupOf(sectionKey: string): GroupKey {
  return GROUPS[sectionKey]?.[0]?.key ?? "hero:tagline";
}

export function sectionOf(group: GroupKey): string {
  return group.split(":")[0];
}

/** Where an image upload is headed. `index` is absent when adding a slide. */
export type HeroUploadTarget =
  | { kind: "slide"; index?: number }
  | { kind: "logo"; index: number };

export function uploadTargetId(target: HeroUploadTarget): string {
  return `${target.kind}:${"index" in target && target.index !== undefined ? target.index : "new"}`;
}

/** Fields are read at a glance by an administrator, not admired: 13px medium
 *  white on near-black inside a grey card, with a placeholder that is still
 *  legible rather than a hint of one. */
export const inputCls =
  "w-full bg-[#0B0B0B] border border-white/25 px-3 py-2.5 text-[13px] text-white font-medium placeholder:text-white/40 focus:outline-none focus:border-primary transition-colors font-questrial";

/** Tracking dropped from 0.3em: letter-spacing that wide is decoration, and at
 *  10px it costs more legibility than it buys. */
export const labelCls =
  "text-[10px] font-black text-white/70 uppercase tracking-[0.18em] block mb-1.5";
