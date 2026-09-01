"use client";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { authenticatedFetch, API_ENDPOINTS } from "../../../utils/api";
import { isManualSeeding } from "../../../utils/formatConfig";
import { 
  ReactFlow, 
  Background, 
  Panel,
  Node as FlowNode,
  Edge,
  Handle,
  Position,
  NodeProps,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// --- Types ---
interface RawParticipant {
  id: string; userId: string; seed?: number;
  user: { id: string; username: string; isGuest?: boolean; };
}
interface SlotPlayer { userId: string; name: string; seed: number; isGuest?: boolean; }
interface PreviewMatch { id: string; matchIndex: number; player1: SlotPlayer | null; player2: SlotPlayer | null; }
interface PreviewRound { id: string; roundNumber: number; matches: PreviewMatch[]; }

interface Props {
  tournament: any; isAdmin: boolean; tournamentId: string;
  currentUserId?: string;
  onRefresh: () => void; addLog: (action: string, details?: string) => void;
  viewMode?: "CARD" | "BRACKET";
}

// --- Constants ---
const COLUMN_WIDTH = 360;
const BASE_MATCH_GAP = 150;

// --- Helper Functions ---
function sorted(ps: RawParticipant[]) {
  return [...ps].sort((a, b) => {
    if (a.seed == null && b.seed == null) return 0;
    if (a.seed == null) return 1; if (b.seed == null) return -1;
    return a.seed - b.seed;
  });
}

/** Slot order for a bracket of `size`, as 1-based seed numbers.
 *
 *  This MUST stay identical to `standardSeedOrder` in
 *  `server/src/Formats/bracket-seeding.helper.ts` — that file carries the full
 *  explanation. A preview that disagrees with the engine is worse than no
 *  preview, and this component previously used a third algorithm that agreed
 *  with neither the engine nor the server-side preview endpoint: it paired
 *  1-vs-n, put byes on the top seeds' opponents, and at 5, 6 and 9-14 players
 *  it displayed some players twice while dropping others entirely. */
function standardSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const seed of order) { next.push(seed, n + 1 - seed); }
    order = next;
  }
  return order;
}

function computeAllRounds(ps: RawParticipant[], format: string): PreviewRound[] {
  const s = sorted(ps); const n = s.length;
  const isElim = format === "SINGLE_ELIMINATION" || format === "DOUBLE_ELIMINATION";
  
  if (!isElim) {
    const matches: PreviewMatch[] = Array.from({ length: Math.ceil(n / 2) }, (_, i) => ({
      id: `preview-0-${i}`,
      matchIndex: i,
      player1: s[i * 2] ? { userId: s[i * 2].userId, name: s[i * 2].user.username, seed: s[i * 2].seed ?? i * 2 + 1, isGuest: s[i * 2].user.isGuest } : null,
      player2: s[i * 2 + 1] ? { userId: s[i * 2 + 1].userId, name: s[i * 2 + 1].user.username, seed: s[i * 2 + 1].seed ?? i * 2 + 2, isGuest: s[i * 2 + 1].user.isGuest } : null,
    }));
    return [{ id: "preview-round-1", roundNumber: 1, matches }];
  }

  const rounds: PreviewRound[] = [];
  const powerOf2 = Math.pow(2, Math.ceil(Math.log2(n || 2)));
  const totalRounds = Math.log2(powerOf2);
  
  // Seeded slot layout, matching the engine exactly. Empty slots are the
  // highest seed numbers, which is what turns them into byes for the top seeds.
  const slotSeeds = standardSeedOrder(powerOf2);
  const slot = (seedNumber: number) => {
    const p = s[seedNumber - 1];
    if (!p) return null;
    return { userId: p.userId, name: p.user.username, seed: p.seed ?? seedNumber, isGuest: p.user.isGuest };
  };

  let currentMatchCount = powerOf2 / 2;
  for (let r = 1; r <= totalRounds; r++) {
    const matches: PreviewMatch[] = [];
    for (let m = 0; m < currentMatchCount; m++) {
      let p1 = null; let p2 = null;
      if (r === 1) {
        p1 = slot(slotSeeds[m * 2]);
        p2 = slot(slotSeeds[m * 2 + 1]);
      }
      matches.push({ id: `preview-${r}-${m}`, matchIndex: m, player1: p1, player2: p2 });
    }
    rounds.push({ id: `preview-round-${r}`, roundNumber: r, matches });
    currentMatchCount /= 2;
  }
  return rounds;
}

// --- UI Components ---
function PlayerPicker({ participants, excludeId, onSelect, onClose }: {
  participants: RawParticipant[]; excludeId: string;
  onSelect: (p: RawParticipant) => void; onClose: () => void;
}) {
  const [q, setQ] = useState(""); const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const opts = participants.filter(p =>
    p.userId !== excludeId && p.user.username.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="absolute z-[1000] top-full left-0 mt-2 w-80 bg-black border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="p-3 border-b border-white/10 bg-white/5">
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search participants..."
          className="w-full bg-background border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-primary transition-all outline-none rounded-sm font-sans" />
      </div>
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {opts.length === 0
          ? <div className="py-8 text-center text-xs text-white/40 italic">No matches found</div>
          : opts.map(p => (
            <button key={p.userId} onClick={() => { onSelect(p); onClose(); }}
              className="w-full px-4 py-3 text-left flex items-center gap-4 hover:bg-white/5 text-white transition-all border-b border-white/5 last:border-0 group">
              <span className="text-[10px] font-bold text-primary w-6">#{p.seed ?? "?"}</span>
              <div className="flex-1 flex flex-col">
                <span className="text-sm font-medium transition-colors group-hover:text-primary">{p.user.username}</span>
                {p.user.isGuest && <span className="text-[10px] text-white/40 mt-0.5">Guest Unit</span>}
              </div>
            </button>
          ))
        }
      </div>
    </div>
  );
}

function PreviewParticipantRow({ player, seed, participants, isAdmin, onSwap, isRound1, onOpenChange, currentUserId }: {
  player: SlotPlayer | null; seed: number; participants: RawParticipant[];
  isAdmin: boolean; onSwap: (p: RawParticipant) => void; isRound1: boolean;
  onOpenChange?: (open: boolean) => void; currentUserId?: string;
}) {
  const [open, setOpen] = useState(false); const wrap = useRef<HTMLDivElement>(null);
  const isMe = player && currentUserId === player.userId;
  useEffect(() => {
    onOpenChange?.(open);
    if (!open) return;
    const fn = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn); return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const canEdit = isAdmin && player && isRound1;

  return (
    <div ref={wrap} className={`relative flex items-center h-12 transition-all ${open ? "z-[10000]" : "z-0"} ${!player ? "opacity-30" : ""}`}>
      <button 
        onClick={() => canEdit && setOpen(v => !v)}
        className={`flex-1 flex h-full justify-between items-center px-4 transition-all ${
          open ? "bg-primary/10" : isMe ? "bg-primary/5" : "hover:bg-white/5"
        } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
           <div className={`w-6 h-6 flex items-center justify-center border text-[10px] font-bold ${player ? "border-white/10 text-white/60 bg-white/5" : "border-white/5 text-white/10"}`}>
                {player?.name?.[0]?.toUpperCase() || "?"}
           </div>
           <span className={`text-[12px] font-bold uppercase tracking-wide truncate ${isMe ? "text-primary" : player ? "text-white/80" : "text-white/20"}`}>
              {player?.name || "TBD"}
           </span>
           {isMe && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#52b946]" />}
        </div>
        <div className={`w-8 h-8 flex items-center justify-center text-xs font-black border-l border-white/5 text-white/20`}>
           -
        </div>
      </button>

      {open && (
        <PlayerPicker 
          participants={participants} 
          excludeId={player?.userId || ""} 
          onSelect={onSwap} 
          onClose={() => setOpen(false)} 
        />
      )}
    </div>
  );
}

// --- React Flow Nodes ---
const PreviewMatchNode = ({ data }: NodeProps<FlowNode<{ 
    match: PreviewMatch;
    isRound1: boolean;
    participants: RawParticipant[];
    isAdmin: boolean;
    currentUserId?: string;
    onSwap: (a: string, b: string) => void;
}>>) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative group">
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            
            <div className={`w-80 flex flex-col border border-white/10 bg-black transition-all ${open ? "z-[10000] border-primary/50 shadow-2xl" : "z-0 shadow-xl"}`}>
                <div className="h-8 px-4 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold text-white/40 tracking-wider uppercase">PREVIEW</span>
                </div>
                <div className="flex flex-col flex-1">
                    <PreviewParticipantRow 
                        player={data.match.player1} 
                        seed={data.match.matchIndex * 2 + 1} 
                        participants={data.participants} 
                        isAdmin={data.isAdmin} 
                        onSwap={p => data.onSwap(data.match.player1!.userId, p.userId)} 
                        isRound1={data.isRound1} 
                        onOpenChange={setOpen} 
                        currentUserId={data.currentUserId} 
                    />
                    <div className="h-[1px] bg-white/5 w-full shrink-0" />
                    <PreviewParticipantRow 
                        player={data.match.player2} 
                        seed={data.match.matchIndex * 2 + 2} 
                        participants={data.participants} 
                        isAdmin={data.isAdmin} 
                        onSwap={p => data.onSwap(data.match.player2!.userId, p.userId)} 
                        isRound1={data.isRound1} 
                        onOpenChange={setOpen} 
                        currentUserId={data.currentUserId} 
                    />
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
        </div>
    );
};

const PreviewChampionNode = ({ data }: NodeProps<FlowNode<{ label: string }>>) => (
    <div className="flex flex-col items-center">
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <div className="w-72 p-12 flex flex-col items-center justify-center gap-6 bg-white/5 border border-dashed border-white/10 rounded-sm opacity-50 grayscale">
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-white/20">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z"/></svg>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">{data.label}</span>
        </div>
    </div>
);

const PreviewHeaderNode = ({ data }: NodeProps<FlowNode<{ label: string; sublabel: string }>>) => (
    <div className="w-80 flex flex-col justify-center border-b border-white/5 bg-zinc-900/30 px-4 py-2 opacity-80">
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">{data.label}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-tighter">{data.sublabel}</span>
    </div>
);

const PreviewChampionHeaderNode = ({ data }: NodeProps<FlowNode<{ label: string }>>) => (
    <div className="w-80 flex flex-col justify-center border-b border-primary/20 bg-primary/5 px-4 py-2">
        <span className="text-[11px] font-bold text-primary tracking-widest uppercase">{data.label}</span>
    </div>
);

function PreviewCardView({ rounds, participants, isAdmin, currentUserId, onSwap }: {
    rounds: PreviewRound[];
    participants: RawParticipant[];
    isAdmin: boolean;
    currentUserId?: string;
    onSwap: (fromId: string, toId: string) => void;
}) {
    const [activeRound, setActiveRound] = useState<number>(rounds[0]?.roundNumber ?? 1);
    const currentRound = rounds.find(r => r.roundNumber === activeRound);

    return (
        <div style={{ width: '100%', height: '80vh', minHeight: '800px' }} className="flex flex-col bg-neutral-950/20">
            {/* Round Tabs */}
            <div className="flex gap-px overflow-x-auto no-scrollbar bg-white/5 border-b border-white/5">
                {rounds.map((round) => (
                    <button
                        key={round.id}
                        onClick={() => setActiveRound(round.roundNumber)}
                        className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all min-w-[140px] border-r border-white/5 relative ${
                            activeRound === round.roundNumber
                            ? "bg-primary text-black"
                            : "bg-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                        }`}
                    >
                        Phase {round.roundNumber}
                        {activeRound === round.roundNumber && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/40" />
                        )}
                    </button>
                ))}
                <div className="flex-1" />
                <div className="px-6 flex items-center">
                    <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                        {isAdmin ? "Click a slot to swap participants" : "Preview"}
                    </span>
                </div>
            </div>

            {/* Match Cards */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-6">
                {currentRound ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-4">
                        {currentRound.matches.map((match, i) => (
                            <div
                                key={match.id}
                                className="flex flex-col border border-white/10 bg-black overflow-visible"
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                {/* Card Header */}
                                <div className="h-8 px-4 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center shrink-0">
                                    <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">
                                        Match {(i + 1).toString().padStart(2, '0')}
                                    </span>
                                    {!match.player2 && match.player1 && (
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">BYE</span>
                                    )}
                                </div>
                                {/* Swappable Participant Rows */}
                                <div className="flex flex-col">
                                    <PreviewParticipantRow
                                        player={match.player1}
                                        seed={match.matchIndex * 2 + 1}
                                        participants={participants}
                                        isAdmin={isAdmin}
                                        onSwap={(p) => onSwap(match.player1!.userId, p.userId)}
                                        isRound1={currentRound.roundNumber === 1}
                                        currentUserId={currentUserId}
                                    />
                                    <div className="h-px bg-white/5 w-full shrink-0" />
                                    <PreviewParticipantRow
                                        player={match.player2}
                                        seed={match.matchIndex * 2 + 2}
                                        participants={participants}
                                        isAdmin={isAdmin}
                                        onSwap={(p) => onSwap(match.player2!.userId, p.userId)}
                                        isRound1={currentRound.roundNumber === 1}
                                        currentUserId={currentUserId}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-neutral-800">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 animate-pulse">
                            No round data
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function FlowControls({ trackedUserId, nodes }: { trackedUserId: string | null; nodes: FlowNode[] }) {
    const { setCenter, fitView } = useReactFlow();

    useEffect(() => {
        if (!trackedUserId) {
            fitView({ padding: 0.1, duration: 800 });
            return;
        }
        
        const targetNode = nodes.find(n => 
            (n.data as any)?.match?.player1?.userId === trackedUserId || 
            (n.data as any)?.match?.player2?.userId === trackedUserId
        );
        
        if (targetNode) {
            setCenter(targetNode.position.x + 160, targetNode.position.y + 60, { zoom: 1, duration: 800 });
        }
    }, [trackedUserId, nodes, setCenter, fitView]);

    return (
        <Panel position="bottom-center" className="flex gap-2 p-4 z-50 mb-8">
            <div className="bg-[#0a0a0a] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-sm p-1 flex items-center">
                <button onClick={() => fitView({ duration: 800 })} className="px-6 py-3 text-white/60 text-[10px] font-bold hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">
                    Reset View
                </button>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} className="px-6 py-3 text-white/60 text-[10px] font-bold hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">
                    Scroll Page ▼
                </button>
            </div>
        </Panel>
    );
}

function FlowLegend() {
    return (
        <Panel position="top-right" className="hidden md:block p-4 pointer-events-none z-50">
            <div className="flex flex-col gap-1 text-[10px] font-bold tracking-widest text-white/40 uppercase bg-black/80 p-4 border border-white/10 backdrop-blur-sm shadow-xl rounded-sm">
                <span><strong className="text-white">SCROLL</strong>: PAN CANVAS</span>
                <span><strong className="text-white">CTRL + SCROLL</strong>: ZOOM</span>
                <span><strong className="text-white">CLICK & DRAG</strong>: PAN CANVAS</span>
            </div>
        </Panel>
    );
}

export default function BracketPreview({ tournament, isAdmin, currentUserId, tournamentId, onRefresh, addLog, viewMode = "BRACKET" }: Props) {
  const [swapping, setSwapping] = useState(false);
  const [trackedUserId, setTrackedUserId] = useState<string | null>(null);
  
  const participants: RawParticipant[] = tournament?.participants ?? [];
  const format: string = tournament?.format?.system || (typeof tournament?.format === 'string' ? tournament.format : "SINGLE_ELIMINATION");
  const isElimination = format === "SINGLE_ELIMINATION" || format === "DOUBLE_ELIMINATION";
  // With a random draw the bracket is decided at start, so a concrete seeded
  // preview would show matchups that will not actually be played. Suppress it in
  // favour of a clear note (see the early return below the hooks).
  const randomDraw = !isManualSeeding(tournament);

  const nodeTypes = useMemo(() => ({
    match: PreviewMatchNode,
    champion: PreviewChampionNode,
    header: PreviewHeaderNode,
    championHeader: PreviewChampionHeaderNode
  }), []);

  const handleSwap = useCallback(async (fromId: string, toId: string) => {
    if (!isAdmin || swapping) return;
    const fromP = participants.find(p => p.userId === fromId);
    const toP = participants.find(p => p.userId === toId);
    if (!fromP || !toP) return;
    const s = sorted(participants);
    const fromSeed = fromP.seed ?? (s.findIndex(p => p.userId === fromId) + 1);
    const toSeed = toP.seed ?? (s.findIndex(p => p.userId === toId) + 1);
    
    setSwapping(true);
    try {
      await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_SEED(tournamentId, fromId), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed: toSeed }),
      });
      await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.UPDATE_SEED(tournamentId, toId), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed: fromSeed }),
      });
      addLog("SEED SWAP", `${fromP.user.username.toUpperCase()} ↔ ${toP.user.username.toUpperCase()}`);
      onRefresh();
    } catch { addLog("ERROR", "SEED SWAP FAILED"); }
    finally { setSwapping(false); }
  }, [isAdmin, swapping, participants, tournamentId, addLog, onRefresh]);

  const getMatchY = useCallback((roundIdx: number, matchIdx: number): number => {
      if (roundIdx === 0) return (matchIdx + 1) * BASE_MATCH_GAP;
      const p1Y = getMatchY(roundIdx - 1, matchIdx * 2);
      const p2Y = getMatchY(roundIdx - 1, matchIdx * 2 + 1);
      return (p1Y + p2Y) / 2;
  }, []);

  const { nodes, edges, rounds } = useMemo(() => {
      const nodes: FlowNode[] = [];
      const edges: Edge[] = [];
      const computedRounds = computeAllRounds(participants, format);

      if (!isElimination) return { nodes: [], edges: [], rounds: computedRounds };

      computedRounds.forEach((round, rIdx) => {
          nodes.push({
              id: `header-round-${round.roundNumber}`,
              type: 'header',
              position: { x: rIdx * COLUMN_WIDTH, y: 50 },
              data: { label: `ROUND ${round.roundNumber}`, sublabel: 'PREVIEW' },
              draggable: false,
              selectable: false
          });

          round.matches.forEach((match) => {
              const y = getMatchY(rIdx, match.matchIndex);
              
              nodes.push({
                  id: match.id,
                  type: 'match',
                  position: { x: rIdx * COLUMN_WIDTH, y: y },
                  data: {
                      match,
                      isRound1: round.roundNumber === 1,
                      participants,
                      isAdmin,
                      currentUserId: trackedUserId || currentUserId,
                      onSwap: handleSwap
                  },
                  draggable: false
              });

              const nextMatchIndex = Math.floor(match.matchIndex / 2);
              const nextMatchId = round.roundNumber < computedRounds.length 
                  ? `preview-${round.roundNumber + 1}-${nextMatchIndex}` 
                  : null;

              if (nextMatchId) {
                  edges.push({
                      id: `edge-${match.id}-${nextMatchId}`,
                      source: match.id,
                      target: nextMatchId,
                      type: 'step',
                      style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 }
                  });
              }
          });
      });

      if (computedRounds.length > 0) {
          const finalRound = computedRounds[computedRounds.length - 1];
          const finalMatch = finalRound.matches[0];
          if (finalMatch) {
              const championX = computedRounds.length * COLUMN_WIDTH;
              const championY = getMatchY(computedRounds.length - 1, 0) - 40;

              nodes.push({
                  id: 'preview-champion-header',
                  type: 'championHeader',
                  position: { x: championX, y: 50 },
                  data: { label: 'CHAMPION' },
                  draggable: false,
                  selectable: false
              });

              nodes.push({
                  id: 'preview-champion',
                  type: 'champion',
                  position: { x: championX, y: championY },
                  data: { label: 'The Ultimate Winner' },
                  draggable: false
              });

              edges.push({
                  id: `edge-final-champion`,
                  source: finalMatch.id,
                  target: 'preview-champion',
                  type: 'step',
                  style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2, strokeDasharray: '4 4' }
              });
          }
      }

      return { nodes, edges, rounds: computedRounds };
  }, [participants, format, isElimination, isAdmin, currentUserId, trackedUserId, handleSwap, getMatchY]);

  // Random draw: no meaningful preview exists until the tournament starts, so
  // show the reason rather than a misleading fixed bracket. Placed after every
  // hook above so the hook order stays stable.
  if (randomDraw) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] p-10">
        <div className="max-w-md w-full text-center border border-white/10 bg-black/40 rounded-2xl px-8 py-12 space-y-4">
          <div className="mx-auto w-10 h-10 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center text-primary text-lg">
            ⚄
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
            Random Draw
          </h3>
          <p className="text-[11px] text-white/45 leading-relaxed">
            This tournament&apos;s matchups are drawn at random when it starts, so there is no
            bracket to preview yet. The {format?.replace(/_/g, " ").toLowerCase()} bracket for{" "}
            {participants.length} participant{participants.length === 1 ? "" : "s"} will appear here
            once the tournament begins.
          </p>
          {isAdmin && (
            <p className="text-[10px] text-white/30 leading-relaxed">
              Want a fixed, previewable bracket? Switch seeding to manual in the tournament rules.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-6 py-4 bg-black border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">
              {format?.replace(/_/g, " ") || "UNKNOWN"} Configuration
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-tight mt-0.5">
              Reviewing Seeding for {participants.length} Participants (React Flow Engine)
            </span>
          </div>
        </div>
        
        <div className="relative">
            <select 
                value={trackedUserId || ""} 
                onChange={(e) => setTrackedUserId(e.target.value || null)} 
                className={`bg-white/5 border border-white/10 px-4 py-2 pr-8 text-[10px] font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer transition-all rounded-sm ${trackedUserId ? 'text-primary' : 'text-white/60 hover:border-primary hover:text-white'}`}
            >
                <option value="">{trackedUserId ? "Back to Neutral" : "Track Participant"}</option>
                {sorted(participants).map(p => (
                    <option key={p.userId} value={p.userId}>{p.user.username}</option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">▼</div>
        </div>
      </div>
      
      {viewMode === "CARD" ? (
         <PreviewCardView
             rounds={rounds}
             participants={participants}
             isAdmin={isAdmin}
             currentUserId={trackedUserId || currentUserId}
             onSwap={handleSwap}
         />
      ) : (
          <div style={{ width: '100%', height: '80vh', minHeight: '800px' }}>
            {isElimination && nodes.length > 0 && (
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        fitView
                        minZoom={0.2}
                        maxZoom={1.5}
                        colorMode="dark"
                        proOptions={{ hideAttribution: true }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        nodesFocusable={false}
                        elementsSelectable={false}
                        zoomOnDoubleClick={false}
                        panOnScroll={true}
                    >
                        <Background color="#111" gap={20} />
                        <FlowControls trackedUserId={trackedUserId} nodes={nodes} />
                        <FlowLegend />
                    </ReactFlow>
                </ReactFlowProvider>
            )}
          </div>
      )}
    </div>
  );
}
