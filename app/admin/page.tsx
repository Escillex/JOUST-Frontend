"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { motion, AnimatePresence } from "motion/react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import StatCard from "../components/admin/StatCard";
import UserRegistry, { AdminUser } from "../components/admin/UserRegistry";
import TournamentTable, { AdminTournament } from "../components/admin/TournamentTable";
import UserModal from "../components/admin/UserModal";
import ConvertGuestModal from "../components/admin/ConvertGuestModal";
import SystemLogs from "../components/admin/SystemLogs";
import DevPanel from "../components/admin/DevPanel";
import PresetManager from "../components/admin/PresetManager";



const inter = Inter({ subsets: ["latin"] });

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-8">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-white/10">/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-primary transition-colors">{item.label}</a>
          ) : (
            <span className="text-white/10">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface Stats {
  totalUsers: number; registeredUsers: number; guestUsers: number;
  totalTournaments: number; activeTournaments: number; completedTournaments: number;
}


export default function AdminDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "DEV_TOOLS" | "PRESETS">("DASHBOARD");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, registeredUsers: 0, guestUsers: 0, totalTournaments: 0, activeTournaments: 0, completedTournaments: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [latency, setLatency] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [guestToConvert, setGuestToConvert] = useState<AdminUser | null>(null);

  // Tournament Format management
  const [formats, setFormats] = useState<any[]>([]);
  const [isCreatingFormat, setIsCreatingFormat] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted, router]);

  const fetchData = async () => {
    const startTime = performance.now();
    setIsLoading(true);
    try {
      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (!meRes.ok) { 
        if (mounted) router.push("/auth"); 
        return; 
      }
      const me = await safeJson(meRes);
      if (!me?.roles?.includes("ADMIN")) { 
        if (mounted) router.push("/"); 
        setIsAuthorized(false);
        return; 
      }
      setIsAuthorized(true);

      const [usersRes, tourneyRes, formatsRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.AUTH.USERS),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE),
        authenticatedFetch(API_ENDPOINTS.PRESETS.BASE),
      ]);
      const usersData: AdminUser[]       = (await safeJson(usersRes))  ?? [];
      const tourneyData: AdminTournament[] = (await safeJson(tourneyRes)) ?? [];
      const formatsData = (await safeJson(formatsRes)) ?? [];

      setUsers(usersData);
      setTournaments(tourneyData);
      setFormats(formatsData);
      updateStats(usersData, tourneyData);
      
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
    } catch (err) {
      console.error("Dashboard error", err);
      setErrorMsg("API_FAILURE: CONNECTION_LOST");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStats = (uData: AdminUser[], tData: AdminTournament[]) => {
    const guests = uData.filter(u => u.isGuest).length;
    setStats({
      totalUsers: uData.length,
      registeredUsers: uData.length - guests,
      guestUsers: guests,
      totalTournaments: tData.length,
      activeTournaments: tData.filter(t => t.status === "ONGOING" || t.status === "OPEN").length,
      completedTournaments: tData.filter(t => t.status === "COMPLETED").length,
    });
  };

  const handleForceComplete = async (id: string) => {
    if (!confirm("Execute terminal force-complete? All active matches will be finalized.")) return;
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(id), { method: "PATCH" });
    if (res.ok) {
      setTournaments(prev => prev.map(t => t.id === id ? { ...t, status: "COMPLETED" } : t));
      setStats(prev => ({ ...prev, activeTournaments: prev.activeTournaments - 1, completedTournaments: prev.completedTournaments + 1 }));
    } else {
      setErrorMsg("UPDATE_FAILURE: REQUEST_REJECTED");
    }
  };

  const handleUserModalSubmit = async (userId: string | null, data: any) => {
    try {
      if (!userId) {
        const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ADMIN_CREATE_USER, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errData = await safeJson(res);
          throw new Error(errData?.message || "INIT_FAILURE: USER_CREATION_REJECTED");
        }
      } else {
        const profileData = { username: data.username, email: data.email };
        if (data.password) (profileData as any).password = data.password;

        const [profileRes, rolesRes] = await Promise.all([
          authenticatedFetch(API_ENDPOINTS.AUTH.UPDATE_PROFILE(userId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileData),
          }),
          authenticatedFetch(API_ENDPOINTS.AUTH.ROLES(userId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roles: data.roles }),
          })
        ]);

        if (!profileRes.ok || !rolesRes.ok) {
          throw new Error("SYNC_FAILURE: UPDATE_REJECTED");
        }
      }
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
      throw err;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Permanently delete this user record?")) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_USER(userId), { method: "DELETE" });
      if (res.ok) {
        const updatedUsers = users.filter(u => (u.id !== userId && u.sub !== userId));
        setUsers(updatedUsers);
        updateStats(updatedUsers, tournaments);
      } else {
        const data = await safeJson(res);
        setErrorMsg(`DELETE_FAILURE: ${data?.message || "REJECTION"}`);
      }
    } catch (err) {
      setErrorMsg("API_ERROR: DELETE_COMMAND_TIMED_OUT");
    }
  };

  const handleBatchDelete = async (userIds: string[]) => {
    if (!confirm(`Delete ${userIds.length} selected user records?`)) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        userIds.map(id => authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_USER(id), { method: "DELETE" }))
      );
      const successCount = results.filter(r => r.ok).length;
      if (successCount < userIds.length) {
        setErrorMsg(`BATCH_FAILURE: ${userIds.length - successCount} USERS REMAIN`);
      }
      await fetchData();
    } catch (err) {
      setErrorMsg("BATCH_ERROR: EXECUTION_STOPPED");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertGuest = async (guestId: string, data: any) => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.CONVERT_GUEST(guestId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const errData = await safeJson(res);
        setErrorMsg(`UPDATE_FAILURE: ${errData?.message || "REJECTION"}`);
      }
    } catch (err) {
      setErrorMsg("API_ERROR: UPDATE_TIMED_OUT");
    }
  };

  if (isAuthorized === false) return null;

  if (isLoading && users.length === 0) return (
    <div className="min-h-screen w-full bg-[#1B1B1B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-white/5 border-t-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary animate-pulse font-poppins italic">Authorizing Admin Session...</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#1B1B1B] text-[#E0E0E0] ${inter.className} flex flex-col p-4 md:p-12 gap-0`}>
      <div className="max-w-7xl mx-auto w-full flex flex-col">
        {/* Tactical Folder Tabs */}
        <div className="flex items-end gap-1 px-4">
          {/* Brand Tab */}
          <div className="px-6 py-4 bg-[#1B1B1B] border-t-2 border-l-2 border-r-2 border-white/10 flex flex-col justify-center min-w-[160px]">
            <div className="text-white font-black tracking-tighter text-xl font-poppins uppercase leading-none">
              JOUST<br/>
              <span className="text-primary text-[8px] tracking-[0.4em] font-bold">ADMIN</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          {(["DASHBOARD", "PRESETS", "DEV_TOOLS"] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-t-2 border-l-2 border-r-2 relative z-20 -mb-[2px] ${
                activeTab === tab 
                  ? "bg-[#111] border-white/20 text-primary pt-6" 
                  : "bg-[#1B1B1B] border-white/5 text-white/30 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.replace("_", " ")}
              {activeTab === tab && (
                <div className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-[#111] z-30" />
              )}
            </button>
          ))}
        </div>

        {/* Main Folder Body */}
        <div className="bg-[#111] border-2 border-white/20 shadow-2xl relative z-10 flex flex-col min-h-[80vh]">
          <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
        <AnimatePresence mode="wait">
          {activeTab === "DASHBOARD" ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto w-full space-y-8 pb-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                  <Breadcrumbs items={[{ label: "ADMIN", href: "/admin" }, { label: "DASHBOARD" }]} />
                  <h1 className="text-4xl font-black text-white tracking-tight font-poppins uppercase leading-none mt-2">Management Overview</h1>
                  <p className="text-sm text-white/30 mt-4 max-w-2xl">
                    High-performance administrative hub for user records, tournament logistics, and real-time audit logs.
                  </p>
                </div>
              </div>

              {/* Stats Bento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="System Users"        value={stats.totalUsers}           subtitle={`${stats.registeredUsers} REG / ${stats.guestUsers} GUEST`} delay={0.1} color="text-primary" />
                <StatCard title="Total Tournaments"   value={stats.totalTournaments}    subtitle="Historical Volume" delay={0.2} color="text-white" />
                <StatCard title="Active Instances"     value={stats.activeTournaments}    subtitle="Ongoing Cycles" delay={0.3} color="text-amber-400" />
                <StatCard title="System Latency"      value={`${latency}ms`}            subtitle="Connection Health" delay={0.4} color={latency < 200 ? "text-primary" : "text-amber-400"} />
              </div>

              {/* Primary/Secondary Dual Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Column 1: Master Management (Wide) */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-[#1B1B1B] border border-white/10 p-1">
                    <UserRegistry       
                      users={users}             
                      onDelete={handleDeleteUser}
                      onBatchDelete={handleBatchDelete}
                      onConvert={setGuestToConvert}
                      onEdit={(u) => { setUserToEdit(u); setIsUserModalOpen(true); }}
                      onCreateClick={() => { setUserToEdit(null); setIsUserModalOpen(true); }}
                    />
                  </div>
                  
                  <div className="bg-[#1B1B1B] border border-white/10 p-1">
                    <TournamentTable tournaments={tournaments} onForceComplete={handleForceComplete} />
                  </div>
                </div>

                {/* Column 2: System Utilities (Narrow) */}
                <div className="lg:col-span-4 space-y-8">
                  <div className="bg-[#1B1B1B] border border-white/10 p-6">
                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-6">System Audit Log</h3>
                    <SystemLogs />
                  </div>

                  {/* Tournament Format Manager */}
                  <div className="bg-[#1B1B1B] border border-white/10 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Tournament Formats</h3>
                      <button
                        onClick={() => router.push("/admin?tab=PRESETS")}
                        className="text-[9px] font-black text-primary uppercase tracking-widest hover:brightness-125"
                      >
                        MANAGE
                      </button>
                    </div>
 
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {formats.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 border border-white/5 hover:border-white/10 transition-all">
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{f.name}</p>
                            {f.gameName && <p className="text-[8px] text-primary/60 mt-0.5 tracking-tighter uppercase">{f.gameName}</p>}
                            {f.isBuiltin && <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">BUILT-IN</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#1B1B1B] border border-white/10 p-6">
                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-6">External Gateways</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => router.push("/tournaments/manage")} 
                        className="p-4 border border-white/10 hover:border-primary/50 text-[10px] font-bold text-white uppercase tracking-widest transition-all text-left flex justify-between items-center group"
                      >
                        Organizer Portal
                        <svg className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </button>
                      <button 
                        onClick={() => router.push("/admin/editor")} 
                        className="p-4 border border-white/10 hover:border-primary/50 text-[10px] font-bold text-white uppercase tracking-widest transition-all text-left flex justify-between items-center group"
                      >
                        Site Visual Editor
                        <svg className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === "PRESETS" ? (
            <motion.div 
              key="presets"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto w-full pb-12"
            >
              <div className="mb-12">
                <Breadcrumbs items={[{ label: "ADMIN", href: "/admin" }, { label: "PRESETS" }]} />
                <h1 className="text-4xl font-black text-white tracking-tight font-poppins uppercase leading-none mt-2">Format Presets</h1>
                <p className="text-sm text-white/30 mt-4">Manage standardized tournament configurations and rulesets for organizers.</p>
              </div>
              <div className="bg-[#1B1B1B] border border-white/10 p-10">
                <PresetManager />
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="dev"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto w-full pb-12"
            >
              <div className="mb-12">
                <Breadcrumbs items={[{ label: "ADMIN", href: "/admin" }, { label: "DEV_TOOLS" }]} />
                <h1 className="text-4xl font-black text-white tracking-tight font-poppins uppercase leading-none mt-2">Diagnostic Console</h1>
                <p className="text-sm text-white/30 mt-4">System-level diagnostic tools for direct database state management.</p>
              </div>
              <div className="bg-[#1B1B1B] border border-white/10 p-1">
                <DevPanel tournaments={tournaments} onRefresh={fetchData} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  </div>

  <UserModal 
    isOpen={isUserModalOpen}
    user={userToEdit}
    onClose={() => setIsUserModalOpen(false)}
    onSubmit={handleUserModalSubmit}
  />

  <ConvertGuestModal 
    guest={guestToConvert}
    isOpen={!!guestToConvert}
    onClose={() => setGuestToConvert(null)}
    onSubmit={handleConvertGuest}
  />

  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border: 2px solid #000; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52B946; }
  `}</style>
</div>
  );
}
