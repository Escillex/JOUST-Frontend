"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface AdminUser {
  id: string;
  sub?: string;
  username: string;
  email: string;
  roles: string[];
  isGuest: boolean;
}

interface Props {
  users: AdminUser[];
  onDelete: (id: string) => void;
  onBatchDelete: (ids: string[]) => void;
  onConvert: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  /** Opens GrantAwardModal. Omitted for guests: they cannot hold awards, since
   *  the guest-cleanup job would delete them along with the account. */
  onAward?: (user: AdminUser) => void;
  onCreateClick: () => void;
}

export default function UserRegistry({ users, onDelete, onBatchDelete, onConvert, onEdit, onAward, onCreateClick }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  /** Press twice to delete. No window.confirm (Core Rule 5), and a single click
   *  on an irreversible action sitting beside Edit was one slip from gone. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "REGISTERED" | "GUEST">("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<"select" | "deselect">("select");
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const filteredUsers = users.filter(u => {
    const usernameMatch = (u.username || "").toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    return (usernameMatch || emailMatch) && (filter === "ALL" || (filter === "GUEST" ? u.isGuest : !u.isGuest));
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => (u.sub || u.id) as string)));
    }
  };

  const handleRowMouseDown = (e: React.MouseEvent, idx: number, uid: string) => {
    if ((e.target as HTMLElement).closest('button, a')) return;

    if (e.shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, idx);
      const end = Math.max(lastSelectedIdx, idx);
      const next = new Set(e.ctrlKey || e.metaKey ? selectedIds : []);
      for (let i = start; i <= end; i++) {
        const id = (filteredUsers[i].sub || filteredUsers[i].id) as string;
        next.add(id);
      }
      setSelectedIds(next);
      e.preventDefault();
    } else {
      const isSelected = selectedIds.has(uid);
      let next = new Set(selectedIds);
      
      const isCheckbox = (e.target as HTMLElement).closest('input[type="checkbox"]');
      if (!e.ctrlKey && !e.metaKey && !isCheckbox) {
         next = new Set();
      }

      const willSelect = !isSelected || (!e.ctrlKey && !e.metaKey && !isCheckbox);
      
      if (willSelect) next.add(uid);
      else next.delete(uid);

      setSelectedIds(next);
      setLastSelectedIdx(idx);
      
      setIsDragging(true);
      setDragAction(willSelect ? "select" : "deselect");
    }
  };

  const handleRowMouseEnter = (idx: number, uid: string) => {
    if (!isDragging) return;
    const next = new Set(selectedIds);
    if (dragAction === "select") next.add(uid);
    else next.delete(uid);
    setSelectedIds(next);
    setLastSelectedIdx(idx);
  };

  return (
    <div className="bg-background border border-white/5 rounded-lg shadow-2xl flex flex-col h-[560px] md:h-[700px] overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/10 bg-white/[0.02] space-y-4 md:space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Accounts
            </h2>
            <p className="text-[10px] text-white/60 font-medium uppercase mt-1 tracking-widest">{filteredUsers.length} shown</p>
          </div>
          <div className="flex gap-3">
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    const hasAdmin = Array.from(selectedIds).some(id => users.find(u => (u.sub || u.id) === id)?.roles.includes('ADMIN'));
                    if (hasAdmin) {
                      alert("If you really wanna delete this account please remove admin permissions from the account");
                      return;
                    }
                    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} user(s)?`)) {
                      onBatchDelete(Array.from(selectedIds));
                    }
                  }}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all rounded-md"
                >
                  Delete Selected ({selectedIds.size})
                </motion.button>
              )}
            </AnimatePresence>
            <button onClick={onCreateClick} className="px-4 py-2 bg-primary text-black text-[10px] font-bold uppercase tracking-widest hover:shadow-[0_0_15px_rgba(82,185,70,0.4)] transition-all rounded-md">
              Create New User
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-10 py-3 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all rounded-md"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex shrink-0 bg-white/5 border border-white/10 p-1 rounded-md">
            {(["ALL", "REGISTERED", "GUEST"] as const).map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 md:px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${filter === f ? "bg-white/10 text-white" : "text-white/60 hover:text-white/60"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-background">
        <table className="w-full min-w-[860px] text-left border-collapse table-fixed">
          <thead className="sticky top-0 bg-[#0A0A0A] border-b border-white/10 z-20 shadow-xl">
            <tr>
              <th className="px-6 py-4 w-16 text-center">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 bg-background border-2 border-white/20 rounded cursor-pointer accent-primary"
                />
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-white/60 uppercase tracking-[0.2em]">User Identity</th>
              <th className="px-6 py-4 w-48 text-[10px] font-bold text-white/60 uppercase tracking-[0.2em]">Access Level</th>
              <th className="px-6 py-4 w-48 text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredUsers.map((u, idx) => {
              const uid = (u.sub || u.id) as string;
              const isSelected = selectedIds.has(uid);
              return (
                <motion.tr 
                  key={uid}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onMouseDown={(e) => handleRowMouseDown(e, idx, uid)}
                  onMouseEnter={() => handleRowMouseEnter(idx, uid)}
                  className={`group transition-all select-none ${isSelected ? "bg-primary/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelect(uid)}
                      className="w-4 h-4 bg-background border-2 border-white/20 rounded cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 shrink-0 rounded flex items-center justify-center text-xs font-black border transition-all ${u.isGuest ? "bg-white/5 text-white/60 border-white/10" : "bg-primary/10 text-primary border-primary/20"}`}>
                        {u.username ? u.username[0].toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-white flex items-center gap-2 truncate">
                          {u.username || "Unknown User"}
                          {u.isGuest && <span className="text-[10px] border border-primary/40 px-1 py-0.5 text-primary uppercase tracking-tighter rounded font-black bg-primary/5">GUEST</span>}
                        </div>
                        <div className="text-[10px] text-white/60 truncate font-mono tracking-tight">{u.email || "No Email Provided"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles?.map(r => (
                        <span key={r} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border ${
                          r === 'ADMIN' ? 'text-red-500 border-red-500/20 bg-red-500/10' :
                          r === 'ORGANIZER' ? 'text-amber-400 border-amber-400/20 bg-amber-400/10' :
                          'text-white/60 border-white/10 bg-white/5'
                        }`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-4">
                      {u.isGuest && (
                        <button 
                          onClick={() => onConvert(u)} 
                          className="text-[10px] font-bold text-primary/60 hover:text-primary uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        >
                          Register
                        </button>
                      )}
                      {!u.isGuest && onAward && (
                        <button
                          onClick={() => onAward(u)}
                          className="text-[10px] font-bold text-primary/60 hover:text-primary uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        >
                          Award
                        </button>
                      )}
                      <button 
                        onClick={() => onEdit(u)} 
                        className="text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (u.roles.includes('ADMIN')) {
                            alert("If you really wanna delete this account please remove admin permissions from the account");
                            return;
                          }
                          if (confirmingId === uid) { onDelete(uid); setConfirmingId(null); }
                          else setConfirmingId(uid);
                        }}
                        onBlur={() => setConfirmingId((c) => (c === uid ? null : c))}
                        className={`text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                          confirmingId === uid
                            ? "text-red-500 underline decoration-red-500/60 underline-offset-2"
                            : "text-red-500/60 hover:text-red-500"
                        }`}
                      >
                        {confirmingId === uid ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
