"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HomeFrame from "../../components/HomeFrame";
import FadeIn from "../../components/FadeIn";
import ImageUpload from "../../components/ui/ImageUpload";
import { authenticatedFetch, API_ENDPOINTS, API_URL, UPLOAD_TIMEOUT_MS } from "../../utils/api";
import { useUser } from "../../components/UserProvider";
import { motion } from "motion/react";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const [uploading, setUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLocalAvatarUrl(user.avatarUrl || null);
    }
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.UPLOAD_AVATAR(user.id), {
        method: "POST",
        body: formData,
        // Uploads carry real bytes; the default request timeout is for reads.
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });

      if (res.ok) {
        const data = await res.json();
        setLocalAvatarUrl(data.avatarUrl);
        await refreshUser();
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!user) return;
    
    setUploading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.IMAGES.DELETE_AVATAR(user.id), {
        method: "DELETE",
      });

      if (res.ok) {
        setLocalAvatarUrl(null);
        await refreshUser();
      }
    } catch (err) {
      console.error("Avatar deletion failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
      <HomeFrame className="pt-32 pb-20" showPattern={false}>
        <div className="w-full max-w-3xl mx-auto px-6 md:px-8">
          <FadeIn>
            <div className="flex flex-col gap-12">
              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-component-border pb-12">
                <div>
                  <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white font-poppins leading-none mb-4">
                    EDIT PROFILE
                  </h1>
                  <p className="text-primary font-black uppercase tracking-widest text-[10px]">
                    Update your account settings and public identity.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/profile/${user?.id || user?.sub}`)}
                  className="px-8 py-3 border-2 border-component-border text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-white/20 transition-all font-poppins"
                >
                  BACK TO PROFILE
                </button>
              </div>

              {/* Main edit area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
                {/* Left: Avatar Upload Section */}
                <div className="space-y-6">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-4 flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary" />
                    PROFILE IMAGE
                  </div>
                  
                  <div className="w-full aspect-square max-w-[320px]">
                    <ImageUpload
                      currentUrl={localAvatarUrl}
                      onUpload={handleAvatarUpload}
                      onDelete={handleAvatarDelete}
                      uploading={uploading}
                      aspectRatio="aspect-square"
                      cropAspectRatio={1}
                      label="UPDATE AVATAR"
                      placeholder={
                        <div className="flex flex-col items-center gap-4">
                          <span className="text-8xl font-black font-poppins text-primary">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                          </span>
                        </div>
                      }
                    />
                  </div>
                </div>

                {/* Right: Info/Status section */}
                <div className="space-y-12 h-full flex flex-col justify-center">
                  <div className="bg-component-background border-l-4 border-primary p-8 space-y-4 border border-component-border">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-white font-poppins">REQUIREMENTS</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed font-questrial tracking-wider">
                      Your profile picture is your global signature in the Hobby+ ecosystem. 
                      Images are standardized to a high-fidelity 400x400 square format for optimal 
                      rendering across all interfaces.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-component-border p-6 bg-component-background">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Status</p>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">ACTIVE</p>
                    </div>
                    <div className="border border-component-border p-6 bg-component-background">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Visibility</p>
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">PUBLIC</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer greeble */}
              <div className="mt-12 flex items-center justify-between opacity-10">
                 <div className="text-[8px] font-mono tracking-widest uppercase">Identity Synchronized</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </HomeFrame>
    </div>
  );
}
