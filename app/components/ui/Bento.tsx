"use client";
import React from "react";
import { motion } from "motion/react";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, staggerChildren: 0.1 }}
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(200px,auto)] gap-6 md:gap-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function BentoItem({ 
  children, 
  className = "", 
  colSpan = 1, 
  rowSpan = 1 
}: { 
  children: React.ReactNode; 
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
}) {
  const colSpans = {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
  };

  const rowSpans = {
    1: "lg:row-span-1",
    2: "lg:row-span-2",
    3: "lg:row-span-3",
  };

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
      }}
      className={`md:col-span-2 ${colSpans[colSpan]} ${rowSpans[rowSpan]} ${className}`}
    >
      {children}
    </motion.div>
  );
}

interface BentoBoxProps {
  children: React.ReactNode;
  theme?: "default" | "primary" | "secondary";
  className?: string;
  noPadding?: boolean;
}

export function BentoBox({ 
  children, 
  theme = "default", 
  className = "",
  noPadding = false
}: BentoBoxProps) {
  const themes = {
    default: "bg-surface text-white border-2 border-white/5 hover:border-primary/40 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:shadow-[15px_15px_0px_0px_rgba(82,185,70,0.1)]",
    primary: "bg-surface text-primary border-4 border-primary shadow-[15px_15px_0px_0px_rgba(82,185,70,0.2)]",
    secondary: "bg-primary text-black border-4 border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]",
  };

  return (
    <motion.div 
      whileHover={{ 
        y: -6, 
        x: -6,
        transition: { type: "spring", stiffness: 300, damping: 15 }
      }}
      /* No whileTap. It fired on a press ANYWHERE inside the panel — a carousel
         arrow, a dot, a link — and did two jarring things at once: scaled the
         whole bento to 0.98 and reset x/y to 0, cancelling the hover lift, so
         paging through tournaments made the entire box shrink and jump 6px on
         every click. Press feedback belongs on the control being pressed, not on
         its container (and see the design system: no layout-shifting animations
         on cards). */
      className={`h-full relative overflow-hidden flex flex-col group transition-all duration-300 ${themes[theme]} ${noPadding ? "" : "p-8"} ${className}`}
    >
      {/* Material Expressive Corner Accents */}
      <div className="absolute top-0 left-0 w-8 h-1.5 bg-primary/20 group-hover:bg-primary group-hover:w-12 transition-all duration-500 ease-expressive" />
      <div className="absolute top-0 left-0 w-1.5 h-8 bg-primary/20 group-hover:bg-primary group-hover:h-12 transition-all duration-500 ease-expressive" />
      
      {/* Bottom Right Diagnostic Corner */}
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/0 group-hover:border-primary/40 transition-all duration-500" />

      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
      
      {/* Tactile Sensory Highlight */}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/[0.02] group-active:bg-primary/10 transition-colors pointer-events-none" />
      
      {/* Animated Scanline Micro-motion */}
      <motion.div 
        initial={{ top: "-100%" }}
        animate={{ top: "200%" }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 w-full h-24 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none -z-0"
      />
    </motion.div>
  );
}

