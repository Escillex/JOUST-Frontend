"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import BrandButton from "./BrandButton";
import { API_URL } from "../utils/api";

interface Slide {
  image: string;
  title?: string;
  subtitle?: string;
  photoDesc?: string;
}

interface StoreButtonConfig {
  text: string;
  href: string;
  color: string;
  icon?: React.ReactNode;
}

interface HeroProps {
  slides?: Slide[];
  logo?: string;
  description?: string;
  storeButtons?: StoreButtonConfig[];
}

export default function Hero({ 
  slides = [
    { image: "/hero-bg-1.jpg", title: "MASTER YOUR CRAFT", photoDesc: "COLLECTORS EDITION — SERIES 01" },
    { image: "/hero-bg-2.jpg", title: "JOIN THE COMPETITION", photoDesc: "TOURNAMENT EVENT — LIVE" }
  ], 
  logo = "/hpluslogo.png", 
  description = "Experience the next level of hobby gaming. Professional tournaments, high-fidelity community, and the best gear, all in one place.",
  storeButtons = [
    { 
      text: "", 
      href: "https://shopee.ph/hobbyplusshop", 
      color: "#FFFFFF",
      icon: (
        <Image 
          src="/shp.png" 
          alt="Shopee Logo" 
          width={80} 
          height={32} 
          className="object-contain w-full h-full" 
        />
      )
    },
    { 
      text: "", 
      href: "https://www.lazada.com.ph/shop/hobby-plus-shop", 
      color: "#FFFFFF",
      icon: (
        <Image 
          src="/laz.png" 
          alt="Lazada Logo" 
          width={80} 
          height={32} 
          className="object-contain w-full h-full scale-[1.3] origin-center" 
        />
      )
    }
  ]
}: HeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative h-[85vh] md:h-[95vh] min-h-[600px] w-full overflow-hidden bg-[#1B1B1B] font-questrial selection:bg-primary selection:text-black">
      {/* Eager preloader to prevent dynamic image flashing on throttled connections */}
      <div className="hidden aria-hidden pointer-events-none absolute w-0 h-0 overflow-hidden" style={{ display: 'none' }}>
        {slides.map((slide, idx) => (
          <img 
            key={idx}
            src={slide.image.startsWith("http") || slide.image.startsWith("/") ? slide.image : `${API_URL}${slide.image}`}
            alt=""
            loading="eager"
          />
        ))}
      </div>

      {/* Material Expressive Background Slideshow */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1.05 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/20 to-background z-10" />
            {slides[currentSlide].image && (
              <img
                src={slides[currentSlide].image.startsWith("http") || slides[currentSlide].image.startsWith("/")
                  ? slides[currentSlide].image
                  : `${API_URL}${slides[currentSlide].image}`}
                alt={slides[currentSlide].title || "Hero Image"}
                className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-700 scale-105"
              />
            )}
            <div className="relative w-full h-full bg-zinc-900 -z-10" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rhythmic Scanline Micro-motion */}
      <motion.div 
        initial={{ top: "-100%" }}
        animate={{ top: "200%" }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 w-full h-40 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none z-10"
      />

      {/* Technical Diagnostic Brackets (Greeble) */}
      <div className="absolute top-12 left-12 w-32 h-32 border-t border-l border-primary/20 pointer-events-none z-20" />
      <div className="absolute bottom-12 right-12 w-32 h-32 border-b border-r border-primary/20 pointer-events-none z-20" />
      
      <div className="absolute top-12 right-12 flex flex-col items-end gap-1 z-20 opacity-20 hidden md:flex">
        <span className="text-[8px] font-black tracking-widest text-primary">SYSTEM_INIT</span>
        <span className="text-[8px] font-black tracking-widest text-white">LATENCY: 0.04ms</span>
        <span className="text-[8px] font-black tracking-widest text-white">UPTIME: 100.0%</span>
      </div>

      {/* Main Content Overlay */}
      <div className="relative z-20 h-full max-w-7xl mx-auto px-8 flex flex-col items-start justify-center">
        {/* Animated Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-12 group"
        >
          <div className="relative inline-block">
            <Image 
              src={logo} 
              width={240} 
              height={240} 
              alt="Hobby+ Logo" 
              priority
              className="w-48 md:w-80 drop-shadow-[0_0_40px_rgba(82,185,70,0.4)] transition-all duration-700 group-hover:scale-105"
              style={{ height: 'auto' }}
            />
            {/* Expressive Highlight Pulse */}
            <motion.div 
              animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -inset-4 bg-primary/5 blur-3xl -z-10 rounded-full"
            />
          </div>
        </motion.div>

        {/* Sensory Content Block */}
        <div className="max-w-2xl space-y-12">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-foreground/90 text-lg md:text-2xl font-black uppercase tracking-tight leading-relaxed font-poppins max-w-lg md:max-w-2xl"
          >
            {description}
          </motion.p>

          {/* Tactile Storefront Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-wrap items-center gap-6 font-poppins"
          >
            {storeButtons.map((btn, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <BrandButton 
                  text={btn.text}
                  href={btn.href}
                  bgColor={btn.color}
                  icon={btn.icon}
                  className="rounded-xl shadow-2xl transition-all duration-300"
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Rhythmic Slide Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-16 left-8 z-30 flex items-center gap-6">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className="group py-4 px-2"
              aria-label={`Go to slide ${idx + 1}`}
            >
              <div className="relative">
                <div className={`h-[2px] transition-all duration-700 ${
                  idx === currentSlide ? "w-20 bg-primary shadow-[0_0_20px_rgba(82,185,70,0.6)]" : "w-10 bg-foreground/10 group-hover:bg-foreground/30"
                }`} />
                {idx === currentSlide && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute -top-1 left-0 w-full h-full bg-primary/20 blur-sm"
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sensory Side Label */}
      <div className="absolute right-12 bottom-32 hidden lg:block z-20">
        <motion.div 
          key={currentSlide}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rotate-90 origin-right text-[10px] font-black uppercase tracking-[1em] text-primary/30 whitespace-nowrap font-poppins"
        >
          {slides[currentSlide].photoDesc || "TECHNICAL ARCHIVE // REPOSITORY 01"}
        </motion.div>
      </div>

      {/* Bottom Aesthetic Bar */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent z-30" />
    </section>
  );
}
