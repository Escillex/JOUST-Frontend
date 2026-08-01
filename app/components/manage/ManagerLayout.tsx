"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../ui/Skeleton";

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

  return (
    <div className={`min-h-screen bg-background text-[#E0E0E0] ${inter.className} flex flex-col`}>
      {/* Navigation and breadcrumbs. Both were computed here and then never
          rendered — every caller has been passing a `breadcrumbs` trail that no
          user could see, and `navLinks` (with its role-gated admin entry) was
          built and discarded. Rendering them is the fix rather than deleting the
          prop, because the callers had already written the right information. */}
      <header className="border-b border-white/10 bg-background">
        <div className="max-w-[1600px] mx-auto w-full px-10 flex items-center gap-8 h-14">
          <span className="text-sm font-bold tracking-tight text-white shrink-0">
            Hobby<span className="text-primary">+</span>
          </span>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              // Exact match for the dashboard, prefix match elsewhere, so a
              // nested route still highlights its section.
              const active =
                link.href === "/tournaments/manage"
                  ? pathname === link.href
                  : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-widest rounded transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-[#888888] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

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
