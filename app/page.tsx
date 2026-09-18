import Image from "next/image";
import Hero from "./components/Hero";
import Shop from "./components/Shop";
import TournamentPreview from "./components/TournamentPreview";
import SectionDivider from "./components/SectionDivider";
import FadeIn, { StaggerContainer } from "./components/FadeIn";
import { API_ENDPOINTS, resolveImageUrl } from "./utils/api";
import {
  DEFAULT_HOME_BLOCKS,
  HomeBlock,
  heroContentOf,
  labelOf,
  normalizeHomeConfig,
} from "./utils/homeConfig";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hostIp = process.env.HOST_IP || "localhost";
  const backendPort = process.env.BACKEND_PORT || "4000";
  const backendUrl = process.env.BACKEND_URL || `http://${hostIp}:${backendPort}`;

  let tournaments = [];
  let shopProducts = [];
  // The page's own sections: order, visibility and every piece of editable
  // copy (docs/home-blocks-plan.md). Hero images used to be read straight out
  // of the site-asset list here; they are part of the hero block now, which is
  // what the migration seeded them into.
  let blocks: HomeBlock[] = DEFAULT_HOME_BLOCKS;

  try {
    const [tRes, homeRes, shopRes] = await Promise.all([
      fetch(`${backendUrl}${API_ENDPOINTS.TOURNAMENTS.BASE}`, {
        next: { revalidate: 60 },
      }),
      fetch(`${backendUrl}${API_ENDPOINTS.HOME.CONFIG}`, {
        cache: "no-store",
      }),
      fetch(`${backendUrl}${API_ENDPOINTS.STORE.LIST}`, {
        cache: "no-store",
      }),
    ]);

    if (tRes.ok) {
      const data = await tRes.json();
      // "PENDING" was removed from this filter: it is not a real
      // tournament status (the backend only uses UPCOMING, OPEN,
      // ONGOING and COMPLETED), so checking for it did nothing.
      tournaments = data.filter((t: { status: string }) =>
        t.status === "OPEN" || t.status === "UPCOMING" || t.status === "ONGOING"
      );
    }

    if (homeRes.ok) {
      blocks = normalizeHomeConfig(await homeRes.json());
    }

    if (shopRes.ok) {
      const data = await shopRes.json();
      shopProducts = data
        .filter((p: any) => p.isVisible)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.imageUrl ?? "",
          category: p.category ?? "STORE",
          description: p.description ?? "",
          link: p.link ?? "#",
        }));
    }
  } catch (e) {
    console.error("Failed to fetch landing page data server-side", e);
  }

  const hero = heroContentOf(blocks.find(b => b.key === "hero"));
  const heroSlides = (hero.slides ?? []).filter(s => !!s?.image);
  // The stored buttons carry a logo URL; the button component takes a node, so
  // the image is built here rather than making Hero know about uploads.
  const heroButtons = (hero.storeButtons ?? [])
    .filter(b => !!b?.href)
    .map(b => ({
      text: b.text ?? "",
      href: b.href,
      color: b.color || "#FFFFFF",
      icon: b.iconUrl ? (
        <Image
          src={resolveImageUrl(b.iconUrl)}
          alt={b.text || "Storefront"}
          width={80}
          height={32}
          className="object-contain w-full h-full origin-center"
          style={{ transform: `scale(${b.iconScale ?? 1})` }}
        />
      ) : undefined,
    }));

  const renderBlock = (block: HomeBlock) => {
    if (!block.visible) return null;

    switch (block.key) {
      case "hero":
        return (
          <FadeIn key={block.key}>
            <Hero
              slides={heroSlides.length > 0 ? heroSlides : undefined}
              description={hero.description || undefined}
              storeButtons={heroButtons.length > 0 ? heroButtons : undefined}
            />
          </FadeIn>
        );
      case "shop":
        return (
          <div className="relative" key={block.key}>
            <SectionDivider label={labelOf(block, "STORE")} />
            <FadeIn>
              {/* The real list, even when empty — Shop renders an empty state for that.
                Passing `undefined` here fell back to the sample catalogue, which
                advertised five nonexistent products on a fresh install (9.10). */}
              <Shop products={shopProducts} />
            </FadeIn>
          </div>
        );
      case "tournaments":
        return (
          <div className="relative" key={block.key}>
            <SectionDivider label={labelOf(block, "TOURNAMENTS")} />
            <FadeIn>
              <TournamentPreview tournaments={tournaments} />
            </FadeIn>
          </div>
        );
      default:
        // A block the backend knows about and this build does not. Skipping it
        // is right: a half-rendered section is worse than an absent one.
        return null;
    }
  };

  return (
    <div className="flex flex-col bg-background selection:bg-primary selection:text-black min-h-screen overflow-x-hidden">
      <StaggerContainer>
        {blocks.map(renderBlock)}
      </StaggerContainer>
    </div>
  );
}
