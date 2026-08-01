"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ManagerLayout from "../../components/manage/ManagerLayout";
import CreateTournamentForm from "../../components/tournaments/manage/CreateTournamentForm";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";

export default function CreateTournamentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
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
        setUserId(data?.sub || data?.id || "");
        setUserRoles(roles);
      } else {
        setIsAuthorized(false);
        router.push("/auth");
      }
    };
    fetchMe();
  }, []);

  const handleSuccess = (msg: string) => {
    if (msg.includes("Error")) {
      setMessage(msg);
      return;
    }
    router.push("/tournaments/manage");
  };

  if (isAuthorized === false) return null;
  if (isAuthorized === null) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-black uppercase tracking-widest animate-pulse">Verifying Creator Status...</div>;

  return (
    <ManagerLayout breadcrumbs={[{ label: "TOURNAMENTS", href: "/tournaments/manage" }, { label: "CREATE NEW" }]}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight uppercase leading-none">Create Tournament</h1>
          <p className="text-sm text-white/30 mt-4">
            Initialize a new competitive event with custom format configurations and access controls.
          </p>
        </div>

        {message && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-[4px] text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">
            {message}
          </div>
        )}

        <CreateTournamentForm 
          userId={userId}
          userRoles={userRoles}
          onSuccess={handleSuccess} 
          onDiscard={() => router.push("/tournaments/manage")} 
        />
      </div>
    </ManagerLayout>
  );
}
