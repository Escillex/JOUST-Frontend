// Friendly auto-generated names for guest participants.
//
// Replaces the old `Guest_4823` style: an "Adjective Animal" pair (e.g.
// "Swift Falcon") reads as a real competitor on a bracket instead of an
// anonymous placeholder, and two guests are far less likely to look alike.
//
// The word lists are deliberately neutral and professional — no cyberpunk /
// combat jargon (project terminology rule). Animals make good, recognisable
// nouns that carry no theme of their own.
//
// Kept in one place because the same generator was copy-pasted into two pages;
// a single source is what stops them drifting apart.

const ADJECTIVES = [
  "Swift", "Brave", "Bright", "Bold", "Calm", "Clever", "Nimble", "Steady",
  "Lucky", "Mighty", "Noble", "Quick", "Sharp", "Sunny", "Keen", "Loyal",
  "Gentle", "Merry", "Proud", "Quiet", "Rapid", "Sturdy", "Vivid", "Witty",
  "Amber", "Azure", "Crimson", "Golden", "Ivory", "Jade", "Scarlet", "Silver",
  "Cosmic", "Distant", "Gallant", "Humble", "Radiant", "Serene", "Spry", "Zesty",
];

const ANIMALS = [
  "Falcon", "Otter", "Panther", "Heron", "Badger", "Lynx", "Marten", "Osprey",
  "Raven", "Stag", "Wren", "Bison", "Cobra", "Dolphin", "Eagle", "Ferret",
  "Gibbon", "Hawk", "Ibis", "Jackal", "Koala", "Lemur", "Mongoose", "Newt",
  "Owl", "Puffin", "Quail", "Rabbit", "Salmon", "Tapir", "Urchin", "Viper",
  "Walrus", "Yak", "Zebra", "Bear", "Crane", "Drake", "Fox", "Gazelle",
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** One "Adjective Animal" name, e.g. "Swift Falcon". */
export function randomGuestName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

/**
 * `count` guest names guaranteed distinct from each other and from `exclude`
 * (existing participant names, matched case-insensitively). Used by batch add,
 * where independent random draws would otherwise collide. If the word-pair pool
 * is exhausted the fallback appends a number ("Swift Falcon 2") so it can never
 * loop forever, while staying inside the 40-char username limit.
 */
export function uniqueGuestNames(
  count: number,
  exclude: Iterable<string> = [],
): string[] {
  const used = new Set<string>();
  for (const name of exclude) used.add(name.toLowerCase());

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = randomGuestName();
    // A handful of retries finds a fresh pair while the pool is far from full;
    // once combinations run low, disambiguate with a counter instead of spinning.
    let attempts = 0;
    while (used.has(name.toLowerCase()) && attempts < 20) {
      name = randomGuestName();
      attempts++;
    }
    if (used.has(name.toLowerCase())) {
      const base = randomGuestName();
      let n = 2;
      name = `${base} ${n}`;
      while (used.has(name.toLowerCase())) {
        n++;
        name = `${base} ${n}`;
      }
    }
    used.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}
