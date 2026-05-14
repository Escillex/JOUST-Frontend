"use client";

import React from "react";
import * as m from "motion/react";
import { BentoBox } from "../ui/Bento";

interface Activity {
  id: string;
  type: 'win' | 'loss' | 'draw' | 'entry';
  title: string;
  subtitle: string;
  time: string;
  value?: string;
}

interface MatchHistoryProps {
  activities?: Activity[];
  variant?: "default" | "bento";
  userId?: string;
}

export default function MatchHistory({ activities = [], variant = "default", userId }: MatchHistoryProps) {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'win': return (
        <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center border-2 border-primary/40 relative group-hover:scale-110 transition-transform">
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-primary" />
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
      );
      case 'loss': return (
        <div className="w-10 h-10 bg-red-500/10 text-red-500 flex items-center justify-center border-2 border-red-500/40 relative">
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-red-500" />
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
      );
      default: return (
        <div className="w-10 h-10 bg-component-background text-white/40 flex items-center justify-center border-2 border-component-border relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      );
    }
  };

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
              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(var(--color-primary), 0.3)" }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-8 p-6 border-2 border-component-border bg-component-background relative group overflow-hidden"
            >
              {/* Technical detail: bottom progress line */}
              <div className="absolute bottom-0 left-0 h-[1px] bg-primary/40 w-0 group-hover:w-full transition-all duration-700" />
              
              {getIcon(activity.type)}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors truncate font-poppins">
                    {activity.title}
                  </h4>
                  <span className="text-[8px] font-mono text-white/20 uppercase tracking-[0.4em] whitespace-nowrap ml-6">
                    TS_{activity.time}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] truncate font-poppins">
                    {activity.subtitle}
                  </p>
                  {activity.value && (
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] bg-primary/5 px-3 py-1 border border-primary/20 ml-4 font-poppins">
                      {activity.value}
                    </span>
                  )}
                </div>
              </div>
            </m.motion.div>
          ))
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
      className="bg-component-background border-2 border-component-border p-12 flex flex-col min-h-[500px] relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,1)]"
    >
      {/* Subtle grid background for the container */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {content}
    </m.motion.div>
  );
}
