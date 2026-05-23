import React from "react";
import { motion } from "motion/react";

interface HomeFrameProps {
  children: React.ReactNode;
  className?: string;
  showPattern?: boolean;
}

/**
 * HomeFrame - A specialized container for home page sections.
 * Implements the "Material Expressive" breathing background.
 */
export default function HomeFrame({ 
  children, 
  className = "", 
  showPattern = true 
}: HomeFrameProps) {
  return (
    <div className={`relative w-full overflow-hidden isolate transform-gpu bg-background ${className}`}>
      {/* Sensory Breathing Background */}
      <motion.div 
        animate={{ 
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1]
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.03] via-transparent to-primary/[0.03]" />
      </motion.div>

      {/* Technical Texture Depth */}
      {showPattern && (
        <>
          <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none overflow-hidden">
            <div className="w-full h-full bg-[url('/grid.svg')] bg-[size:60px_60px]" />
          </div>
          {/* Rhythmic scanlines */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] pointer-events-none opacity-[0.1]" />
        </>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
