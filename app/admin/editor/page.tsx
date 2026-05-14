"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS } from "../../utils/api";
import Hero from "../../components/home/Hero";
import Shop from "../../components/home/Shop";
import ImageUpload from "../../components/ui/ImageUpload";
import { motion, AnimatePresence } from "motion/react";
import SectionDivider from "../../components/home/SectionDivider";

interface SiteAsset {
  key: string;
  url: string;
  label?: string;
}

interface StoreProduct {
  id: string;
  name: string;
  price: string;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
  link?: string | null;
  sortOrder: number;
  isVisible: boolean;
}

const BLANK_PRODUCT: Omit<StoreProduct, "id" | "sortOrder" | "isVisible"> = {
  name: "",
  price: "",
  imageUrl: null,
  category: "",
  description: "",
  link: "",
};

export default function SiteVisualEditor() {
  const router = useRouter();

  // Hero state
  const [heroAssets, setHeroAssets] = useState<SiteAsset[]>([]);
  const [uploadingHeroKey, setUploadingHeroKey] = useState<string | null>(null);

  // Store state
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [newProduct, setNewProduct] = useState({ ...BLANK_PRODUCT });
  const [newProductFile, setNewProductFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Partial<StoreProduct>>({});
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activePreview, setActivePreview] = useState<"HERO" | "SHOP">("HERO");
  const [loading, setLoading] = useState(true);

  // ─── Fetchers ──────────────────────────────────────────────────

  const fetchHeroAssets = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.LIST_ASSETS);
    if (res.ok) {
      const data = await res.json();
      setHeroAssets(data.filter((a: SiteAsset) => a.key.startsWith("hero_slide_")));
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.LIST_ALL);
    if (res.ok) setProducts(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchHeroAssets(), fetchProducts()]).finally(() => setLoading(false));
  }, [fetchHeroAssets, fetchProducts]);

  // ─── Hero handlers ─────────────────────────────────────────────

  const handleHeroUpload = async (key: string, file: File) => {
    setUploadingHeroKey(key);
    const formData = new FormData();
    formData.append("file", file);
    const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.UPSERT_ASSET(key), {
      method: "POST",
      body: formData,
    });
    if (res.ok) fetchHeroAssets();
    setUploadingHeroKey(null);
  };

  const handleHeroDelete = async (key: string) => {
    if (!confirm(`Remove slide ${key}?`)) return;
    const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.DELETE_ASSET(key), { method: "DELETE" });
    if (res.ok) fetchHeroAssets();
  };

  // ─── Store CRUD handlers ───────────────────────────────────────

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;
    setSaving(true);
    try {
      // Omit imageUrl from the create payload as it's not in the CreateStoreProductDto
      const { imageUrl, ...payload } = newProduct;
      const res = await authenticatedFetch(API_ENDPOINTS.STORE.CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const created = await res.json();
        
        // If there's an image to upload, do it now
        if (newProductFile) {
          const formData = new FormData();
          formData.append("file", newProductFile);
          const imgRes = await authenticatedFetch(API_ENDPOINTS.STORE.UPLOAD_IMAGE(created.id), {
            method: "POST",
            body: formData,
          });
          if (!imgRes.ok) alert("Product created, but image upload failed.");
        }
        
        setNewProduct({ ...BLANK_PRODUCT });
        setNewProductFile(null);
        fetchProducts();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to create: ${res.status} ${errData.message || ""}`);
      }
    } catch (err) {
      console.error("Failed to create product:", err);
      alert("Network error: Check if backend is running.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async (id: string) => {
    setSaving(true);
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.UPDATE(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editState),
    });
    if (res.ok) {
      setEditingId(null);
      setEditState({});
      fetchProducts();
    }
    setSaving(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.DELETE(id), { method: "DELETE" });
    if (res.ok) fetchProducts();
  };

  const handleProductImageUpload = async (id: string, file: File) => {
    setUploadingProductId(id);
    const formData = new FormData();
    formData.append("file", file);
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.UPLOAD_IMAGE(id), {
      method: "POST",
      body: formData,
    });
    if (res.ok) fetchProducts();
    setUploadingProductId(null);
  };

  const handleProductImageDelete = async (id: string) => {
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.DELETE_IMAGE(id), { method: "DELETE" });
    if (res.ok) fetchProducts();
  };

  const handleToggleVisible = async (product: StoreProduct) => {
    await authenticatedFetch(API_ENDPOINTS.STORE.UPDATE(product.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !product.isVisible }),
    });
    fetchProducts();
  };

  // ─── Derived preview props ─────────────────────────────────────

  const heroSlides = heroAssets
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(a => ({ image: a.url, title: "LIVE PREVIEW", photoDesc: a.key.toUpperCase() }));

  const shopProducts = products
    .filter(p => p.isVisible)
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.imageUrl ?? "",
      category: p.category ?? "STORE",
      description: p.description ?? "",
      link: p.link ?? "#",
    }));

  const inputCls = "w-full bg-black border border-white/10 px-3 py-2 text-[11px] text-white focus:outline-none focus:border-primary transition-all font-questrial";
  const labelCls = "text-[8px] font-black text-white/30 uppercase tracking-[0.3em] block mb-1";

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col overflow-hidden">
      {/* ── Top Header ── */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#111] z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="text-[10px] font-black text-white/40 hover:text-primary uppercase tracking-widest transition-colors"
          >
            ← ADMIN
          </button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-[11px] font-black uppercase tracking-[0.3em]">
            SITE VISUAL EDITOR
          </h1>
        </div>
        <div className="flex bg-black p-1 border border-white/5">
          {(["HERO", "SHOP"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActivePreview(tab)}
              className={`px-5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activePreview === tab ? "bg-primary text-black" : "text-white/40 hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: Live Preview ── */}
        <div className="flex-1 bg-black relative overflow-hidden border-r border-white/10 flex flex-col items-center justify-center">
          <div className="absolute top-4 left-4 z-10">
            <span className="px-2 py-1 bg-primary text-black text-[8px] font-black uppercase tracking-widest">
              Live Preview
            </span>
          </div>

          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <div
              className="pointer-events-none select-none bg-[#1B1B1B] border border-white/5 shadow-2xl"
              style={{ width: "1920px", transform: "scale(0.35)", transformOrigin: "center center", minHeight: "100vh" }}
            >
              {activePreview === "HERO" ? (
                <Hero slides={heroSlides.length > 0 ? heroSlides : undefined} />
              ) : (
                <div className="py-20">
                  <SectionDivider label="STORE" />
                  <Shop products={shopProducts.length > 0 ? shopProducts : undefined} />
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/15 uppercase tracking-[0.5em]">
            SCALED PREVIEW — 1920px
          </div>
        </div>

        {/* ── RIGHT: Control Panel ── */}
        <div className="w-[400px] bg-[#111] flex flex-col border-l border-white/10 flex-shrink-0">
          <div className="p-6 border-b border-white/10">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
              {activePreview === "HERO" ? "Hero Slides" : "Product Catalog"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

            {/* ══ HERO PANEL ══ */}
            {activePreview === "HERO" && (
              <>
                {heroAssets
                  .sort((a, b) => a.key.localeCompare(b.key))
                  .map((asset, i) => (
                    <div key={asset.key} className="border border-white/5 bg-black/30 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                          SLIDE {i + 1}
                        </span>
                        <button
                          onClick={() => handleHeroDelete(asset.key)}
                          className="text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <ImageUpload
                        currentUrl={asset.url}
                        onUpload={(file) => handleHeroUpload(asset.key, file)}
                        uploading={uploadingHeroKey === asset.key}
                        aspectRatio="aspect-video"
                        cropAspectRatio={16 / 9}
                        label="Swap Image"
                      />
                    </div>
                  ))}

                {/* Add Slide */}
                <div className="border-2 border-dashed border-white/5 p-4 hover:border-primary/20 transition-all">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-3">
                    + Add Slide {heroAssets.length + 1}
                  </p>
                  <ImageUpload
                    onUpload={(file) => handleHeroUpload(`hero_slide_${heroAssets.length + 1}`, file)}
                    uploading={uploadingHeroKey === `hero_slide_${heroAssets.length + 1}`}
                    aspectRatio="aspect-video"
                    cropAspectRatio={16 / 9}
                    label="Upload New Slide"
                  />
                </div>
              </>
            )}

            {/* ══ SHOP PANEL ══ */}
            {activePreview === "SHOP" && (
              <>
                {/* Existing products */}
                {products.map((product, i) => (
                  <div key={product.id} className="border border-white/5 bg-black/30 p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                        Product {i + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleVisible(product)}
                          className={`text-[9px] font-black uppercase tracking-widest transition-colors ${product.isVisible ? "text-primary" : "text-white/20"}`}
                        >
                          {product.isVisible ? "Visible" : "Hidden"}
                        </button>
                        <button
                          onClick={() => {
                            if (editingId === product.id) {
                              setEditingId(null); setEditState({});
                            } else {
                              setEditingId(product.id);
                              setEditState({ name: product.name, price: product.price, category: product.category ?? "", description: product.description ?? "", link: product.link ?? "" });
                            }
                          }}
                          className="text-[9px] font-black text-primary/60 hover:text-primary uppercase tracking-widest transition-colors"
                        >
                          {editingId === product.id ? "Cancel" : "Edit"}
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Image upload for product */}
                    <ImageUpload
                      currentUrl={product.imageUrl ?? undefined}
                      onUpload={(file) => handleProductImageUpload(product.id, file)}
                      onDelete={product.imageUrl ? () => handleProductImageDelete(product.id) : undefined}
                      uploading={uploadingProductId === product.id}
                      aspectRatio="aspect-[4/5]"
                      cropAspectRatio={4 / 5}
                      label="Update Image"
                    />

                    {/* Inline edit form */}
                    {editingId === product.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 pt-2 border-t border-white/5"
                      >
                        <div>
                          <label className={labelCls}>Product Name *</label>
                          <input className={inputCls} value={editState.name ?? ""} onChange={e => setEditState(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Hobby+ Hoodie" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Price *</label>
                            <input className={inputCls} value={editState.price ?? ""} onChange={e => setEditState(s => ({ ...s, price: e.target.value }))} placeholder="₱1,299" />
                          </div>
                          <div>
                            <label className={labelCls}>Category</label>
                            <input className={inputCls} value={editState.category ?? ""} onChange={e => setEditState(s => ({ ...s, category: e.target.value }))} placeholder="APPAREL" />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>External Link</label>
                          <input className={inputCls} value={editState.link ?? ""} onChange={e => setEditState(s => ({ ...s, link: e.target.value }))} placeholder="https://..." />
                        </div>
                        <button
                          onClick={() => handleUpdateProduct(product.id)}
                          disabled={saving}
                          className="w-full py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-all disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </motion.div>
                    )}

                    {/* Read view */}
                    {editingId !== product.id && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                        <div>
                          <span className="text-[8px] text-white/20 uppercase tracking-widest">Name</span>
                          <p className="text-[10px] font-black text-white truncate">{product.name || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[8px] text-white/20 uppercase tracking-widest">Price</span>
                          <p className="text-[10px] font-black text-primary">{product.price || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* ── Create New Product ── */}
                <div className="border-2 border-dashed border-white/5 p-4 hover:border-primary/10 transition-all space-y-3">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">+ New Product</p>
                  
                  {/* Added Image Selection for New Product */}
                  <ImageUpload 
                    onUpload={(file) => setNewProductFile(file)}
                    onDelete={() => setNewProductFile(null)}
                    aspectRatio="aspect-[4/5]"
                    cropAspectRatio={4/5}
                    label={newProductFile ? "Image Selected" : "Upload Product Image"}
                    currentUrl={newProductFile ? URL.createObjectURL(newProductFile) : undefined}
                  />

                  <div>
                    <label className={labelCls}>Product Name *</label>
                    <input className={inputCls} value={newProduct.name} onChange={e => setNewProduct(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Hobby+ Cap" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Price *</label>
                      <input className={inputCls} value={newProduct.price} onChange={e => setNewProduct(s => ({ ...s, price: e.target.value }))} placeholder="₱899" />
                    </div>
                    <div>
                      <label className={labelCls}>Category</label>
                      <input className={inputCls} value={newProduct.category ?? ""} onChange={e => setNewProduct(s => ({ ...s, category: e.target.value }))} placeholder="GEAR" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>External Link</label>
                    <input className={inputCls} value={newProduct.link ?? ""} onChange={e => setNewProduct(s => ({ ...s, link: e.target.value }))} placeholder="https://..." />
                  </div>
                  <button
                    onClick={handleCreateProduct}
                    disabled={saving || !newProduct.name || !newProduct.price}
                    className="w-full py-2.5 border border-primary/50 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {saving ? "Creating..." : "Create Product"}
                  </button>
                </div>

                {/* spacer */}
                <div className="h-12" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
