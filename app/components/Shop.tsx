"use client";
import { useRef } from "react";
import { motion } from "motion/react";
import HomeFrame from "./HomeFrame";
import ProductCard, { Product } from "./ProductCard";

interface ShopProps {
  products?: Product[];
}

export default function Shop({ 
  // Fallback products, used only until an administrator configures the store.
  // These referenced /p1.jpg../p5.jpg, none of which exist in public/, so the
  // default storefront rendered five broken images.
  products = [
    { id: "1", name: "Premium Board Game", price: "₱2,999.00", image: "/placeholder.png", link: "#", category: "COLLECTIBLES", description: "A deep strategy game for 2-4 players." },
    { id: "2", name: "Miniature Starter Set", price: "₱2,250.00", image: "/placeholder.png", link: "#", category: "HOBBY", description: "Finely detailed miniatures, unpainted." },
    { id: "3", name: "Limited Edition Cards", price: "₱650.00", image: "/placeholder.png", link: "#", category: "CARDS", description: "Authenticated holographic collector cards." },
    { id: "4", name: "Gamer Accessories", price: "₱1,250.00", image: "/placeholder.png", link: "#", category: "STORE", description: "Comfortable accessories for long sessions." },
    { id: "5", name: "Hobby Supplies Pack", price: "₱1,500.00", image: "/placeholder.png", link: "#", category: "SUPPLIES", description: "Paints, brushes and glue for model building." },
  ] 
}: ShopProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Plan 9.10. An empty `products` array renders an empty state instead of
  // falling back to the sample catalogue above. GET /store correctly returns []
  // for an empty table, and the home page passes that straight through — so a
  // fresh install used to advertise five products that do not exist, with dead
  // buttons. The defaults remain for the admin editor, which passes `undefined`
  // deliberately to preview the layout before any product is configured.
  //
  // This guard MUST stay below the hooks above. Placed before them it changed
  // the hook call order between an empty and a populated list, which is a Rules
  // of Hooks violation — React would mis-associate state across that
  // transition, and the store list genuinely does go from empty to populated
  // once the fetch lands.
  if (products.length === 0) {
    return (
      <section className="w-full py-16 text-center">
        <p className="text-sm font-semibold text-white/40 uppercase tracking-widest">
          No products available yet
        </p>
        <p className="mt-2 text-xs text-white/25">
          Check back soon.
        </p>
      </section>
    );
  }

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
