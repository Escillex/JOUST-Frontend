"use client";
import { motion } from "motion/react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  delay?: number;
}

export default function StatCard({ title, value, subtitle, color = "text-white", delay = 0 }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
      className="bg-background border border-white/10 p-6 flex flex-col justify-between h-36 relative transition-all duration-300 group hover:border-white/20"
    >
      {/* Linear Glow Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-center justify-between relative z-10">
        <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] leading-none">
          {title}
        </h3>
        <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(82,185,70,0.5)]`}></div>
      </div>
      
      <div className="relative z-10">
        <div className={`text-5xl font-black tracking-tight ${color} leading-none mb-2 font-poppins`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-bold border-t border-white/5 pt-2 inline-block">
            {subtitle}
          </p>
        )}
      </div>

      {/* Decorative Border Glow Line */}
      <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:w-full transition-all duration-700" />
    </motion.div>
  );
}
