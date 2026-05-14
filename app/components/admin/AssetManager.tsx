"use client";
import React, { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, API_URL, safeJson } from "../../utils/api";
import ImageUpload from "../ui/ImageUpload";
import { motion, AnimatePresence } from "motion/react";

interface SiteAsset {
  key: string;
  url: string;
  label?: string;
}

export default function AssetManager() {
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.LIST_ASSETS);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.UPSERT_ASSET(key), {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchAssets();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Permanently delete ${key}?`)) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.DELETE_ASSET(key), {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAssets();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const renderSection = (title: string, prefix: string, aspectRatio: string, cropRatio: number) => {
    const filtered = assets.filter(a => a.key.startsWith(prefix)).sort((a, b) => a.key.localeCompare(b.key));
    const nextIndex = filtered.length + 1;
    const nextKey = `${prefix}${nextIndex}`;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary">{title}</h3>
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{filtered.length} Active Slots</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {filtered.map((asset) => (
              <motion.div 
                key={asset.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-bg-component border border-white/5 p-6 space-y-4 hover:border-primary/20 transition-colors group"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{asset.key}</span>
                  <button 
                    onClick={() => handleDelete(asset.key)}
                    className="text-[10px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors"
                  >
                    Remove
                  </button>
                </div>
                
                <ImageUpload
                  currentUrl={asset.url}
                  onUpload={(file) => handleUpload(asset.key, file)}
                  uploading={uploadingKey === asset.key}
                  aspectRatio={aspectRatio}
                  cropAspectRatio={cropRatio}
                  label="Update Image"
                />
              </motion.div>
            ))}

            {/* Add New Placeholder */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-bg-component border-2 border-dashed border-white/5 p-6 space-y-4 flex flex-col justify-center items-center min-h-[300px]"
            >
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">New Slot Available</p>
                <p className="text-[12px] font-black text-primary uppercase tracking-[0.2em]">{nextKey}</p>
              </div>
              
              <div className="w-full">
                <ImageUpload
                  onUpload={(file) => handleUpload(nextKey, file)}
                  uploading={uploadingKey === nextKey}
                  aspectRatio={aspectRatio}
                  cropAspectRatio={cropRatio}
                  label="Add New Asset"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Accessing Repositories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-20 py-8">
      {renderSection("Hero Slider Assets", "hero_slide_", "aspect-[21/9]", 21/9)}
      {renderSection("Shop Catalog Assets", "shop_product_", "aspect-[4/5]", 4/5)}
      
      <div className="p-8 border-2 border-primary/5 bg-primary/[0.02] rounded-3xl">
        <div className="flex gap-4 items-start">
          <div className="p-3 bg-primary/10 rounded-xl text-primary mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-[12px] font-black text-white uppercase tracking-widest mb-2">Editor Protocol</h4>
            <p className="text-[11px] text-white/40 leading-relaxed max-w-2xl font-questrial tracking-wide italic">
              Site assets are indexed sequentially. Deleting an asset will automatically shift the "New Slot" index. 
              Changes are live immediately across the production environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
