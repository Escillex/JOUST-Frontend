"use client";
import { motion } from "motion/react";

interface SectionDividerProps {
  label: string;
}

/**
 * SectionDivider - A Neo-Brutalist Marquee Transition.
 * Uses massive, repeating industrial typography to create a raw rhythmic break.
 */
export default function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="relative h-48 md:h-64 w-full flex items-center overflow-hidden bg-[#1B1B1B] border-y-4 border-white/5 my-12">
      {/* Infinite Marquee Wrapper */}
      <div className="flex whitespace-nowrap">
        <motion.div 
          animate={{ x: [0, -1000] }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="flex items-center gap-12 pr-12"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="text-7xl md:text-[180px] font-black text-white uppercase tracking-tighter font-poppins italic opacity-100">
              {label} <span className="text-primary tracking-[-0.1em]">///</span>
            </span>
          ))}
        </motion.div>
        
        {/* Duplicate for seamless loop */}
        <motion.div 
          animate={{ x: [0, -1000] }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="flex items-center gap-12 pr-12"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="text-7xl md:text-[180px] font-black text-white uppercase tracking-tighter font-poppins italic opacity-100">
              {label} <span className="text-primary tracking-[-0.1em]">///</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Industrial Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_100px_rgba(0,0,0,1)]" />
    </div>
  );
}
