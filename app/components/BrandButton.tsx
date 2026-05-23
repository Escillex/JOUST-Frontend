import React from "react";

interface BrandButtonProps {
  text: string;
  href: string;
  bgColor: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * BrandButton - A reusable, high-fidelity action button for external storefronts.
 * Custom-built for the JOUST aesthetic with smooth lift-and-shadow physics.
 */
export default function BrandButton({ text, href, bgColor, icon, className = "" }: BrandButtonProps) {
  const hasText = !!text;
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`group relative flex items-center justify-center transition-all hover:-translate-y-1 ${
        hasText ? "gap-3 px-8 py-4" : "px-6 py-4 w-32 h-16"
      } text-white text-[10px] font-black uppercase tracking-[0.2em] ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {icon && (
        <div className={`transition-transform duration-300 group-hover:scale-110 flex items-center justify-center ${hasText ? "w-4 h-4" : "w-20 h-8"}`}>
          {icon}
        </div>
      )}
      {hasText && <span className="relative z-10">{text}</span>}
      
      {/* Dynamic Glow Overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10 pointer-events-none"
        style={{ backgroundColor: bgColor }}
      />
    </a>
  );
}
