"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ManagerLayout from "../../components/manage/ManagerLayout";
import CreateTournamentForm from "../../components/tournaments/manage/CreateTournamentForm";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";

export default function CreateTournamentPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchMe = async () => {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (res.ok) {
        const data = await safeJson(res);
        const roles = data?.roles ?? [];
        if (!roles.includes("ADMIN") && !roles.includes("ORGANIZER")) {
          setIsAuthorized(false);
          router.push("/");
          return;
        }
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.push("/auth");
      }
    };
    fetchMe();
  }, []);

  // Straight to the new tournament's own manage page (agreed 2026-09-17), which
  // opens on Players for anything not yet started — getting people in is the
  // next job either way. It used to land on the list of every tournament, where
  // the first thing to do was find the one just created.
  const handleSuccess = (tournamentId: string) =>
    router.push(tournamentId ? `/tournaments/${tournamentId}/manage` : "/tournaments/manage");

  if (isAuthorized === false) return null;
  if (isAuthorized === null) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-black uppercase tracking-widest animate-pulse">Checking your access…</div>;

  return (
    <ManagerLayout breadcrumbs={[{ label: "TOURNAMENTS", href: "/tournaments/manage" }, { label: "CREATE NEW" }]}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight uppercase leading-none">Create Tournament</h1>
          <p className="text-sm text-white/40 mt-4">
            Three steps: what it is, how matches are won, and when it runs. You can change any of
            it from the tournament&apos;s settings until it starts.
          </p>
        </div>

        {message && (
          <div className="mb-8 p-4 bg-[#FF4D4D]/10 border border-[#FF4D4D]/25 rounded-[4px] text-[#FF4D4D] text-sm">
            {message}
          </div>
        )}

        <CreateTournamentForm 
          onSuccess={handleSuccess} 
          onError={setMessage}
          onDiscard={() => router.push("/tournaments/manage")} 
        />
      </div>
    </ManagerLayout>
  );
}
