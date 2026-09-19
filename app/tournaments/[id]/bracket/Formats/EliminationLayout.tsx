"use client";
import { isWinnersRound, isLosersRound, losersRoundIndex } from "../roundNumbers";
import { useRouter } from "next/navigation";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Match, Round, LeaderboardEntry } from "../types";
import MatchCard from "../../../../components/tournaments/bracket/MatchCard";
import { displayNameOf } from "../../../../utils/api";
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
  useReactFlow,
  PanOnScrollMode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Layout Constants
/** Card 212 + 68 for the connector to turn in (agreed 2026-09-17, option 2A).
 *  It was 360 against a 288px card, which made a bracket-reset tree 2,460px
 *  wide — too wide for the canvas at a legible zoom. */
const COLUMN_WIDTH = 280;
const CARD_WIDTH = 212;
/** A two-row card with no status header. Used to place the halves apart
 *  instead of the magic gap the losers bracket used to sit behind. */
const CARD_HEIGHT = 74;
const BASE_MATCH_GAP = 150;
/** Pure knockout trees use five mirrored columns for an eight-player cut.
 *  These tighter dimensions keep that complete championship shape in view;
 *  the roomier constants above remain in force for double elimination. */
const MIRRORED_COLUMN_WIDTH = 252;
const MIRRORED_MATCH_GAP = 118;
/** Air between the bottom of the winners bracket and the losers captions,
 *  with the divider set into the middle of it (option 1B). */
const HALF_GAP = 190;

/** How far a connector runs out of a node before it turns, and how tightly it
 *  turns. The defaults (20 / 5) give near-square corners, which read as sharp
 *  kinks on the long spans a double-elimination bracket needs. */
const EDGE_PATH = { borderRadius: 18, offset: 28 } as const;

/** The floor `fitView` may zoom to. The cards carry 12px text, so a free fit
 *  (which will happily go to 0.2 on a large bracket) renders them unreadable;
 *  below this the canvas pans instead of shrinking further. */
const MIN_FIT_ZOOM = 0.55;

/** `pathOptions` lives on the `SmoothStepEdge` member of the `Edge` union, not
 *  on `Edge` itself, so an array typed `Edge[]` cannot carry it — even though
 *  React Flow reads it off the edge object at render time. */
type BracketEdge = Edge & { pathOptions?: { borderRadius?: number; offset?: number } };

// Custom Match Node Component
const MatchNode = ({ data }: NodeProps<FlowNode<{ 
    match: Match; 
    isAdmin: boolean; 
    updating: string | null; 
    leaderboard: LeaderboardEntry[]; 
    trackedUserId: string | null;
    currentUserId?: string | null;
    focusedMatchId: string | null;
    seeds?: Record<string, number>;
    isChampion?: boolean;
    onOpenScoring: (match: Match, pos?: {x: number, y: number}) => void;
}>>) => {
    const router = useRouter();
    const lastTap = useRef<number>(0);

    const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now();
        if (now - lastTap.current < 350) {
            // It's a double tap!
            e.stopPropagation();
            const currentPath = window.location.pathname;
            router.push(`${currentPath}?tab=pairings&matchId=${data.match.id}`);
        }
        lastTap.current = now;
    };

    return (
        // pointer-events-auto: React Flow v12 gives a node that is not
        // selectable, draggable or click-handled `pointer-events: none` (all
        // three are off on this canvas), and the property is inherited, so the
        // card's hover states and click handler never received the pointer.
        // Scoring from this view stays off by design (DesktopView passes
        // isAdmin={false}); the same trap disabled the seed-swap picker in
        // BracketPreview, where it did matter.
        <div className="relative group pointer-events-auto">
            {/* Input handles (incoming from the previous round, either side) */}
            <Handle id="tl" type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            <Handle id="tr" type="target" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
            <div onClick={handleTap}>
                <MatchCard 
                    match={data.match} 
                    onOpenScoring={() => {}}
                    isAdmin={data.isAdmin}
                    isUpdating={data.updating === data.match.id}
                    leaderboard={data.leaderboard}
                    trackedUserId={data.trackedUserId}
                    currentUserId={data.currentUserId}
                    isFocused={data.focusedMatchId === data.match.id}
                    seeds={data.seeds}
                    isChampion={data.isChampion}
                />
            </div>

            {/* Output handles (outgoing to the next round or the champion pedestal) */}
            <Handle id="sr" type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
            <Handle id="sl" type="source" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            <Handle id="sb" type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
        </div>
    );
};

/** The rule between the two halves, with the name of the half below it set
 *  into the line (option 1B). A node rather than a Background variant because
 *  it has to span the bracket's own width, which only the layout knows. */
const DividerNode = ({ data }: NodeProps<FlowNode<{ label: string; width: number }>>) => (
    <div className="relative pointer-events-none select-none" style={{ width: data.width }}>
        <div className="border-t border-dashed border-white/12" />
        <span className="absolute left-0 -top-[9px] bg-[#0a0a0a] pr-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#FF8A8A]">
            {data.label}
        </span>
    </div>
);

/** A round caption. The sublabel names which half of the bracket the column
 *  belongs to — "WINNERS BRACKET", "LOSERS", "CHAMPIONSHIP" — and at 9px on
 *  30% white it was the first thing to disappear when the viewport zoomed out,
 *  which is why the losers half looked unlabelled. It is now the same weight as
 *  the round name and tinted by half, so the two are distinguishable at a
 *  glance rather than by reading. */
const HeaderNode = ({ data }: NodeProps<FlowNode<{ label: string; sublabel: string }>>) => {
    const half = (data.sublabel || "").toUpperCase();
    const tone = half.includes("LOSER")
        ? "text-[#FF8A8A] border-[#FF4D4D]/25 bg-[#FF4D4D]/[0.06]"
        : half.includes("CHAMPION")
          ? "text-[#e8c53d] border-[#e8c53d]/25 bg-[#e8c53d]/[0.06]"
          : "text-primary border-primary/25 bg-primary/[0.06]";
    return (
        <div className={`w-[248px] flex flex-col gap-0.5 border-b px-3.5 py-2 ${tone}`}>
            <span className="text-[12px] font-black text-white tracking-wider uppercase">{data.label}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">{data.sublabel}</span>
        </div>
    );
};



interface EliminationLayoutProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match, pos?: {x: number, y: number}) => void;
    addLog: (action: string, details?: string) => void;
    currentUserId?: string | null;
}

 
/** Viewport behaviour only — it renders nothing. The controls it used to carry
 *  moved into `CanvasBar`. */
function ViewportFit({ focusedMatchId, nodes }: { focusedMatchId: string | null; nodes: FlowNode[] }) {
    const { setCenter, fitView, getViewport, setViewport } = useReactFlow();

    useEffect(() => {
        // Delay viewport manipulation slightly to allow React Flow to measure DOM nodes.
        // Without this, completed tournaments (which don't poll/re-render) will fitView on 0x0 nodes and turn blank.
        let anchor: ReturnType<typeof setTimeout> | undefined;
        const timer = setTimeout(() => {
            if (!focusedMatchId) {
                fitView({ padding: 0.15, duration: 800, minZoom: MIN_FIT_ZOOM });
                // A double-elimination bracket is wider than the canvas once the
                // zoom floor stops `fitView` shrinking it any further, and a
                // centred fit then clips BOTH ends — hiding round 1, which is
                // where the eye starts. Anchor it to the left instead.
                anchor = setTimeout(() => {
                    const vp = getViewport();
                    if (vp.x < -8) setViewport({ ...vp, x: 24 }, { duration: 300 });
                }, 850);
                return;
            }
            
            const targetNode = nodes.find(n => n.id === focusedMatchId);
            
            if (targetNode) {
                // Offset to roughly center the match card
                setCenter(targetNode.position.x + 160, targetNode.position.y + 60, { zoom: 1, duration: 800 });
            }
        }, 50);

        return () => {
            clearTimeout(timer);
            if (anchor) clearTimeout(anchor);
        };
    }, [focusedMatchId, nodes, fitView, setCenter, getViewport, setViewport]);

    return null;
}

/** The one control surface on the canvas (agreed 2026-09-17, option 3A).
 *
 * It replaces three things that each did part of the job: a header strip that
 * restated the tab's own name, a floating Reset View / Scroll Page bar, and a
 * hover-only legend that was also `hidden md:block` — so the key explaining
 * green, red and amber was unreachable on a touch screen entirely.
 *
 * The colour key doubles as navigation: a half's swatch flies the viewport to
 * that half, which is the only practical way to reach the losers bracket on a
 * phone (option 4B).
 */
function CanvasBar({
    halves,
    trackedUserId,
    setTrackedUserId,
    leaderboard,
}: {
    halves: { key: string; label: string; short: string; colour: string; nodeIds: string[] }[];
    trackedUserId: string | null;
    setTrackedUserId: (id: string | null) => void;
    leaderboard: LeaderboardEntry[];
}) {
    const { zoomIn, zoomOut, fitView } = useReactFlow();

    const flyTo = (nodeIds: string[]) =>
        fitView({ nodes: nodeIds.map((id) => ({ id })), padding: 0.2, duration: 600, minZoom: MIN_FIT_ZOOM, maxZoom: 1 });

    // Compact enough to stay on one row at 390px, where it sits over the
    // bracket rather than beside it.
    const btn = "px-2 sm:px-3 py-1.5 sm:py-2 text-white/60 text-[10px] font-black hover:text-white hover:bg-white/5 transition-colors uppercase tracking-widest disabled:opacity-30";

    return (
        <div className="bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center">
            <button type="button" onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out" className={btn}>−</button>
            <button type="button" onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in" className={btn}>+</button>
            <button type="button" onClick={() => fitView({ duration: 600, padding: 0.15, minZoom: MIN_FIT_ZOOM })} className={btn}>Fit</button>

            {halves.length > 1 && <span className="w-px self-stretch bg-white/10" />}
            {halves.length > 1 && halves.map((h) => (
                <button
                    key={h.key}
                    type="button"
                    onClick={() => flyTo(h.nodeIds)}
                    title={`Go to ${h.label.toLowerCase()}`}
                    aria-label={`Go to ${h.label.toLowerCase()}`}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/5 transition-colors group/key"
                >
                    <span aria-hidden className="w-2.5 sm:w-3.5 h-[2px]" style={{ background: h.colour }} />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45 group-hover/key:text-white transition-colors">
                        <span className="sm:hidden">{h.short}</span>
                        <span className="hidden sm:inline">{h.label}</span>
                    </span>
                </button>
            ))}

            {leaderboard.length > 0 && <span className="w-px self-stretch bg-white/10" />}
            {leaderboard.length > 0 && (
                <div className="relative">
                    <select
                        value={trackedUserId || ""}
                        onChange={(e) => setTrackedUserId(e.target.value || null)}
                        aria-label="Follow a player through the bracket"
                        className={`bg-transparent border-0 pl-2 sm:pl-3 pr-6 sm:pr-7 py-1.5 sm:py-2 max-w-[104px] sm:max-w-none text-[9px] font-black uppercase tracking-[0.16em] outline-none appearance-none cursor-pointer transition-colors ${trackedUserId ? 'text-primary' : 'text-white/45 hover:text-white'}`}
                    >
                        <option value="">{trackedUserId ? "Stop following" : "Follow"}</option>
                        {leaderboard.map((u) => (
                            <option key={u.userId} value={u.userId}>{displayNameOf(u, u.username)}</option>
                        ))}
                    </select>
                    <span aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/35 text-[8px]">▼</span>
                </div>
            )}
        </div>
    );
}

export default function EliminationLayout({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog,
    currentUserId
}: EliminationLayoutProps) {
    const router = useRouter();
    const [trackedUserId, setTrackedUserId] = useState<string | null>(null);
    const [trackedMatchIndex, setTrackedMatchIndex] = useState<number>(0);

    // Track active key presses to dynamically adjust React Flow mouse wheel behavior
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") setIsShiftPressed(true);
            if (e.key === "Control") setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") setIsShiftPressed(false);
            if (e.key === "Control") setIsCtrlPressed(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        
        const handleBlur = () => {
            setIsShiftPressed(false);
            setIsCtrlPressed(false);
        };
        window.addEventListener("blur", handleBlur);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    const panOnScroll = isShiftPressed || isCtrlPressed;
    const zoomOnScroll = !panOnScroll;
    const zoomOnPinch = !panOnScroll;
    const panOnScrollMode = (isShiftPressed ? "horizontal" : "vertical") as PanOnScrollMode;

    const system = tournament?.system ?? (typeof tournament?.format === 'object' ? tournament.format?.system : null);
    const eliminationRounds = useMemo(() => {
        const rounds: Round[] = tournament?.rounds ?? [];
        if (system !== 'HYBRID') return rounds;

        // Swiss results seed the cut, but they are not feeders in its knockout
        // tree. Keeping them out here prevents their round numbers and match
        // counts from creating blank columns and recursive Y-spacing jumps.
        return rounds
            .map((round: Round) => ({
                ...round,
                matches: round.matches.filter((match: Match) => match.phase === 2),
            }))
            .filter((round: Round) => round.matches.length > 0);
    }, [system, tournament?.rounds]);

    const winnersRounds = useMemo(() => eliminationRounds.filter((r: Round) => isWinnersRound(r.roundNumber)).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber), [eliminationRounds]);
    const losersRounds = useMemo(() => eliminationRounds.filter((r: Round) => isLosersRound(r.roundNumber)).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber), [eliminationRounds]);
    const grandFinals = useMemo(() => eliminationRounds.filter((r: Round) => r.roundNumber >= 200).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber), [eliminationRounds]);

    // Helper to find the round number of a match
    const getMatchRoundInfo = useCallback((matchId: string): number => {
        const allRoundsList = [...winnersRounds, ...losersRounds, ...grandFinals];
        for (const round of allRoundsList) {
            if (round.matches.some((m: Match) => m.id === matchId)) {
                return round.roundNumber;
            }
        }
        return 1;
    }, [winnersRounds, losersRounds, grandFinals]);

    // Find and sort all matches for the tracked player
    const sortedPlayerMatches = useMemo(() => {
        if (!trackedUserId) return [];
        const matchesList: Match[] = [];
        const allRoundsList = [...winnersRounds, ...losersRounds, ...grandFinals];
        allRoundsList.forEach((round: Round) => {
            round.matches.forEach((m: Match) => {
                if (m.player1?.id === trackedUserId || m.player2?.id === trackedUserId) {
                    if (!matchesList.some(item => item.id === m.id)) {
                        matchesList.push(m);
                    }
                }
            });
        });
        return matchesList.sort((a, b) => {
            const roundA = getMatchRoundInfo(a.id);
            const roundB = getMatchRoundInfo(b.id);
            return roundA - roundB;
        });
    }, [trackedUserId, winnersRounds, losersRounds, grandFinals, getMatchRoundInfo]);

    // Reset match index when tracked user changes
    useEffect(() => {
        setTrackedMatchIndex(0);
    }, [trackedUserId]);

    // The currently focused match ID for FlowControls targeting
    const focusedMatchId = useMemo(() => {
        if (!trackedUserId || sortedPlayerMatches.length === 0) return null;
        return sortedPlayerMatches[trackedMatchIndex]?.id || null;
    }, [trackedUserId, sortedPlayerMatches, trackedMatchIndex]);

    const nodeTypes = useMemo(() => ({
        match: MatchNode,
        header: HeaderNode,
        divider: DividerNode
    }), []);


    // Recursive Y positioning logic (shared with React Flow)
    const getMatchY = useCallback((roundIdx: number, matchIdx: number, offset: number = 0): number => {
        if (roundIdx === 0) return (matchIdx + 1) * BASE_MATCH_GAP + offset;
        const p1Y = getMatchY(roundIdx - 1, matchIdx * 2, offset);
        const p2Y = getMatchY(roundIdx - 1, matchIdx * 2 + 1, offset);
        return (p1Y + p2Y) / 2;
    }, []);

    const getLosersMatchY = useCallback((rIdx: number, matchIdx: number): number => {
        if (rIdx === 0) return matchIdx * BASE_MATCH_GAP;
        const currentRound = losersRounds[rIdx];
        const prevRound = losersRounds[rIdx - 1];
        if (!currentRound || !prevRound) return matchIdx * BASE_MATCH_GAP;

        if (currentRound.matches.length === prevRound.matches.length) {
            // 1-to-1 linkage: Y is identical to the previous round's corresponding match
            return getLosersMatchY(rIdx - 1, matchIdx);
        } else {
            // 2-to-1 linkage: Y is the average of the two incoming matches
            const p1Y = getLosersMatchY(rIdx - 1, matchIdx * 2);
            const p2Y = getLosersMatchY(rIdx - 1, matchIdx * 2 + 1);
            return (p1Y + p2Y) / 2;
        }
    }, [losersRounds]);

    /** Entrant seeds by user id. Random seeding is the default, so this is
     *  usually empty and the card renders no seed slot at all rather than a
     *  column of blanks. */
    const seeds = useMemo(() => {
        const map: Record<string, number> = {};
        for (const p of tournament?.participants ?? []) {
            if (typeof p?.seed === 'number' && p?.userId) map[p.userId] = p.seed;
        }
        return map;
    }, [tournament?.participants]);

    const { nodes, edges } = useMemo(() => {
        const nodes: FlowNode[] = [];
        const edges: BracketEdge[] = [];

        // Build a map of all matches by ID for path lookup
        const matchMap = new Map<string, Match>();
        const allRoundsList = [...winnersRounds, ...losersRounds, ...grandFinals];
        allRoundsList.forEach((round: Round) => {
            round.matches.forEach((m: Match) => {
                matchMap.set(m.id, m);
            });
        });

        // The match that decided the tournament: the last one played, and only
        // once there is a champion to name. It wears the crown in place of the
        // pedestal node that used to occupy a column of its own.
        const decidingRound = [...winnersRounds, ...grandFinals].pop();
        const decidingMatchId = tournament?.winner ? decidingRound?.matches?.[0]?.id : undefined;
        const isDecider = (match: Match) => !!decidingMatchId && match.id === decidingMatchId;

        const isEdgeTracked = (match: Match, targetMatch: Match | undefined): boolean =>
            !!(trackedUserId &&
                (match.player1?.id === trackedUserId || match.player2?.id === trackedUserId) &&
                targetMatch && (targetMatch.player1?.id === trackedUserId || targetMatch.player2?.id === trackedUserId));

        // A bracket qualifies for the symmetric two-sided layout when it is a pure
        // knockout tree: no losers bracket, no grand finals, exactly one final match,
        // and every earlier match linked to a known next match.
        const finalRound = winnersRounds[winnersRounds.length - 1];
        const isMirrored =
            losersRounds.length === 0 &&
            grandFinals.length === 0 &&
            winnersRounds.length > 0 &&
            finalRound?.matches?.length === 1 &&
            winnersRounds
                .slice(0, -1)
                .every((r: Round) => r.matches.every((m: Match) => m.nextMatchId && matchMap.has(m.nextMatchId)));

        if (isMirrored) {
            // ── Symmetric knockout layout: both halves converge on a central final ──
            const totalRounds = winnersRounds.length;
            const lastColumn = 2 * (totalRounds - 1);
            const centerX = (totalRounds - 1) * MIRRORED_COLUMN_WIDTH;
            const finalMatch: Match = finalRound.matches[0];

            // Matches feeding into each match, ordered by matchIndex
            const feederMap = new Map<string, Match[]>();
            winnersRounds.forEach((round: Round) => {
                round.matches.forEach((m: Match) => {
                    if (m.nextMatchId && m.id !== finalMatch.id) {
                        const list = feederMap.get(m.nextMatchId) || [];
                        list.push(m);
                        feederMap.set(m.nextMatchId, list);
                    }
                });
            });
            feederMap.forEach((list) => list.sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0)));

            // Assign each match to the left or right half by walking back from the final
            type BracketSide = 'L' | 'R' | 'C';
            const sideMap = new Map<string, BracketSide>();
            sideMap.set(finalMatch.id, 'C');
            const assignSide = (m: Match, s: 'L' | 'R') => {
                sideMap.set(m.id, s);
                (feederMap.get(m.id) || []).forEach((f) => assignSide(f, s));
            };
            const finalFeeders = feederMap.get(finalMatch.id) || [];
            if (finalFeeders[0]) assignSide(finalFeeders[0], 'L');
            if (finalFeeders[1]) assignSide(finalFeeders[1], 'R');

            const columnX = (rIdx: number, s: BracketSide) =>
                s === 'C' ? centerX : s === 'R' ? (lastColumn - rIdx) * MIRRORED_COLUMN_WIDTH : rIdx * MIRRORED_COLUMN_WIDTH;

            // Vertical positions: opening matches stack downward within their half,
            // later matches sit at the midpoint of the matches feeding them.
            const matchYMap = new Map<string, number>();
            const leafSlots: Record<BracketSide, number> = { L: 0, R: 0, C: 0 };
            winnersRounds.forEach((round: Round) => {
                const sortedMatches = [...round.matches].sort((a: Match, b: Match) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
                sortedMatches.forEach((m: Match) => {
                    const feederYs = (feederMap.get(m.id) || [])
                        .filter((f) => matchYMap.has(f.id))
                        .map((f) => matchYMap.get(f.id) as number);
                    if (feederYs.length > 0) {
                        matchYMap.set(m.id, feederYs.reduce((sum, y) => sum + y, 0) / feederYs.length);
                    } else {
                        const s = sideMap.get(m.id) || 'L';
                        leafSlots[s] += 1;
                        matchYMap.set(m.id, leafSlots[s] * MIRRORED_MATCH_GAP);
                    }
                });
            });

            // Stage name per column (shown mirrored on both sides)
            const stageLabel = (rIdx: number, round: Round): string => {
                const fromEnd = totalRounds - 1 - rIdx;
                if (fromEnd === 0) return 'CHAMPIONSHIP FINAL';
                if (fromEnd === 1) return 'SEMI-FINALS';
                if (fromEnd === 2) return 'QUARTER-FINALS';
                if (fromEnd === 3) return 'ROUND OF 16';
                return `ROUND ${round.roundNumber}`;
            };

            winnersRounds.forEach((round: Round, rIdx: number) => {
                const isFinalRound = rIdx === totalRounds - 1;
                const sortedMatches = [...round.matches].sort((a: Match, b: Match) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));

                if (isFinalRound) {
                    nodes.push({
                        id: `header-round-${round.roundNumber}`,
                        type: 'header',
                        position: { x: centerX, y: 24 },
                        data: { label: stageLabel(rIdx, round), sublabel: 'GRAND FINAL' },
                        draggable: false, selectable: false
                    });
                } else {
                    const sidesInRound = new Set(sortedMatches.map((m) => sideMap.get(m.id) || 'L'));
                    (['L', 'R'] as const).forEach((s) => {
                        if (!sidesInRound.has(s)) return;
                        nodes.push({
                            id: `header-round-${round.roundNumber}-${s}`,
                            type: 'header',
                            position: { x: columnX(rIdx, s), y: 24 },
                            data: { label: stageLabel(rIdx, round), sublabel: `ROUND ${round.roundNumber}` },
                            draggable: false, selectable: false
                        });
                    });
                }

                sortedMatches.forEach((match: Match) => {
                    const s = sideMap.get(match.id) || 'L';
                    nodes.push({
                        id: match.id,
                        type: 'match',
                        position: { x: columnX(rIdx, s), y: matchYMap.get(match.id) ?? MIRRORED_MATCH_GAP },
                        data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, seeds, isChampion: isDecider(match), onOpenScoring },
                        draggable: false
                    });

                    if (match.nextMatchId) {
                        const tracked = isEdgeTracked(match, matchMap.get(match.nextMatchId));
                        edges.push({
                            id: `edge-${match.id}-${match.nextMatchId}`,
                            source: match.id,
                            target: match.nextMatchId,
                            sourceHandle: s === 'R' ? 'sl' : 'sr',
                            targetHandle: s === 'R' ? 'tr' : 'tl',
                            // smoothstep, not step: hard 90-degree corners on the long
                        // cross-bracket runs were most of why this looked scrappy.
                        type: 'smoothstep',
                        pathOptions: EDGE_PATH,
                            style: tracked
                                ? { stroke: '#52B946', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(82, 185, 70, 0.6))', zIndex: 10 }
                                : { stroke: 'rgba(82, 185, 70, 0.55)', strokeWidth: 1.75 }
                        });
                    }
                });
            });

            // No pedestal: the deciding match wears the win instead (option 5B),
            // which is one fewer column and cannot scroll out of view.

            const sortedEdges = [...edges].sort((a, b) => {
                const aIsTracked = a.style?.filter ? 1 : 0;
                const bIsTracked = b.style?.filter ? 1 : 0;
                return aIsTracked - bIsTracked;
            });

            return { nodes, edges: sortedEdges };
        }

        // 1. Winners Bracket
        winnersRounds.forEach((round: Round, rIdx: number) => {
            nodes.push({
                id: `header-round-${round.roundNumber}`,
                type: 'header',
                position: { x: rIdx * COLUMN_WIDTH, y: 50 },
                data: { label: `WINNERS ROUND ${round.roundNumber}`, sublabel: 'WINNERS BRACKET' },
                draggable: false, selectable: false
            });

            // Sort by matchIndex for stable, correct vertical positions
            const sortedMatches = [...round.matches].sort((a: Match, b: Match) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
            sortedMatches.forEach((match: Match, mIdx: number) => {
                const y = getMatchY(rIdx, mIdx);
                nodes.push({
                    id: match.id,
                    type: 'match',
                    position: { x: rIdx * COLUMN_WIDTH, y: y },
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, seeds, isChampion: isDecider(match), onOpenScoring },
                    draggable: false
                });

                if (match.nextMatchId) {
                    const tracked = isEdgeTracked(match, matchMap.get(match.nextMatchId));

                    edges.push({
                        id: `edge-${match.id}-${match.nextMatchId}`,
                        source: match.id,
                        target: match.nextMatchId,
                        sourceHandle: 'sr',
                        targetHandle: 'tl',
                        type: 'smoothstep',
                        pathOptions: EDGE_PATH,
                        style: tracked
                            ? { stroke: '#52B946', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(82, 185, 70, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(82, 185, 70, 0.55)', strokeWidth: 1.75 }
                    });
                }
            });
        });

        // 2. Losers Bracket (Rendered below Winners)
        // Derived from where the winners bracket actually ends rather than a
        // magic 400, so the halves sit the same distance apart at every field
        // size and the divider has a known place to go (option 1B).
        const winnersBottom = (winnersRounds[0]?.matches?.length || 4) * BASE_MATCH_GAP + CARD_HEIGHT;
        const losersVerticalOffset = winnersBottom + HALF_GAP;
        losersRounds.forEach((round: Round, rIdx: number) => {
            const losersRoundNum = isLosersRound(round.roundNumber) ? losersRoundIndex(round.roundNumber) : rIdx + 1;
            const losersRoundLabel = `ROUND ${losersRoundNum}`;
            nodes.push({
                id: `header-round-${round.roundNumber}`,
                type: 'header',
                position: { x: rIdx * COLUMN_WIDTH, y: losersVerticalOffset - 100 },
                data: { label: losersRoundLabel, sublabel: 'LOSERS' },
                draggable: false, selectable: false
            });

            // Sort by matchIndex for stable, correct vertical positions
            const sortedLosersMatches = [...round.matches].sort((a: Match, b: Match) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));
            sortedLosersMatches.forEach((match: Match, mIdx: number) => {
                const y = losersVerticalOffset + getLosersMatchY(rIdx, mIdx);
                nodes.push({
                    id: match.id,
                    type: 'match',
                    position: { x: rIdx * COLUMN_WIDTH, y: y },
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, seeds, isChampion: isDecider(match), onOpenScoring },
                    draggable: false
                });

                if (match.nextMatchId) {
                    const tracked = isEdgeTracked(match, matchMap.get(match.nextMatchId));

                    edges.push({
                        id: `edge-${match.id}-${match.nextMatchId}`,
                        source: match.id,
                        target: match.nextMatchId,
                        sourceHandle: 'sr',
                        targetHandle: 'tl',
                        type: 'smoothstep',
                        pathOptions: EDGE_PATH,
                        style: tracked
                            ? { stroke: '#FF4D4D', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(255, 77, 77, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(255, 77, 77, 0.45)', strokeWidth: 1.75 }
                    });
                }
            });
        });

        // 2b. The rule between the halves. Spans the whole bracket, so its width
        // is computed from the last column rather than guessed.
        if (losersRounds.length > 0) {
            const columns = Math.max(winnersRounds.length, losersRounds.length) + grandFinals.length;
            nodes.push({
                id: 'half-divider',
                type: 'divider',
                position: { x: -24, y: winnersBottom + HALF_GAP / 2 - 40 },
                data: { label: 'LOSERS BRACKET', width: (columns - 1) * COLUMN_WIDTH + CARD_WIDTH + 48 },
                draggable: false, selectable: false,
                zIndex: 0
            });
        }

        // 3. Grand Finals
        // The championship columns start after BOTH halves, not after the
        // winners bracket: the losers bracket runs one round longer, so
        // `winnersRounds.length` put the grand final in the same column as the
        // losers final and its connector had to double back on itself.
        const bracketColumns = Math.max(winnersRounds.length, losersRounds.length);
        grandFinals.forEach((round: Round, rIdx: number) => {
            const gfX = (bracketColumns + rIdx) * COLUMN_WIDTH;
            const gfY = getMatchY(winnersRounds.length - 1, 0);
            const isReset = round.roundNumber >= 201;

            nodes.push({
                id: `header-round-${round.roundNumber}`,
                type: 'header',
                position: { x: gfX, y: 50 },
                data: {
                    label: isReset ? 'BRACKET RESET' : 'GRAND FINAL',
                    sublabel: isReset ? 'DECIDING MATCH' : 'CHAMPIONSHIP',
                },
                draggable: false, selectable: false
            });

            round.matches.forEach((match: Match, mIdx: number) => {
                nodes.push({
                    id: match.id,
                    type: 'match',
                    position: { x: gfX, y: gfY + (mIdx * 200) },
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, seeds, isChampion: isDecider(match), onOpenScoring },
                    draggable: false
                });

                if (match.nextMatchId) {
                    const tracked = isEdgeTracked(match, matchMap.get(match.nextMatchId));

                    edges.push({
                        id: `edge-${match.id}-${match.nextMatchId}`,
                        source: match.id,
                        target: match.nextMatchId,
                        sourceHandle: 'sr',
                        targetHandle: 'tl',
                        type: 'smoothstep',
                        pathOptions: EDGE_PATH,
                        style: tracked
                            ? { stroke: '#e8c53d', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(232, 197, 61, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(232, 197, 61, 0.5)', strokeWidth: 1.75 }
                    });
                }
            });

            // Grand final -> bracket reset. The server spawns the reset round
            // only once the losers-bracket finalist has won, and never sets
            // `nextMatchId` on the grand final (advancement into a reset is not
            // a winner feed — both players carry over), so without this the
            // bracket visibly broke between its two most important matches.
            const next = grandFinals[rIdx + 1];
            const resetMatch = next?.matches?.[0];
            if (resetMatch && !round.matches.some((m: Match) => m.nextMatchId === resetMatch.id)) {
                round.matches.forEach((match: Match) => {
                    if (match.nextMatchId) return;
                    edges.push({
                        id: `edge-gf-reset-${match.id}-${resetMatch.id}`,
                        source: match.id,
                        target: resetMatch.id,
                        sourceHandle: 'sr',
                        targetHandle: 'tl',
                        type: 'smoothstep',
                        pathOptions: EDGE_PATH,
                        style: { stroke: 'rgba(232, 197, 61, 0.5)', strokeWidth: 1.75 }
                    });
                });
            }
        });

        // 4. No champion pedestal (option 5B) — the deciding match is crowned
        // in place, which drops a whole column from the widest bracket we draw.

        // Sort edges so that tracked edges are rendered last (drawn on top)
        const sortedEdges = [...edges].sort((a, b) => {
            const aIsTracked = a.style?.filter ? 1 : 0;
            const bIsTracked = b.style?.filter ? 1 : 0;
            return aIsTracked - bIsTracked;
        });

        return { nodes, edges: sortedEdges };
    }, [winnersRounds, losersRounds, grandFinals, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, seeds, onOpenScoring, getMatchY, getLosersMatchY, tournament?.winner]);

    /** What the colour key lists, and where each swatch flies the viewport.
     *  Derived from the rounds that exist, so a single-elimination bracket
     *  never offers a Losers key it cannot honour. */
    const halves = useMemo(() => {
        const ids = (rounds: Round[]) => rounds.flatMap((r) => r.matches.map((m) => m.id));
        const out: { key: string; label: string; short: string; colour: string; nodeIds: string[] }[] = [];
        if (winnersRounds.length) out.push({ key: 'w', label: 'Winners', short: 'W', colour: '#52B946', nodeIds: ids(winnersRounds) });
        if (losersRounds.length) out.push({ key: 'l', label: 'Losers', short: 'L', colour: '#FF4D4D', nodeIds: ids(losersRounds) });
        if (grandFinals.length) out.push({ key: 'g', label: 'Final', short: 'GF', colour: '#e8c53d', nodeIds: ids(grandFinals) });
        return out.filter((h) => h.nodeIds.length > 0);
    }, [winnersRounds, losersRounds, grandFinals]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Bracket Canvas */}
            <div className="relative w-full h-full group">
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        onNodeClick={(e, node) => {
                            if (node.type === 'match' && isAdmin) {
                                const data = node.data as any;
                                if (data?.match) {
                                    onOpenScoring(data.match, { x: e.clientX, y: e.clientY });
                                }
                            }
                        }}
                        fitView
                        /* The bracket's text is 12px, but `fitView` was free to
                           zoom to 0.2 to make a large bracket fit — rendering
                           names at ~2px and erasing the round sublabels
                           entirely. That, not the CSS, is why the tree looked
                           like a debug view. Fit now stops at 55% and the
                           viewer pans instead, which is what panning is for. */
                        fitViewOptions={{ padding: 0.15, minZoom: MIN_FIT_ZOOM }}
                        minZoom={0.35}
                        maxZoom={1.5}
                        colorMode="dark"
                        proOptions={{ hideAttribution: true }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        nodesFocusable={false}
                        elementsSelectable={false}
                        zoomOnDoubleClick={false}
                        panOnScroll={panOnScroll}
                        zoomOnScroll={zoomOnScroll}
                        zoomOnPinch={zoomOnPinch}
                        panOnScrollMode={panOnScrollMode}
                        zoomActivationKeyCode={null}
                    >
                        <Background color="#111" gap={20} />
                        <ViewportFit focusedMatchId={focusedMatchId} nodes={nodes} />

                        {/* Same bar, two anchors: the phone's fixed bottom
                            navigation overlaps the foot of a full-bleed canvas,
                            so there it rides at the top instead. */}
                        <Panel position="top-left" className="z-50 m-3 md:hidden">
                            <CanvasBar halves={halves} trackedUserId={trackedUserId} setTrackedUserId={setTrackedUserId} leaderboard={leaderboard} />
                        </Panel>
                        <Panel position="bottom-left" className="z-50 m-6 hidden md:block">
                            <CanvasBar halves={halves} trackedUserId={trackedUserId} setTrackedUserId={setTrackedUserId} leaderboard={leaderboard} />
                        </Panel>

                        {/* Floating Player Tracker Widget as a React Flow Panel */}
                        {trackedUserId && sortedPlayerMatches.length > 0 && (
                            <Panel position="bottom-right" className="z-50 m-6">
                                <div className="w-80 bg-black border border-primary shadow-[0_0_20px_rgba(82,185,70,0.35)] rounded-sm p-4 text-left font-questrial">
                                    {/* Header row: circular icon, title/name, close button */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center text-primary font-bold text-xs shadow-[0_0_8px_rgba(82,185,70,0.1)]">
                                                {(leaderboard.find(u => u.userId === trackedUserId)?.username?.[0] || 'P').toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-[0.25em] text-primary">
                                                    Currently Tracking
                                                </span>
                                                <span className="text-sm font-black text-white uppercase tracking-wider">
                                                    {leaderboard.find(u => u.userId === trackedUserId)?.username || 'User'}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setTrackedUserId(null)} 
                                            className="text-white/40 hover:text-white transition-colors p-1"
                                            title="Stop tracking"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Divider line */}
                                    <div className="h-[1px] bg-white/10 w-full my-3" />

                                    {/* Nav row: arrow left, index label, arrow right */}
                                    <div className="flex items-center justify-between bg-[#0a0a0a] border border-white/10 rounded-sm p-1">
                                        <button 
                                            disabled={trackedMatchIndex === 0}
                                            onClick={() => setTrackedMatchIndex(prev => Math.max(0, prev - 1))}
                                            className="p-2 text-white hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                        >
                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        
                                        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                                            Match {trackedMatchIndex + 1} of {sortedPlayerMatches.length}
                                        </span>

                                        <button 
                                            disabled={trackedMatchIndex === sortedPlayerMatches.length - 1}
                                            onClick={() => setTrackedMatchIndex(prev => Math.min(sortedPlayerMatches.length - 1, prev + 1))}
                                            className="p-2 text-white hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                        >
                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </ReactFlow>
                </ReactFlowProvider>
            </div>
        </div>
    );
}
