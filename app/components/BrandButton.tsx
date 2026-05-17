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
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`group relative flex items-center gap-3 px-8 py-4 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:-translate-y-1 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {icon && (
        <div className="w-4 h-4 transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
      )}
      <span className="relative z-10">{text}</span>
      
      {/* Dynamic Glow Overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10 pointer-events-none"
        style={{ backgroundColor: bgColor }}
      />
    </a>
  );
}
