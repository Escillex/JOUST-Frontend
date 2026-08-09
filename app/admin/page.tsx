"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { motion, AnimatePresence } from "motion/react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { useToast } from "../components/ui/Toast";
import StatCard from "../components/admin/StatCard";
import UserRegistry, { AdminUser } from "../components/admin/UserRegistry";
import TournamentTable, { AdminTournament } from "../components/admin/TournamentTable";
import UserModal from "../components/admin/UserModal";
import ConvertGuestModal from "../components/admin/ConvertGuestModal";
import DevPanel from "../components/admin/DevPanel";
import PresetManager from "../components/admin/PresetManager";
import GameManager from "../components/admin/GameManager";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../components/ui/Skeleton";



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
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "DEV_TOOLS" | "PRESETS" | "GAMES">("DASHBOARD");
  const [pendingGameRequests, setPendingGameRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, registeredUsers: 0, guestUsers: 0, totalTournaments: 0, activeTournaments: 0, completedTournaments: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [latency, setLatency] = useState(0);
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds(prev => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [guestToConvert, setGuestToConvert] = useState<AdminUser | null>(null);

  const [formats, setFormats] = useState<any[]>([]);
  const [isCreatingFormat, setIsCreatingFormat] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Deep-link ?tab=GAMES so a GAME_REQUESTED notification lands on the queue.
    // Read from window rather than useSearchParams to avoid the Suspense-boundary
    // build requirement in a fully-client page.
    const t = new URLSearchParams(window.location.search).get("tab")?.toUpperCase();
    if (t === "GAMES" || t === "PRESETS" || t === "DEV_TOOLS") setActiveTab(t);
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted, router, activeTab]);

  // Badge the GAMES tab with the pending request count, independent of whether the
  // tab is open. GameManager keeps it live via onPendingCountChange after resolves.
  useEffect(() => {
    if (!mounted) return;
    authenticatedFetch(API_ENDPOINTS.GAMES.REQUESTS)
      .then(safeJson)
      .then((d) => { if (Array.isArray(d)) setPendingGameRequests(d.length); })
      .catch(() => {});
  }, [mounted]);

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
      toast("Failed to load dashboard data", "error");
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

  const handleForceComplete = (id: string) =>
    withBusy(id, async () => {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(id), { method: "PATCH" });
      if (res.ok) {
        setTournaments(prev => prev.map(t => t.id === id ? { ...t, status: "COMPLETED" } : t));
        setStats(prev => ({ ...prev, activeTournaments: prev.activeTournaments - 1, completedTournaments: prev.completedTournaments + 1 }));
        toast("Tournament force-completed", "success");
      } else {
        const data = await safeJson(res);
        toast(data?.message || "Failed to complete tournament", "error");
      }
    });

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
          // Plain error message instead of a code like "INIT_FAILURE".
          // Real users read this text, so it must be normal language.
          throw new Error(errData?.message || "Failed to create user");
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
          throw new Error("Failed to save user changes");
        }
      }
      await fetchData();
      // Show a visible confirmation. Before this change nothing on the
      // screen told the admin the action worked.
      toast(userId ? "User updated" : "User created", "success");
    } catch (err: any) {
      // The old code stored the error in a state variable that was never
      // shown on screen, so failures were invisible. A toast is visible.
      toast(err.message, "error");
      // Re-throw so the modal knows it failed and stays open.
      throw err;
    }
  };

  // confirm() popups are not allowed in this project (CLAUDE.md rule 5).
  // Instead we run the action directly and block repeat clicks with
  // withBusy, then report the result with a toast.
  const handleDeleteUser = (userId: string) =>
    withBusy(userId, async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_USER(userId), { method: "DELETE" });
        if (res.ok) {
          const updatedUsers = users.filter(u => (u.id !== userId && u.sub !== userId));
          setUsers(updatedUsers);
          updateStats(updatedUsers, tournaments);
          toast("User deleted", "success");
        } else {
          const data = await safeJson(res);
          toast(data?.message || "Failed to delete user", "error");
        }
      } catch {
        toast("Network error while deleting user", "error");
      }
    });

  // Same pattern as handleDeleteUser: no confirm() popup, block double
  // clicks with withBusy, show the outcome with a toast. The backend
  // refuses to delete a preset that is still in use, so that error
  // message must reach the admin instead of being hidden.
  const handleDeleteFormat = (formatId: string) =>
    withBusy(formatId, async () => {
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.PRESETS.DELETE(formatId), { method: "DELETE" });
        if (res.ok) {
          setFormats(prev => prev.filter(f => f.id !== formatId));
          toast("Format preset deleted", "success");
        } else {
          const data = await safeJson(res);
          toast(data?.message || "Failed to delete format preset", "error");
        }
      } catch {
        toast("Network error while deleting format preset", "error");
      }
    });

  const handleBatchDelete = async (userIds: string[]) => {
    setIsLoading(true);
    try {
      const results = await Promise.all(
        userIds.map(id => authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_USER(id), { method: "DELETE" }))
      );
      // Some deletes can succeed while others fail, so we count the
      // failures and report an exact number instead of a vague error.
      const successCount = results.filter(r => r.ok).length;
      if (successCount < userIds.length) {
        toast(`${userIds.length - successCount} of ${userIds.length} users could not be deleted`, "error");
      } else {
        toast(`${successCount} users deleted`, "success");
      }
      await fetchData();
    } catch {
      toast("Network error during batch delete", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertGuest = async (guestId: string, data: any) => {
    // This function must THROW when the request fails. The modal only
    // closes when this promise resolves, so throwing keeps the modal
    // open and lets the admin fix the input and try again. The old
    // version swallowed the error, so the modal closed and it looked
    // like the conversion worked when it did not.
    const res = await authenticatedFetch(API_ENDPOINTS.AUTH.CONVERT_GUEST(guestId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await safeJson(res);
      const msg = errData?.message || "Failed to convert guest";
      toast(msg, "error");
      throw new Error(msg);
    }
    await fetchData();
    toast("Guest converted to a registered account", "success");
  };

  if (isAuthorized === false) return null;

  if (isMobile) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 border border-white/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">Desktop Required</h2>
      <p className="text-xs text-white/40 max-w-sm mb-8 leading-relaxed font-questrial">
        The System Admin Center contains high-density data tables and diagnostic logs that require a larger viewport. Please access this panel from a desktop device.
      </p>
      <button 
        onClick={() => router.push("/tournaments")}
        className="px-6 py-3 bg-white text-black hover:bg-primary transition-colors text-[10px] font-black uppercase tracking-widest"
      >
        Return to Tournaments
      </button>
    </div>
  );

  // The tab chrome renders immediately and only the panel body is a placeholder,
  // so the administrator can switch tabs while the first fetch is still running
  // instead of waiting on a full-screen spinner.
  const isLoadingUsers = isLoading && users.length === 0;

  return (
    <div className={`min-h-screen bg-background text-[#E0E0E0] ${inter.className} flex flex-col p-4 md:p-12 gap-0`}>
      <div className="max-w-7xl mx-auto w-full flex flex-col">
        {/* Tactical Folder Tabs */}
        <div className="flex items-end gap-1 px-4">
          {/* Brand Tab */}
          <div className="px-6 py-4 bg-background border-t-2 border-l-2 border-r-2 border-white/10 flex flex-col justify-center min-w-[160px]">
            <div className="text-white font-black tracking-tighter text-xl font-poppins uppercase leading-none">
              JOUST<br/>
              <span className="text-primary text-[8px] tracking-[0.4em] font-bold">ADMIN</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          {(["DASHBOARD", "GAMES", "PRESETS", "DEV_TOOLS"] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-t-2 border-l-2 border-r-2 relative z-20 -mb-[2px] ${
                activeTab === tab 
                  ? "bg-[#111] border-white/20 text-primary pt-6" 
                  : "bg-background border-white/5 text-white/30 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.replace("_", " ")}
              {tab === "GAMES" && pendingGameRequests > 0 && (
                <span className="ml-2 inline-flex items-center justify-center text-[8px] font-black text-black bg-primary rounded-full px-1.5 py-0.5 align-middle">
                  {pendingGameRequests}
                </span>
              )}
              {activeTab === tab && (
                <div className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-[#111] z-30" />
              )}
            </button>
          ))}
        </div>

        {/* Main Folder Body */}
        <div className="bg-[#111] border-2 border-white/20 shadow-2xl relative z-10 flex flex-col min-h-[80vh]">
          <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
        {isLoadingUsers ? (
          <div className="space-y-6">
            <SkeletonStatus label="Loading administration data" />
            <Skeleton className="h-8 w-56" />
            <SkeletonPanel rows={8} />
          </div>
        ) : (
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
                  <div className="bg-background border border-white/10 p-1">
                    <UserRegistry       
                      users={users}             
                      onDelete={handleDeleteUser}
                      onBatchDelete={handleBatchDelete}
                      onConvert={setGuestToConvert}
                      onEdit={(u) => { setUserToEdit(u); setIsUserModalOpen(true); }}
                      onCreateClick={() => { setUserToEdit(null); setIsUserModalOpen(true); }}
                    />
                  </div>
                  
                  <div className="bg-background border border-white/10 p-1">
                    <TournamentTable tournaments={tournaments} onForceComplete={handleForceComplete} />
                  </div>
                </div>

                {/* Column 2: System Utilities (Narrow) */}
                <div className="lg:col-span-4 space-y-8">
                  {/* The "System Audit Log" card was removed. It was not
                      a real audit log: it re-downloaded all users and
                      tournaments every 10 seconds just to invent
                      log-looking lines from them. */}

                  {/* Tournament Format Manager */}
                  <div className="bg-background border border-white/10 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">Tournament Formats</h3>
                      {/* Switch the tab state directly. The old link pushed
                          "?tab=PRESETS" to the URL, but nothing on this page
                          reads that query parameter, so the button did nothing. */}
                      <button
                        onClick={() => setActiveTab("PRESETS")}
                        className="text-[9px] font-black text-primary uppercase tracking-widest hover:brightness-125"
                      >
                        MANAGE
                      </button>
                    </div>
 
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {formats.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 border border-white/5 hover:border-white/10 transition-all group/item">
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{f.name}</p>
                            {f.gameName && <p className="text-[8px] text-primary/60 mt-0.5 tracking-tighter uppercase">{f.gameName}</p>}
                            {f.isBuiltin && <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">BUILT-IN</span>}
                          </div>
                          <button
                            onClick={() => handleDeleteFormat(f.id)}
                            className="opacity-0 group-hover/item:opacity-100 hover:text-red-500 text-white/20 text-xs font-bold transition-all px-2 py-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-background border border-white/10 p-6">
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
              <div className="bg-background border border-white/10 p-10">
                <PresetManager />
              </div>
            </motion.div>
          ) : activeTab === "GAMES" ? (
            <motion.div
              key="games"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto w-full pb-12"
            >
              <div className="mb-12">
                <Breadcrumbs items={[{ label: "ADMIN", href: "/admin" }, { label: "GAMES" }]} />
                <h1 className="text-4xl font-black text-white tracking-tight font-poppins uppercase leading-none mt-2">Game Catalog</h1>
                <p className="text-sm text-white/30 mt-4">The games organizers can attach to tournaments. Requests from organizers arrive as notifications.</p>
              </div>
              <div className="bg-background border border-white/10 p-10">
                <GameManager onPendingCountChange={setPendingGameRequests} />
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
                <h1 className="text-4xl font-black text-white tracking-tight font-poppins uppercase leading-none mt-2">Diagnostics</h1>
                <p className="text-sm text-white/30 mt-4">System-level diagnostic tools for direct database state management.</p>
              </div>
              <div className="bg-background border border-white/10 p-1">
                <DevPanel tournaments={tournaments} onRefresh={fetchData} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
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
