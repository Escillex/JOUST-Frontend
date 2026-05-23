"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { usePathname, useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

interface ManagerLayoutProps {
  children: React.ReactNode;
  breadcrumbs: { label: string; href?: string }[];
}

export default function ManagerLayout({ children, breadcrumbs }: ManagerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        if (res.ok) {
          const data = await safeJson(res);
          if (!data?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER")) {
            router.push("/");
            return;
          }
          setUser(data);
        } else {
          router.push("/auth");
          return;
        }
      } catch (err) {
        router.push("/auth");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const navLinks = [
    { label: "DASHBOARD", href: "/tournaments/manage" },
    { label: "CREATE NEW", href: "/tournaments/create" },
  ];

  if (user?.roles?.includes("ADMIN")) {
    navLinks.push({ label: "ADMIN CENTER", href: "/admin" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1B1B1B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Initializing Management Session</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#1B1B1B] text-[#E0E0E0] ${inter.className} flex flex-col`}>
      <div className="flex-1 flex flex-col overflow-x-hidden">
        {/* Content Area */}
        <main className="flex-1 p-10 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1B1B1B; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52B946; }
      `}} />
    </div>
  );
}
