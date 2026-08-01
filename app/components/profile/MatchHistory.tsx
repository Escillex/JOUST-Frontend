"use client";

import React, { useState, useEffect } from "react";
import * as m from "motion/react";
import { BentoBox } from "../ui/Bento";
import { authenticatedFetch, API_ENDPOINTS, safeJson, resolveImageUrl } from "../../utils/api";

interface Activity {
  id: string;
  type: 'win' | 'loss' | 'draw' | 'entry';
  title: string;
  subtitle: string;
  time: string;
  value?: string;
  player1?: { id: string | null; name: string; avatarUrl: string | null; score: number };
  player2?: { id: string | null; name: string; avatarUrl: string | null; score: number };
  isPlayer1?: boolean;
}

import Image from "next/image";
import Link from "next/link";

interface MatchHistoryProps {
  activities?: Activity[];
  variant?: "default" | "bento";
  userId?: string;
}

export default function MatchHistory({ activities: initialActivities = [], variant = "default", userId }: MatchHistoryProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialActivities.length > 0) {
      setActivities(initialActivities);
      return;
    }

    if (userId) {
      const fetchMatches = async () => {
        setLoading(true);
        try {
          const res = await authenticatedFetch(API_ENDPOINTS.AUTH.USER_MATCHES(userId));
          if (res.ok) {
            const data = await safeJson(res);
            if (data && Array.isArray(data)) {
              setActivities(data);
            }
          }
        } catch (err) {
          console.error("Failed to fetch match history:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchMatches();
    }
  }, [userId]);

  // Icon rendering removed as per request

  const content = (
    <div className={`flex flex-col ${variant === "default" ? "min-h-[400px]" : "h-full"} bg-component-background text-white`}>
      <div className={`flex items-center justify-between ${variant === "default" ? "mb-10" : "mb-8"}`}>
        <div className="flex items-center gap-6">
          <div className="w-1.5 h-10 bg-primary" />
          <h3 className={`${variant === "default" ? "text-3xl" : "text-[12px]"} font-black uppercase tracking-widest text-white font-poppins`}>
            Recent <span className="text-primary">Activity</span>
          </h3>
        </div>
        <div className="bg-primary/10 border border-primary/40 text-primary px-3 py-1 text-[8px] font-black uppercase tracking-widest font-mono">
          Synchronized
        </div>
      </div>
      
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-4">
        {activities.length > 0 ? (
          activities.map((activity, idx) => (
            <m.motion.div 
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className={`p-6 border-2 ${
                activity.type === 'win' ? 'border-primary/40 hover:border-primary' :
                activity.type === 'loss' ? 'border-red-500/40 hover:border-red-500' :
                'border-component-border hover:border-white/30'
              } transition-colors bg-component-background relative group overflow-hidden hover:shadow-[inset_0_0_30px_rgba(82,185,70,0.1)] hover:bg-primary/5`}
            >
              {/* Technical detail: bottom progress line */}
              <div className="absolute bottom-0 left-0 h-[1px] bg-primary/40 w-0 group-hover:w-full transition-all duration-700" />

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-4 gap-4">
                  <div 
                    className="text-xs font-black text-white/30 uppercase tracking-[0.3em] truncate font-poppins flex-1 text-left"
                    title={activity.subtitle}
                  >
                    {activity.subtitle}
                  </div>
                  
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <span className={`text-[10px] font-black uppercase tracking-[0.4em] px-3 py-1 border font-poppins ${
                      activity.type === 'win' ? 'text-primary bg-primary/5 border-primary/20' : 
                      activity.type === 'loss' ? 'text-red-500 bg-red-500/5 border-red-500/20' : 
                      'text-white/40 bg-white/5 border-white/10'
                    }`}>
                      {activity.type === 'win' ? 'VICTORY' : activity.type === 'loss' ? 'DEFEAT' : 'DRAW'}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.4em] whitespace-nowrap flex-1 text-right">
                    {activity.time}
                  </div>
                </div>
                
                {activity.player1 && activity.player2 ? (
                  <div className="flex items-center justify-between w-full bg-surface border border-white/5 p-4 px-6 mt-2">
                      {/* Player 1 */}
                      <div className="flex items-center gap-4 w-[35%] min-w-0">
                        <div className="relative w-10 h-10 bg-background border border-white/10 flex items-center justify-center font-black text-xs text-primary overflow-hidden shrink-0">
                          {activity.player1.avatarUrl ? (
                            <Image 
                              src={resolveImageUrl(activity.player1.avatarUrl)}
                              alt={activity.player1.name} 
                              fill 
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            activity.player1.name[0]?.toUpperCase() || "U"
                          )}
                        </div>
                        {activity.player1.id ? (
                           <Link 
                             href={`/profile/${activity.player1.id}`} 
                             className="text-base min-w-0 font-black uppercase tracking-tight text-white hover:text-primary transition-colors truncate font-poppins"
                             title={activity.player1.name}
                           >
                             {activity.player1.name}
                           </Link>
                        ) : (
                           <span 
                             className="text-base min-w-0 font-black uppercase tracking-tight text-white truncate font-poppins"
                             title={activity.player1.name}
                           >
                             {activity.player1.name}
                           </span>
                        )}
                      </div>
                      
                      {/* Score */}
                      <div className="flex items-center justify-center gap-4 w-[30%] shrink-0">
                        <span className={`text-2xl font-black font-poppins ${activity.isPlayer1 ? 'text-primary' : 'text-white'}`}>
                          {activity.player1.score}
                        </span>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">VS</span>
                        <span className={`text-2xl font-black font-poppins ${!activity.isPlayer1 ? 'text-primary' : 'text-white'}`}>
                          {activity.player2.score}
                        </span>
                      </div>
                      
                      {/* Player 2 */}
                      <div className="flex items-center gap-4 w-[35%] justify-end text-right min-w-0">
                        {activity.player2.id ? (
                           <Link 
                             href={`/profile/${activity.player2.id}`} 
                             className="text-base min-w-0 font-black uppercase tracking-tight text-white hover:text-primary transition-colors truncate font-poppins"
                             title={activity.player2.name}
                           >
                             {activity.player2.name}
                           </Link>
                        ) : (
                           <span 
                             className="text-base min-w-0 font-black uppercase tracking-tight text-white truncate font-poppins"
                             title={activity.player2.name}
                           >
                             {activity.player2.name}
                           </span>
                        )}
                        <div className="relative w-10 h-10 bg-background border border-white/10 flex items-center justify-center font-black text-xs text-primary overflow-hidden shrink-0">
                          {activity.player2.avatarUrl ? (
                            <Image 
                              src={resolveImageUrl(activity.player2.avatarUrl)}
                              alt={activity.player2.name} 
                              fill 
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            activity.player2.name[0]?.toUpperCase() || "U"
                          )}
                        </div>
                      </div>
                    </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors truncate font-poppins">
                      {activity.title}
                    </h4>
                    {activity.value && (
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] bg-primary/5 px-3 py-1 border border-primary/20 ml-4 font-poppins">
                        {activity.value}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </m.motion.div>
          ))
        ) : loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-background/10 border-2 border-dashed border-component-border">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20 font-poppins">
              Loading activity...
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-background/10 border-2 border-dashed border-component-border">
            <div className="w-16 h-16 bg-white/5 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20 font-poppins">
              No activity recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "bento") {
    return (
      <BentoBox theme="default" noPadding className="p-0 overflow-hidden">
        <div className="p-0 h-full">
          {content}
        </div>
      </BentoBox>
    );
  }

  return (
    <m.motion.div 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="bg-component-background border-2 border-component-border p-12 flex flex-col h-[600px] relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,1)]"
    >
      {/* Subtle grid background for the container */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {content}
    </m.motion.div>
  );
}
