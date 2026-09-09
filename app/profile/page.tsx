"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson, profileHref } from "../utils/api";

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        if (res.ok) {
          const user = await safeJson(res);
          if (user?.slug || user?.sub || user?.id) {
            router.replace(profileHref(user));
            return;
          }
        }
      } catch (err) {
        console.error("Profile redirect failed:", err);
      }
      router.replace("/auth");
    };
    redirect();
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse font-poppins">Redirecting to Profile</p>
      </div>
    </div>
  );
}
