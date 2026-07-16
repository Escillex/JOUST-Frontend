"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Tournament } from "../tournaments/types";
import HomeFrame from "./HomeFrame";
import { authenticatedFetch, API_ENDPOINTS, safeJson, resolveImageUrl } from "../utils/api";

interface TournamentPreviewProps {
  tournaments: Tournament[];
}

export default function TournamentPreview({ tournaments = [] }: TournamentPreviewProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        if (res.ok) {
          const data = await safeJson(res);
          setUserId(data?.sub || data?.id);
        }
      } catch (e) {
        console.error("Preview user fetch failed:", e);
      }
    };
    fetchMe();
  }, []);

  const sorted = useMemo(() => {
    return [...tournaments].sort((a, b) => {
      const aJoined = a.participants?.some(p => p.userId === userId);
      const bJoined = b.participants?.some(p => p.userId === userId);

      // 1. Prioritize Joined
      if (aJoined && !bJoined) return -1;
      if (!aJoined && bJoined) return 1;

      // 2. Prioritize OPEN status
      if (a.status === "OPEN" && b.status !== "OPEN") return -1;
      if (a.status !== "OPEN" && b.status === "OPEN") return 1;

      // 3. Sort by Date
      const dateA = a.date ? new Date(a.date).getTime() : Infinity;
      const dateB = b.date ? new Date(b.date).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [tournaments, userId]);

  if (tournaments.length === 0) {
    return (
      <HomeFrame className="py-40">
        <div className="max-w-7xl mx-auto px-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-6xl md:text-[120px] font-black text-white/5 uppercase tracking-tighter italic font-poppins mb-12">
            EMPTY_DATA
          </h2>
          <Link href="/tournaments" className="px-12 py-6 bg-primary text-black font-black text-xl uppercase tracking-widest hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_white] transition-all">
             VIEW ALL TOURNAMENTS
          </Link>
        </div>
      </HomeFrame>
    );
  }

  const featured = sorted[0];
  const others = sorted.slice(1, 4);

  return (
    <HomeFrame className="py-24">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Featured Entry - Neo Brutalist */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-8 group"
          >
            <Link href={`/tournaments/${featured.id}`} className="block relative w-full h-[380px] md:h-auto md:aspect-[16/9] bg-zinc-900 border-4 border-white hover:border-primary hover:shadow-[16px_16px_0px_0px_#52B946] transition-all duration-300 overflow-hidden">
              <img 
                src={resolveImageUrl(featured.bannerUrl, "/placeholder.jpg")}
                alt={featured.name}
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 z-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
              
              <div className="absolute bottom-0 left-0 p-6 sm:p-12 z-20 space-y-4 sm:space-y-6 w-full">
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] sm:text-xs px-4 sm:px-6 py-1.5 sm:py-2 font-black uppercase tracking-widest ${
                    featured.status === "OPEN" ? "bg-primary text-black" : "bg-white text-black"
                  }`}>
                    {featured.status}
                  </span>
                </div>
                
                <h4 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter uppercase text-white leading-none font-poppins break-words line-clamp-2">
                  {featured.name}
                </h4>

                <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-2 sm:pt-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-white/40">Prize Pool</span>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-primary truncate">{featured.prizePool ? `$${featured.prizePool}` : "PRESTIGE"}</span>
                  </div>
                  <div className="hidden sm:block w-px h-12 bg-white/10" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-white/40">Format</span>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                      {((featured.format && typeof featured.format === 'object') ? featured.format.system : "UNKNOWN")?.replace("_", " ") || "UNKNOWN"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute top-10 right-10 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-primary text-black px-10 py-5 font-black text-sm uppercase tracking-widest shadow-[8px_8px_0px_0px_white]">
                  ENTER TOURNAMENT
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Secondary List - Blocky & Clean */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            {others.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={`/tournaments/${t.id}`} className="group block bg-white/5 border-2 border-white/10 hover:border-primary hover:bg-primary/5 hover:shadow-[8px_8px_0px_0px_#52B946] transition-all p-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {t.status}
                    </span>
                    <h5 className="text-2xl font-black uppercase tracking-tighter text-white font-poppins">
                      {t.name}
                    </h5>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">
                      {t.date ? new Date(t.date).toLocaleDateString() : "DATE_PENDING"}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
            
            <motion.div whileHover={{ x: 8 }} className="mt-auto">
              <Link href="/tournaments" className="group py-8 flex items-center justify-center border-4 border-white/10 hover:border-primary hover:bg-primary text-white hover:text-black transition-all">
                <span className="text-xl font-black uppercase tracking-widest">
                  VIEW ALL
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </HomeFrame>
  );
}
