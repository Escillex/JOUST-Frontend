"use client";
import React from "react";
import { motion } from "motion/react";
import { API_URL } from "../utils/api";

export interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  link: string;
  category?: string;
  description?: string;
}

interface ProductCardProps {
  product: Product;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const formatPrice = (price: string) => {
    if (!price) return "";
    const trimmed = price.trim();
    if (
      trimmed.includes("₱") ||
      trimmed.includes("$") ||
      trimmed.includes("PHP") ||
      trimmed.includes("Php") ||
      trimmed.includes("¥") ||
      trimmed.includes("€") ||
      trimmed.includes("£")
    ) {
      return trimmed;
    }
    return `₱${trimmed}`;
  };

  return (
    <motion.a 
      href={product.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
      viewport={{ once: true }}
      whileHover={{ 
        y: -12,
        transition: { type: "spring", stiffness: 400, damping: 10 }
      }}
      className="flex-none w-[340px] md:w-[450px] group cursor-pointer pointer-events-auto"
      onDragStart={(e) => e.preventDefault()} 
    >
      <div className="relative aspect-[4/5] bg-zinc-900 border-4 border-white group-hover:border-primary group-hover:shadow-[12px_12px_0px_0px_#52B946] transition-all duration-500 overflow-hidden mb-10">
        {product.image && (
          <img
            src={product.image.startsWith("http") || product.image.startsWith("/")
              ? product.image
              : `${API_URL}${product.image}`}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {/* Sensory Breathing Border */}
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 border-2 border-primary/20 pointer-events-none"
        />

        <div className="absolute top-8 right-8 bg-primary text-black px-8 py-4 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 font-poppins shadow-[4px_4px_0px_0px_white]">
          VIEW STORE ↗
        </div>

        <div className="absolute bottom-8 left-8 z-20">
          <motion.span 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-xs font-black bg-white text-black px-4 py-2 uppercase tracking-widest font-poppins"
          >
            {product.category || "STORE"}
          </motion.span>
        </div>
      </div>

      <div className="space-y-4 px-2">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-4xl font-black uppercase tracking-tighter text-white group-hover:text-primary transition-colors font-poppins leading-none">
            {product.name}
          </h3>
          <span className="text-2xl font-black text-primary/60 font-poppins">{formatPrice(product.price)}</span>
        </div>
        <p className="text-white/30 text-xs font-bold uppercase tracking-widest leading-relaxed font-poppins max-w-[90%]">
          {product.description}
        </p>
      </div>
    </motion.a>
  );
}
