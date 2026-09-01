"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { useRouter } from "next/navigation";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../ui/Skeleton";

const inter = Inter({ subsets: ["latin"] });

interface ManagerLayoutProps {
  children: React.ReactNode;
  breadcrumbs: { label: string; href?: string }[];
}

export default function ManagerLayout({ children, breadcrumbs }: ManagerLayoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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

  return (
    <div className={`min-h-screen bg-background text-[#E0E0E0] ${inter.className} flex flex-col`}>
      {/* No local header: the app's single global navbar (Navibar / mobile bars,
          rendered in the root layout) is the one unification point across the
          browse and manage zones. This shell keeps only the auth guard, the
          breadcrumb trail, and the content area. */}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        {breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="max-w-[1600px] mx-auto w-full px-10 pt-8"
          >
            <ol className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#888888]">
              {breadcrumbs.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/20" aria-hidden="true">/</span>}
                  {crumb.href && i < breadcrumbs.length - 1 ? (
                    <Link href={crumb.href} className="hover:text-primary transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={i === breadcrumbs.length - 1 ? "text-white" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Content Area. While the authorization check is in flight the shell
            renders immediately with placeholder blocks instead of swapping the
            whole screen for a centred spinner, so the page does not visibly
            jump from one layout to another once the check resolves. */}
        <main className="flex-1 p-10 max-w-[1600px] mx-auto w-full">
          {loading ? (
            <div className="space-y-8">
              <SkeletonStatus label="Loading" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-3 w-96" />
              </div>
              <SkeletonPanel rows={5} />
            </div>
          ) : (
            children
          )}
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
