import { Metadata } from "next";
import Hero from "./components/Hero";
import Shop from "./components/Shop";
import TournamentPreview from "./components/TournamentPreview";
import SectionDivider from "./components/SectionDivider";
import Footer from "./components/Footer";
import FadeIn, { StaggerContainer } from "./components/FadeIn";
import { API_ENDPOINTS } from "./utils/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hostIp = process.env.HOST_IP || "localhost";
  const backendPort = process.env.BACKEND_PORT || "4000";
  const backendUrl = process.env.BACKEND_URL || `http://${hostIp}:${backendPort}`;

  let tournaments = [];
  let heroSlides = [];
  let shopProducts = [];

  try {
    const [tRes, heroRes, shopRes] = await Promise.all([
      fetch(`${backendUrl}${API_ENDPOINTS.TOURNAMENTS.BASE}`, {
        next: { revalidate: 60 },
      }),
      fetch(`${backendUrl}${API_ENDPOINTS.IMAGES.LIST_ASSETS}`, {
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

    if (heroRes.ok) {
      const data = await heroRes.json();
      const heroAssets = data.filter((a: any) => a.key.startsWith("hero_slide_"));
      heroSlides = heroAssets
        .sort((a: any, b: any) => a.key.localeCompare(b.key))
        .map((a: any) => ({
          image: a.url,
          title: "LIVE EVENT CYCLE",
          photoDesc: a.key.toUpperCase(),
        }));
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

  return (
    <div className="flex flex-col bg-background selection:bg-primary selection:text-black min-h-screen overflow-x-hidden">
      <StaggerContainer>
        {/* Rhythmic Landing Sequence */}
        <FadeIn>
          <Hero slides={heroSlides.length > 0 ? heroSlides : undefined} />
        </FadeIn>

        <div className="relative">
          {/* Section 01 // STORE */}
          <SectionDivider label="STORE" />
          <FadeIn>
            {/* The real list, even when empty — Shop renders an empty state for that.
              Passing `undefined` here fell back to the sample catalogue, which
              advertised five nonexistent products on a fresh install (9.10). */}
            <Shop products={shopProducts} />
          </FadeIn>

          {/* Section 02 // TOURNAMENTS */}
          <SectionDivider label="TOURNAMENTS" />
          <FadeIn>
            <TournamentPreview tournaments={tournaments} />
          </FadeIn>
        </div>

        <Footer />
      </StaggerContainer>
    </div>
  );
}
