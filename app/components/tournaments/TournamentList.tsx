"use client";

import React from "react";
import Link from "next/link";
import * as m from "motion/react";
import { BentoBox } from "../ui/Bento";
import { Tournament } from "../../tournaments/types";
import { API_URL } from "../../utils/api";

interface TournamentListProps {
  tournaments: Tournament[];
  variant?: "default" | "bento";
  limit?: number;
  canManage?: boolean;
  currentUserId?: string;
}

export default function TournamentList({ tournaments, variant = "default", limit, canManage, currentUserId }: TournamentListProps) {
  const displayTournaments = limit ? tournaments.slice(0, limit) : tournaments;
  const sorted = variant === "bento" ? displayTournaments : [...displayTournaments].sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const mouseX = m.useMotionValue(0);
  const mouseY = m.useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const next = () => setCurrentIndex((prev) => (prev + 1) % sorted.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + sorted.length) % sorted.length);

  const rotateX = m.useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = m.useTransform(mouseX, [-500, 500], [-10, 10]);

  const currentTournament = sorted[currentIndex];
  const isJoined = currentUserId && currentTournament?.participants?.some(p => p.userId === currentUserId);

  const content = (
    <div 
      className={`flex flex-col h-full text-white relative group/container overflow-hidden transition-all duration-700 ${
        isJoined ? "bg-primary/5 shadow-[inset_0_0_50px_rgba(82,185,70,0.05)]" : "bg-surface"
      }`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
    >
      {variant === "bento" && (
        <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${isJoined ? "bg-primary/10 border-primary/20" : "bg-surface/30 border-white/5"}`}>
          <div className="flex items-center gap-6">
            <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] font-poppins transition-colors ${isJoined ? "text-primary" : "text-white/40"}`}>
              {isJoined ? "MY TOURNAMENTS" : "Active Tournaments"}
            </h3>
            {canManage && (
              <Link 
                href="/tournaments/manage" 
                className="bg-white text-black px-4 py-1.5 text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-colors"
              >
                MANAGE TOURNAMENTS
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={prev}
              className="w-8 h-8 border border-white/10 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary transition-all bg-[#1B1B1B]"
            >
              ←
            </button>
            <button 
              onClick={next}
              className="w-8 h-8 border border-white/10 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary transition-all bg-[#1B1B1B]"
            >
              →
            </button>
          </div>
        </div>
      )}

      <div className="relative flex-1">
        <m.AnimatePresence mode="wait">
          {sorted.length > 0 && (
            <m.motion.div
              key={currentTournament.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) prev();
                else if (info.offset.x < -100) next();
              }}
              className="h-full w-full grid grid-cols-1 md:grid-cols-2 cursor-grab active:cursor-grabbing"
            >
              {/* Image Side - Isolated Parallax */}
              <div className={`relative h-full overflow-hidden border-r bg-[#1B1B1B] group transition-colors duration-500 ${isJoined ? "border-primary/20" : "border-white/5"}`}>
                <m.motion.div 
                  className="absolute inset-0"
                  style={{ 
                    rotateX, 
                    rotateY, 
                    perspective: 1000,
                    transformStyle: "preserve-3d"
                  }}
                >
                  <img 
                    src={currentTournament.bannerUrl 
                      ? (currentTournament.bannerUrl.startsWith("http") ? currentTournament.bannerUrl : `${API_URL}${currentTournament.bannerUrl}`)
                      : "/placeholder.jpg"
                    } 
                    alt={currentTournament.name}
                    className="w-full h-full object-cover opacity-95 group-hover:opacity-100 brightness-100 group-hover:brightness-110 transition-all duration-700"
                  />
                </m.motion.div>
                {isJoined && (
                  <div className="absolute inset-0 border-[20px] border-primary/5 pointer-events-none" />
                )}
              </div>

              {/* Content Side - Static */}
              <div className="flex-1 p-6 md:p-12 flex flex-col justify-center backdrop-blur-sm min-w-0 relative [container-type:inline-size]">
                <div className="flex flex-col items-start gap-4 mb-6">
                  <div className="min-w-0 w-full">
                    <h4 className={`text-[clamp(1.2rem,15cqw,5.5rem)] font-[900] uppercase tracking-tighter transition-all duration-500 font-poppins leading-[0.85] mb-4 break-words italic ${isJoined ? "text-primary" : "text-white"}`}>
                      {currentTournament.name}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="shrink-0 px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] border border-primary text-primary whitespace-nowrap">
                        {currentTournament.status}
                      </span>
                      {isJoined && (
                        <span className="px-3 py-1 bg-primary text-black text-[8px] font-black uppercase tracking-widest italic animate-pulse">
                          JOINED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-white/50 text-xs md:text-sm leading-relaxed max-w-xl font-poppins mb-6 md:mb-8 italic line-clamp-3 md:line-clamp-none">
                  Experience high-level competitive gaming. Join the tournament and prove your skills against the best players in the community.
                </p>

                <div className="flex flex-wrap items-center gap-4 mt-auto">
                  <div className={`px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${isJoined ? "bg-white text-black" : "bg-primary text-black"}`}>
                    {(() => {
                      const fs = typeof currentTournament.format === 'string' ? currentTournament.format : currentTournament.format?.system || "UNKNOWN";
                      return fs === "HYBRID" ? "TOP CUT" : fs.replace(/_/g, ' ');
                    })()}
                  </div>
                  <Link href={`/tournaments/${currentTournament.id}`} className="text-white font-black text-[10px] md:text-xs uppercase tracking-[0.3em] group-hover:translate-x-2 transition-transform flex items-center gap-2 whitespace-nowrap">
                    {isJoined ? "GO TO TOURNAMENT" : "VIEW TOURNAMENT"} <span className="text-primary text-lg">→</span>
                  </Link>
                </div>
              </div>
            </m.motion.div>
          )}
        </m.AnimatePresence>
      </div>
    </div>
  );

  if (variant === "bento") {
    return (
      <BentoBox theme="default" noPadding className="p-0">
        {content}
      </BentoBox>
    );
  }

  return content;
}
