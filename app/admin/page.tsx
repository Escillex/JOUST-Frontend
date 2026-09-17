"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { motion, AnimatePresence } from "motion/react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { useToast } from "../components/ui/Toast";
import StatCard from "../components/admin/StatCard";
import AnalyticsPanel from "../components/admin/AnalyticsPanel";
import SettingsPanel from "../components/admin/SettingsPanel";
import BackupPanel from "../components/admin/BackupPanel";
import AwardManager from "../components/admin/AwardManager";
import ActivityLog from "../components/admin/ActivityLog";
import ModerationPanel from "../components/admin/ModerationPanel";
import GrantAwardModal from "../components/awards/GrantAwardModal";
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

/**
 * Nine tabs did not fit, so they were shrunk until they did — which is the point
 * at which a tab strip has stopped being navigation. They group into four things
 * an administrator actually does: watch the platform, act on people, define the
 * reusable pieces, and configure the installation.
 *
 * `activeTab` stays the single source of truth (every panel and the ?tab= deep
 * links already speak it); the group is derived from it, never stored, so the
 * two can never disagree.
 */
type AdminTab =
  | "DASHBOARD" | "ANALYTICS"
  | "USERS" | "MODERATION"
  | "GAMES" | "PRESETS" | "AWARDS"
  | "SETTINGS" | "BACKUPS" | "DEV_TOOLS";

const ADMIN_GROUPS: {
  key: string;
  label: string;
  // `href` entries are their own page rather than a panel on this one.
  tabs: { tab?: AdminTab; href?: string; label: string }[];
}[] = [
  { key: "OVERVIEW", label: "Overview", tabs: [
    { tab: "DASHBOARD", label: "Summary" },
    { tab: "ANALYTICS", label: "Analytics" },
  ] },
  { key: "PEOPLE", label: "People", tabs: [
    { tab: "USERS", label: "Users" },
    { tab: "MODERATION", label: "Moderation" },
  ] },
  { key: "CATALOG", label: "Catalog", tabs: [
    { tab: "GAMES", label: "Games" },
    { tab: "PRESETS", label: "Formats" },
    { tab: "AWARDS", label: "Awards" },
  ] },
  { key: "SYSTEM", label: "System", tabs: [
    { tab: "SETTINGS", label: "Settings" },
    { tab: "BACKUPS", label: "Backups" },
    // Its own route. It used to be reachable only from a link block on the old
    // dashboard; when that block went, the page was orphaned.
    { href: "/admin/editor", label: "Home page" },
    { tab: "DEV_TOOLS", label: "Developer tools" },
  ] },
];

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
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");
  // Who the grant modal is open for, from a user-management row.
  const [awardTarget, setAwardTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingGameRequests, setPendingGameRequests] = useState(0);
  const [openReports, setOpenReports] = useState(0);
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

  // F6. Deleting a user who is still active in a live tournament is refused by the
  // backend. This drives a two-step confirm: (1) you must forfeit them first,
  // (2) are you sure? — forfeit is irreversible. On confirm we forfeit them from
  // each live tournament, then delete.
  const [forfeitPrompt, setForfeitPrompt] = useState<{
    userId: string;
    tournaments: { id: string; name: string }[];
    step: 1 | 2;
  } | null>(null);
  const [forfeitBusy, setForfeitBusy] = useState(false);


  // First-run setup (docs/setup-wizard-plan.md). Unguarded endpoint, so this
  // resolves even before the admin's own data loads; false until it answers, so
  // a finished deployment never flashes the banner.
  const [setupDone, setSetupDone] = useState(true);
  useEffect(() => {
    authenticatedFetch(API_ENDPOINTS.SETUP.STATUS)
      .then(async (r) => (r.ok ? await safeJson(r) : null))
      .then((d) => { if (d) setSetupDone(!!d.completed); })
      .catch(() => undefined);
  }, []);


  useEffect(() => {
    setMounted(true);
    // Deep-link ?tab=GAMES so a GAME_REQUESTED notification lands on the queue.
    // Read from window rather than useSearchParams to avoid the Suspense-boundary
    // build requirement in a fully-client page.
    const t = new URLSearchParams(window.location.search).get("tab")?.toUpperCase();
    // Checked against the group table rather than a hand-kept list, which is
    // how USERS would have been forgotten the moment it was added.
    const known = ADMIN_GROUPS.flatMap((g) => g.tabs.map((x) => x.tab)).filter(Boolean);
    if (t && (known as string[]).includes(t)) setActiveTab(t as AdminTab);
  }, []);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted, router, activeTab]);

  // Badge the GAMES tab with the pending request count, independent of whether the
  // tab is open. GameManager keeps it live via onPendingCountChange after resolves.
  // Same for MODERATION: reported items awaiting an admin. Both wait until the
  // role check has passed — a player who lands here is redirected, and firing
  // admin-only reads first just produced two 403s on the way out.
  useEffect(() => {
    if (!mounted || isAuthorized !== true) return;
    authenticatedFetch(API_ENDPOINTS.MODERATION.COUNT)
      .then(safeJson)
      .then((d) => { if (typeof d?.open === "number") setOpenReports(d.open); })
      .catch(() => {});
  }, [mounted, isAuthorized]);

  useEffect(() => {
    if (!mounted || isAuthorized !== true) return;
    authenticatedFetch(API_ENDPOINTS.GAMES.REQUESTS)
      .then(safeJson)
      .then((d) => { if (Array.isArray(d)) setPendingGameRequests(d.length); })
      .catch(() => {});
  }, [mounted, isAuthorized]);

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

      // Presets are fetched by PresetManager itself; this page stopped rendering
      // a formats list when the Catalog tab took that job, so the third request
      // was a page-load cost buying nothing.
      const [usersRes, tourneyRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.AUTH.USERS),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE),
      ]);
      const usersData: AdminUser[]       = (await safeJson(usersRes))  ?? [];
      const tourneyData: AdminTournament[] = (await safeJson(tourneyRes)) ?? [];

      setUsers(usersData);
      setTournaments(tourneyData);
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
          // F6: user is in a live tournament — open the forfeit-then-delete flow
          // instead of just erroring.
          if (data?.code === "ACTIVE_IN_LIVE_TOURNAMENT" && Array.isArray(data?.tournaments)) {
            setForfeitPrompt({ userId, tournaments: data.tournaments, step: 1 });
          } else {
            toast(data?.message || "Failed to delete user", "error");
          }
        }
      } catch {
        toast("Network error while deleting user", "error");
      }
    });

  // F6 step 2 → confirmed: forfeit the user from each live tournament, then delete.
  const confirmForfeitAndDelete = async () => {
    if (!forfeitPrompt) return;
    const { userId, tournaments: liveTournaments } = forfeitPrompt;
    setForfeitBusy(true);
    try {
      for (const t of liveTournaments) {
        await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.FORFEIT(t.id, userId), {
          method: "POST",
        });
      }
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.DELETE_USER(userId), { method: "DELETE" });
      if (res.ok) {
        const updatedUsers = users.filter(u => u.id !== userId && u.sub !== userId);
        setUsers(updatedUsers);
        updateStats(updatedUsers, tournaments);
        toast("User forfeited and deleted", "success");
        setForfeitPrompt(null);
      } else {
        const data = await safeJson(res);
        toast(data?.message || "Failed to delete after forfeit", "error");
      }
    } catch {
      toast("Network error during forfeit-and-delete", "error");
    } finally {
      setForfeitBusy(false);
    }
  };

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


  // The tab chrome renders immediately and only the panel body is a placeholder,
  // so the administrator can switch tabs while the first fetch is still running
  // instead of waiting on a full-screen spinner.
  const isLoadingUsers = isLoading && users.length === 0;


  return (
    <div className={`min-h-screen bg-background text-[#E0E0E0] ${inter.className} flex flex-col px-4 md:px-6 py-8 gap-0`}>
      {!setupDone && (
        <a
          href="/setup"
          className="mb-6 flex items-center justify-between gap-4 border border-primary/40 bg-primary/5 px-5 py-4 hover:bg-primary/10 transition-colors"
        >
          <span className="space-y-1">
            <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Setup not finished</span>
            <span className="block text-[13px] text-[#B0B0B0] leading-relaxed">
              Email, two-factor sign-in and backups have never been confirmed on this deployment.
            </span>
          </span>
          <span className="text-[11px] font-semibold text-primary shrink-0">Run setup →</span>
        </a>
      )}
      {forfeitPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="bg-[#1B1B1B] border border-white/20 rounded max-w-md w-full p-6 space-y-4 shadow-[0_0_40px_rgba(0,0,0,1)]">
            {forfeitPrompt.step === 1 ? (
              <>
                <h3 className="text-sm font-semibold text-white">Forfeit required before deletion</h3>
                <p className="text-[13px] text-[#B0B0B0] leading-relaxed">
                  This user is an active participant in{" "}
                  <span className="text-white font-semibold">{forfeitPrompt.tournaments.length}</span>{" "}
                  live tournament(s):{" "}
                  <span className="text-white">{forfeitPrompt.tournaments.map(t => t.name).join(", ")}</span>.
                  They must be forfeited from those before the account can be deleted.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setForfeitPrompt(null)}
                    className="flex-1 h-10 text-xs font-semibold border border-white/20 text-[#B0B0B0] hover:text-white transition-colors rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setForfeitPrompt({ ...forfeitPrompt, step: 2 })}
                    className="flex-1 h-10 text-xs font-semibold bg-primary text-black rounded hover:brightness-90 transition-colors"
                  >
                    Forfeit &amp; continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-[#FF4D4D] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Are you sure?</h3>
                    <p className="text-[13px] text-[#B0B0B0] leading-relaxed">
                      This will forfeit the user (awarding their pending matches to their
                      opponents) and then permanently delete the account. This is{" "}
                      <span className="text-white font-semibold">irreversible</span>.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setForfeitPrompt(null)}
                    disabled={forfeitBusy}
                    className="flex-1 h-10 text-xs font-semibold border border-white/20 text-[#B0B0B0] hover:text-white transition-colors rounded disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void confirmForfeitAndDelete()}
                    disabled={forfeitBusy}
                    className="flex-1 h-10 text-xs font-semibold bg-[#FF4D4D] text-white rounded hover:brightness-90 transition-colors disabled:opacity-50"
                  >
                    {forfeitBusy ? "Working…" : "Forfeit & delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto w-full flex flex-col">
        {/* Two levels, both plain: the group, then what is inside it. No folder
            metaphor, no brand tab — the navbar already says where you are. */}
        <div className="border-b border-white/10">
          <div className="flex flex-wrap items-center gap-1">
            {ADMIN_GROUPS.map((group) => {
              const isActive = group.tabs.some((t) => t.tab === activeTab);
              // A badge on a sub-tab has to be visible from the group, or it is
              // hidden behind a click and stops being a notification.
              const badge =
                (group.tabs.some((t) => t.tab === "MODERATION") ? openReports : 0) +
                (group.tabs.some((t) => t.tab === "GAMES") ? pendingGameRequests : 0);
              return (
                <button
                  key={group.key}
                  onClick={() => { const first = group.tabs.find((t) => t.tab); if (first?.tab) setActiveTab(first.tab); }}
                  className={`px-4 py-3 text-[13px] font-semibold transition-colors border-b-2 -mb-[2px] ${
                    isActive
                      ? "border-primary text-white"
                      : "border-transparent text-[#E0E0E0]/45 hover:text-[#E0E0E0]"
                  }`}
                >
                  {group.label}
                  {badge > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center text-[10px] font-semibold text-black bg-[#FF4D4D] rounded-full px-1.5">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {(() => {
          const group = ADMIN_GROUPS.find((g) => g.tabs.some((t) => t.tab === activeTab));
          if (!group) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 py-4">
              {group.tabs.map(({ tab, href, label }) => {
                const base =
                  "px-3 h-8 inline-flex items-center text-xs font-semibold rounded border transition-colors";
                if (href) {
                  return (
                    <a
                      key={href}
                      href={href}
                      className={`${base} border-white/10 text-[#E0E0E0]/45 hover:text-[#E0E0E0] hover:border-white/20`}
                    >
                      {label} <span aria-hidden className="ml-1.5 text-[#E0E0E0]/30">→</span>
                    </a>
                  );
                }
                const count = tab === "MODERATION" ? openReports : tab === "GAMES" ? pendingGameRequests : 0;
                return (
                  <button
                    key={tab}
                    onClick={() => tab && setActiveTab(tab)}
                    className={`px-3 h-8 text-xs font-semibold rounded border transition-colors ${
                      activeTab === tab
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-white/10 text-[#E0E0E0]/45 hover:text-[#E0E0E0] hover:border-white/20"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className="ml-2 text-[10px] font-semibold text-[#FF4D4D]">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Main Folder Body */}
        <div className="flex flex-col min-h-[70vh]">
          <main className="flex-1">
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
              className="w-full space-y-8 pb-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-white">Overview</h1>
                  <p className="text-sm text-[#E0E0E0]/45 mt-2 max-w-2xl">
                    Tournaments on this installation, and a record of every action staff have taken.
                  </p>
                </div>
              </div>

              {/* Stats Bento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Users"        value={stats.totalUsers}           subtitle={`${stats.registeredUsers} registered · ${stats.guestUsers} guest`} delay={0.1} color="text-primary" />
                <StatCard title="Tournaments"   value={stats.totalTournaments}    subtitle="All time" delay={0.2} color="text-white" />
                <StatCard title="Running now"     value={stats.activeTournaments}    subtitle="In progress" delay={0.3} color="text-amber-400" />
                <StatCard title="Response time"      value={`${latency}ms`}            subtitle="Server round trip" delay={0.4} color={latency < 200 ? "text-primary" : "text-amber-400"} />
              </div>

              {/* Tournaments, then the log of what was done to them. Users moved
                  to People; the formats mini-panel and the "external gateways"
                  link block went with the navbar's Manage entry and the Catalog
                  tab, which both do the same job properly. */}
              <div className="bg-background border border-white/10 p-1">
                <TournamentTable tournaments={tournaments} onForceComplete={handleForceComplete} />
              </div>

              {/* Who did what, when — recorded server-side after each action
                  succeeds (todo.md obj. 3.1). */}
              <ActivityLog />
            </motion.div>
          ) : activeTab === "USERS" ? (
            <motion.div
              key="users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Users</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">
                  Every account on this installation. Guests are temporary accounts created by organizers.
                </p>
              </div>
              <div className="bg-background border border-white/10 p-1">
                <UserRegistry       
                      users={users}             
                      onDelete={handleDeleteUser}
                      onBatchDelete={handleBatchDelete}
                      onConvert={setGuestToConvert}
                      onEdit={(u) => { setUserToEdit(u); setIsUserModalOpen(true); }}
                      onAward={(u) => setAwardTarget({ id: u.id || u.sub!, name: u.username })}
                  onCreateClick={() => { setUserToEdit(null); setIsUserModalOpen(true); }}
                />
              </div>
            </motion.div>
          ) : activeTab === "ANALYTICS" ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Analytics</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Growth, game and format usage, and player engagement across the platform.</p>
              </div>
              <AnalyticsPanel />
            </motion.div>
          ) : activeTab === "SETTINGS" ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">System Settings</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Email delivery and security policy, applied without a redeploy.</p>
              </div>
              <SettingsPanel />
            </motion.div>
          ) : activeTab === "AWARDS" ? (
            <motion.div
              key="awards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Awards</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Medals users can pin to their profile, and plaques shown under their name. Give them from User Management or from a profile.</p>
              </div>
              <AwardManager />
            </motion.div>
          ) : activeTab === "MODERATION" ? (
            <motion.div
              key="moderation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Moderation</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Reported gallery images and tournament builds. Removed items are hidden at once and can be restored for 30 days.</p>
              </div>
              <ModerationPanel onCountChange={setOpenReports} />
            </motion.div>
          ) : activeTab === "BACKUPS" ? (
            <motion.div
              key="backups"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Database Backups</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Snapshot, restore, and export a sanitized copy for a second instance.</p>
              </div>
              <BackupPanel />
            </motion.div>
          ) : activeTab === "PRESETS" ? (
            <motion.div 
              key="presets"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Format Presets</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Manage standardized tournament configurations and rulesets for organizers.</p>
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
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Games</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">The games organizers can attach to tournaments. Requests from organizers arrive as notifications.</p>
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
              className="w-full pb-12"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white">Developer tools</h1>
                <p className="text-sm text-[#E0E0E0]/45 mt-2">Direct database actions for development and testing. Handle with care on a live installation.</p>
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

  {awardTarget && (
    <GrantAwardModal
      key={awardTarget.id}
      userId={awardTarget.id}
      userName={awardTarget.name}
      isOpen
      onClose={() => setAwardTarget(null)}
    />
  )}

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
