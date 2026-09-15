/**
 * The landing page's configurable sections (docs/home-blocks-plan.md).
 *
 * `GET /home` returns every block, in render order, with its editable text and
 * images. The shapes here mirror `server/src/home/home.defaults.ts`; the server
 * is the authority — it whitelists every field it stores — and these types exist
 * so the page and the editor agree on what they are reading.
 */

export const HOME_BLOCK_KEYS = ["hero", "shop", "tournaments"] as const;
export type HomeBlockKey = (typeof HOME_BLOCK_KEYS)[number];

export interface HeroSlideContent {
  image: string;
  title?: string;
  photoDesc?: string;
}

export interface HeroStoreButtonContent {
  text?: string;
  href: string;
  color?: string;
  iconUrl?: string;
  /** Logo size inside the button; 1 = the button's own logo box. */
  iconScale?: number;
}

export interface HeroContent {
  description?: string;
  slides?: HeroSlideContent[];
  storeButtons?: HeroStoreButtonContent[];
}

export interface SectionContent {
  label?: string;
}

export interface HomeBlock {
  key: string;
  order: number;
  visible: boolean;
  content: Record<string, unknown>;
}

/** How each section is named to an administrator, and what it is for. */
export const HOME_BLOCK_LABELS: Record<HomeBlockKey, { title: string; blurb: string }> = {
  hero: {
    title: "Hero",
    blurb: "The opening screen: background slides, the tagline and the storefront buttons.",
  },
  shop: {
    title: "Store",
    blurb: "The product carousel and the marquee heading above it.",
  },
  tournaments: {
    title: "Tournaments",
    blurb: "Upcoming and live events, and the marquee heading above them.",
  },
};

/**
 * What the page renders when the backend cannot be reached. The components keep
 * their own prop defaults as well, so a failed fetch degrades to the shipped
 * page rather than a blank one (Core Rule 8).
 */
export const DEFAULT_HOME_BLOCKS: HomeBlock[] = [
  { key: "hero", order: 0, visible: true, content: {} },
  { key: "shop", order: 1, visible: true, content: { label: "STORE" } },
  { key: "tournaments", order: 2, visible: true, content: { label: "TOURNAMENTS" } },
];

/**
 * Accepts whatever `GET /home` actually returned and always hands back a usable
 * list. Deliberately tolerant of a bare array as well as `{ blocks }`: reading a
 * field off the wrong shape is how the rules editor silently died once before
 * (CLAUDE.md parity table, `configFields`).
 */
export function normalizeHomeConfig(data: unknown): HomeBlock[] {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray((data as { blocks?: unknown } | null)?.blocks)
      ? ((data as { blocks: unknown[] }).blocks)
      : null;
  if (!raw) return DEFAULT_HOME_BLOCKS;

  const blocks = raw
    .filter((b): b is HomeBlock => !!b && typeof (b as HomeBlock).key === "string")
    .map((b, i) => ({
      key: b.key,
      order: typeof b.order === "number" ? b.order : i,
      visible: b.visible !== false,
      content: (b.content ?? {}) as Record<string, unknown>,
    }));

  return blocks.length ? blocks.sort((a, b) => a.order - b.order) : DEFAULT_HOME_BLOCKS;
}

export function heroContentOf(block: HomeBlock | undefined): HeroContent {
  return (block?.content ?? {}) as HeroContent;
}

export function labelOf(block: HomeBlock | undefined, fallback: string): string {
  const label = (block?.content as SectionContent | undefined)?.label;
  return typeof label === "string" && label.trim() ? label : fallback;
}
