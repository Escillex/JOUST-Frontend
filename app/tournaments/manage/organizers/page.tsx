"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS } from "../../../utils/api";
import { Skeleton, SkeletonRows, SkeletonStatus } from "../../../components/ui/Skeleton";

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

interface CurrentUser {
  id: string;
  email: string;
  roles: string[];
  username: string;
}

export default function OrganizersManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (meRes.ok) {
        const meData = await meRes.json();
        if (!meData.roles?.includes("ADMIN")) {
          router.push("/tournaments/manage");
          return;
        }
        setCurrentUser(meData);
      } else {
        router.push("/auth");
        return;
      }

      // /auth/registered-users is ADMIN-only, so every non-admin organizer got a 403
      // here and the picker below stayed empty. /auth/users is ORGANIZER|ADMIN; it
      // includes guests, so they are filtered out to keep the same meaning.
      const usersRes = await authenticatedFetch(API_ENDPOINTS.AUTH.USERS);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(
          usersData.filter((u: { isGuest?: boolean }) => !u.isGuest),
        );
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setMessage("Error: Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOrganizer = async (user: User) => {
    setMessage("");
    const isCurrentlyOrganizer = user.roles.includes("ORGANIZER");
    let newRoles: string[];

    if (isCurrentlyOrganizer) {
      newRoles = user.roles.filter((r) => r !== "ORGANIZER");
    } else {
      newRoles = [...user.roles, "ORGANIZER"];
    }

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.AUTH.ROLES(user.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: newRoles }),
      });

      if (response.ok) {
        setMessage(`Updated roles for ${user.username}`);
        const updatedUsers = users.map((u) =>
          u.id === user.id ? { ...u, roles: newRoles } : u
        );
        setUsers(updatedUsers);
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.message || "Could not update this user's roles"}`);
      }
    } catch (error) {
      setMessage("Error: Could not connect to the server");
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen w-full bg-background font-questrial overflow-x-hidden">
            <div className="w-full px-4 md:px-12 py-12 max-w-[1600px] mx-auto">
                <SkeletonStatus label="Loading user roles" />
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-foreground/5 pb-12">
                    <div>
                        <button
                            onClick={() => router.push("/tournaments/manage")}
                            className="text-[10px] font-black text-primary uppercase tracking-[0.4em] font-poppins mb-4 hover:opacity-70 transition-all flex items-center gap-2"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
                            Back to Dashboard
                        </button>
                        <Skeleton className="h-12 w-80" />
                    </div>
                </div>
                <div className="bg-foreground/5 border border-foreground/5 rounded-[2.5rem] p-8 md:p-12">
                    <Skeleton className="h-5 w-56 mb-8" />
                    <SkeletonRows rows={6} />
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background font-questrial overflow-x-hidden">
      
      <div className="w-full px-4 md:px-12 py-12 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-foreground/5 pb-12">
            <div>
                <button 
                    onClick={() => router.push("/tournaments/manage")}
                    className="text-[10px] font-black text-primary uppercase tracking-[0.4em] font-poppins mb-4 hover:opacity-70 transition-all flex items-center gap-2"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7"/></svg>
                    Back to Dashboard
                </button>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-foreground font-poppins">Organizer Roles</h1>
            </div>
            
            <div className="flex items-center gap-4 bg-foreground/5 border border-foreground/10 px-6 py-4 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black">
                    A
                </div>
                <div>
                    <p className="text-[9px] font-black text-foreground/40 uppercase tracking-widest font-poppins">Signed in as</p>
                    <p className="text-xs font-black text-foreground uppercase tracking-tight">{currentUser?.username}</p>
                </div>
            </div>
        </div>

        {/* Message area */}
        {message && (
          <div className={`mb-8 p-4 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest animate-in fade-in slide-in-from-top-2 ${
            message.startsWith("Error") ? "bg-red-500/10 border border-red-500/20 text-red-500" : "bg-primary/10 border border-primary/20 text-primary"
          }`}>
            {message}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-foreground/5 border border-foreground/5 rounded-[2.5rem] p-8 md:p-12">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground font-poppins mb-8 border-b border-foreground/10 pb-4">All Users</h2>
            
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em] border-b border-foreground/5">
                            <th className="py-6 pr-6">Username</th>
                            <th className="py-6 px-6">Email</th>
                            <th className="py-6 px-6 text-center">Roles</th>
                            <th className="py-6 pl-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-black text-foreground uppercase">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-20 text-center text-foreground/20 tracking-widest">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => {
                                const isOrganizer = u.roles.includes("ORGANIZER");
                                const isAdmin = u.roles.includes("ADMIN");
                                
                                return (
                                    <tr key={u.id} className="border-b border-foreground/5 hover:bg-background/50 transition-all group">
                                        <td className="py-6 pr-6 text-lg tracking-tighter font-poppins">{u.username}</td>
                                        <td className="py-6 px-6 text-xs text-foreground/40 tracking-wider font-questrial normal-case">{u.email}</td>
                                        <td className="py-6 px-6">
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {u.roles.map((role) => (
                                                    <span
                                                        key={role}
                                                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                                            role === "ADMIN" 
                                                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                                                                : role === "ORGANIZER"
                                                                ? "bg-primary/20 text-primary border border-primary/30"
                                                                : "bg-foreground/10 text-foreground/40"
                                                        }`}
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-6 pl-6 text-right">
                                            {!isAdmin ? (
                                                <button
                                                    onClick={() => handleToggleOrganizer(u)}
                                                    className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all font-poppins ${
                                                        isOrganizer
                                                            ? "border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white"
                                                            : "bg-primary text-white hover:brightness-110 shadow-lg shadow-primary/20"
                                                    }`}
                                                >
                                                    {isOrganizer ? "Revoke Organizer" : "Grant Organizer"}
                                                </button>
                                            ) : (
                                                <span className="text-[9px] text-foreground/20 uppercase font-black tracking-widest block py-3">
                                                    Administrator
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}