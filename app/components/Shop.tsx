"use client";
import { useRef } from "react";
import { motion } from "motion/react";
import HomeFrame from "./HomeFrame";
import ProductCard, { Product } from "./ProductCard";

interface ShopProps {
  products?: Product[];
}

export default function Shop({ 
  products = [
    { id: "1", name: "Premium Board Game", price: "₱2,999.00", image: "/p1.jpg", link: "#", category: "COLLECTIBLES", description: "High-fidelity strategic simulation unit." },
    { id: "2", name: "Miniature Starter Set", price: "₱2,250.00", image: "/p2.jpg", link: "#", category: "HOBBY", description: "Precision-molded tactical components." },
    { id: "3", name: "Limited Edition Cards", price: "₱650.00", image: "/p3.jpg", link: "#", category: "CARDS", description: "Authenticated holographic assets." },
    { id: "4", name: "Gamer Accessories", price: "₱1,250.00", image: "/p4.jpg", link: "#", category: "STORE", description: "Ergonomic interface enhancements." },
    { id: "5", name: "Hobby Supplies Pack", price: "₱1,500.00", image: "/p5.jpg", link: "#", category: "SUPPLIES", description: "Industrial-grade maintenance kit." },
  ] 
}: ShopProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <HomeFrame className="py-24">
      {/* Rhythmic Draggable Feed - No redundant headers */}
      <div ref={constraintsRef} className="relative overflow-hidden px-8 pb-12 cursor-grab active:cursor-grabbing">
        <motion.div 
          drag="x"
          dragConstraints={constraintsRef}
          className="flex gap-12 w-max"
          ref={scrollRef}
        >
          {products.map((product, idx) => (
            <ProductCard key={product.id} product={product} index={idx} />
          ))}
        </motion.div>
      </div>
    </HomeFrame>
  );
}
