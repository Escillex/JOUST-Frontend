"use client";
import { isWinnersRound, isLosersRound, losersRoundIndex } from "../roundNumbers";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Match, Round, LeaderboardEntry } from "../types";
import MatchCard from "../../../../components/tournaments/bracket/MatchCard";
import { 
  ReactFlow, 
  Background, 
  Panel,
  Node as FlowNode,
  Edge,
  Handle,
  Position,
  NodeProps,
  EdgeTypes,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  PanOnScrollMode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Layout Constants
const COLUMN_WIDTH = 360;
const BASE_MATCH_GAP = 150;
const HEADER_HEIGHT = 100;

// Custom Match Node Component
const MatchNode = ({ data }: NodeProps<FlowNode<{ 
    match: Match; 
    isAdmin: boolean; 
    updating: string | null; 
    leaderboard: LeaderboardEntry[]; 
    trackedUserId: string | null;
    currentUserId?: string | null;
    focusedMatchId: string | null;
    onOpenScoring: (match: Match, pos?: {x: number, y: number}) => void;
}>>) => {
    return (
        <div className="relative group">
            {/* Input handles (incoming from the previous round, either side) */}
            <Handle id="tl" type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            <Handle id="tr" type="target" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
            
            <div onClick={(e) => {
                e.stopPropagation();
                if (data.isAdmin) {
                    data.onOpenScoring(data.match, { x: e.clientX, y: e.clientY });
                }
            }}>
                <MatchCard 
                    match={data.match} 
                    onOpenScoring={() => {}}
                    isAdmin={data.isAdmin}
                    isUpdating={data.updating === data.match.id}
                    leaderboard={data.leaderboard}
                    trackedUserId={data.trackedUserId}
                    currentUserId={data.currentUserId}
                    isFocused={data.focusedMatchId === data.match.id}
                />
            </div>

            {/* Output handles (outgoing to the next round or the champion pedestal) */}
            <Handle id="sr" type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
            <Handle id="sl" type="source" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            <Handle id="sb" type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
        </div>
    );
};

// Custom Champion Node
const ChampionNode = ({ data }: NodeProps<FlowNode<{ label: string; hasChampion?: boolean }>>) => (
    <div className="flex flex-col items-center">
        <Handle id="cl" type="target" position={Position.Left} className="!opacity-0" />
        <Handle id="ct" type="target" position={Position.Top} className="!opacity-0" />
        <div className={`w-72 p-12 flex flex-col items-center justify-center gap-6 rounded-sm border transition-all duration-500 bg-black ${
            data.hasChampion 
                ? 'border-primary shadow-[0_0_30px_rgba(82,185,70,0.25)]' 
                : 'border-white/10 border-dashed bg-white/5'
        }`}>
            <div className={`w-16 h-16 rounded-full border flex items-center justify-center transition-all duration-500 ${
                data.hasChampion 
                    ? 'border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(82,185,70,0.35)]' 
                    : 'border-white/10 text-white/20'
            }`}>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z"/></svg>
            </div>
            <span className={`text-[12px] font-black uppercase tracking-widest transition-all duration-500 ${
                data.hasChampion 
                    ? 'text-primary drop-shadow-[0_0_8px_rgba(82,185,70,0.5)]' 
                    : 'text-white/40'
            }`}>
                {data.label}
            </span>
        </div>
    </div>
);

const HeaderNode = ({ data }: NodeProps<FlowNode<{ label: string; sublabel: string }>>) => (
    <div className="w-80 flex flex-col justify-center border-b border-white/5 bg-zinc-900/30 px-4 py-2 opacity-80">
        <span className="text-[11px] font-bold text-white tracking-widest uppercase">{data.label}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-tighter">{data.sublabel}</span>
    </div>
);

const ChampionHeaderNode = ({ data }: NodeProps<FlowNode<{ label: string }>>) => (
    <div className="w-80 flex flex-col justify-center border-b border-primary/20 bg-primary/5 px-4 py-2">
        <span className="text-[11px] font-bold text-primary tracking-widest uppercase">{data.label}</span>
    </div>
);


interface EliminationLayoutProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match, pos?: {x: number, y: number}) => void;
    addLog: (action: string, details?: string) => void;
    currentUserId?: string | null;
}
 
function FlowControls({ focusedMatchId, nodes }: { focusedMatchId: string | null; nodes: FlowNode[] }) {
    const { setCenter, fitView } = useReactFlow();

    useEffect(() => {
        // Delay viewport manipulation slightly to allow React Flow to measure DOM nodes.
        // Without this, completed tournaments (which don't poll/re-render) will fitView on 0x0 nodes and turn blank.
        const timer = setTimeout(() => {
            if (!focusedMatchId) {
                fitView({ padding: 0.1, duration: 800 });
                return;
            }
            
            const targetNode = nodes.find(n => n.id === focusedMatchId);
            
            if (targetNode) {
                // Offset to roughly center the match card
                setCenter(targetNode.position.x + 160, targetNode.position.y + 60, { zoom: 1, duration: 800 });
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [focusedMatchId, nodes, fitView, setCenter]);

    return (
        <Panel position="bottom-left" className="z-50 m-6">
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
        <Panel position="top-right" className="hidden md:block p-4 pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex flex-col gap-1 text-[10px] font-bold tracking-widest text-white/40 uppercase bg-black/80 p-4 border border-white/10 backdrop-blur-sm shadow-xl rounded-sm">
                <span><strong className="text-white">SCROLL</strong>: ZOOM</span>
                <span><strong className="text-white">SHIFT + SCROLL</strong>: PAN HORIZONTAL</span>
                <span><strong className="text-white">CTRL + SCROLL</strong>: PAN VERTICAL</span>
                <span><strong className="text-white">CLICK & DRAG</strong>: PAN CANVAS</span>
            </div>
        </Panel>
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

    const winnersRounds = useMemo(() => tournament?.rounds?.filter((r: Round) => isWinnersRound(r.roundNumber)).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);
    const losersRounds = useMemo(() => tournament?.rounds?.filter((r: Round) => isLosersRound(r.roundNumber)).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);
    const grandFinals = useMemo(() => tournament?.rounds?.filter((r: Round) => r.roundNumber >= 200).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);

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
        champion: ChampionNode,
        header: HeaderNode,
        championHeader: ChampionHeaderNode
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

    const { nodes, edges } = useMemo(() => {
        const nodes: FlowNode[] = [];
        const edges: Edge[] = [];

        // Build a map of all matches by ID for path lookup
        const matchMap = new Map<string, Match>();
        const allRoundsList = [...winnersRounds, ...losersRounds, ...grandFinals];
        allRoundsList.forEach((round: Round) => {
            round.matches.forEach((m: Match) => {
                matchMap.set(m.id, m);
            });
        });

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
            const centerX = (totalRounds - 1) * COLUMN_WIDTH;
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
                s === 'C' ? centerX : s === 'R' ? (lastColumn - rIdx) * COLUMN_WIDTH : rIdx * COLUMN_WIDTH;

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
                        matchYMap.set(m.id, leafSlots[s] * BASE_MATCH_GAP);
                    }
                });
            });

            // Stage name per column (shown mirrored on both sides)
            const stageLabel = (rIdx: number, round: Round): string => {
                const fromEnd = totalRounds - 1 - rIdx;
                if (fromEnd === 1) return 'SEMI-FINALS';
                if (fromEnd === 2) return 'QUARTER-FINALS';
                if (round.matches.length === Math.pow(2, fromEnd)) return `ROUND OF ${Math.pow(2, fromEnd + 1)}`;
                return `ROUND ${round.roundNumber}`;
            };

            winnersRounds.forEach((round: Round, rIdx: number) => {
                const isFinalRound = rIdx === totalRounds - 1;
                const sortedMatches = [...round.matches].sort((a: Match, b: Match) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0));

                if (isFinalRound) {
                    nodes.push({
                        id: `header-round-${round.roundNumber}`,
                        type: 'championHeader',
                        position: { x: centerX, y: 50 },
                        data: { label: 'FINAL' },
                        draggable: false, selectable: false
                    });
                } else {
                    const sidesInRound = new Set(sortedMatches.map((m) => sideMap.get(m.id) || 'L'));
                    (['L', 'R'] as const).forEach((s) => {
                        if (!sidesInRound.has(s)) return;
                        nodes.push({
                            id: `header-round-${round.roundNumber}-${s}`,
                            type: 'header',
                            position: { x: columnX(rIdx, s), y: 50 },
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
                        position: { x: columnX(rIdx, s), y: matchYMap.get(match.id) ?? BASE_MATCH_GAP },
                        data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, onOpenScoring },
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
                            type: 'step',
                            style: tracked
                                ? { stroke: '#52B946', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(82, 185, 70, 0.6))', zIndex: 10 }
                                : { stroke: 'rgba(82, 185, 70, 0.35)', strokeWidth: 1.5 }
                        });
                    }
                });
            });

            // Champion pedestal sits centered beneath the final
            const finalY = matchYMap.get(finalMatch.id) ?? BASE_MATCH_GAP;
            nodes.push({
                id: 'champion-pedestal',
                type: 'champion',
                position: { x: centerX, y: finalY + 220 },
                data: {
                    label: tournament?.winner?.username || 'TBD',
                    hasChampion: !!tournament?.winner
                },
                draggable: false
            });

            const isFinalEdgeTracked = trackedUserId &&
                (finalMatch.player1?.id === trackedUserId || finalMatch.player2?.id === trackedUserId) &&
                tournament?.winner?.id === trackedUserId;

            edges.push({
                id: `edge-final-champion`,
                source: finalMatch.id,
                sourceHandle: 'sb',
                target: 'champion-pedestal',
                targetHandle: 'ct',
                type: 'step',
                style: isFinalEdgeTracked
                    ? { stroke: '#52B946', strokeWidth: 2.5, strokeDasharray: '6 4', filter: 'drop-shadow(0px 0px 5px rgba(82, 185, 70, 0.8))', zIndex: 10 }
                    : { stroke: 'rgba(82, 185, 70, 0.45)', strokeWidth: 2, strokeDasharray: '6 4' }
            });

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
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, onOpenScoring },
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
                        type: 'step',
                        style: tracked
                            ? { stroke: '#52B946', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(82, 185, 70, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(82, 185, 70, 0.35)', strokeWidth: 1.5 }
                    });
                }
            });
        });

        // 2. Losers Bracket (Rendered below Winners)
        const losersVerticalOffset = (winnersRounds[0]?.matches?.length || 4) * BASE_MATCH_GAP + 400;
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
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, onOpenScoring },
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
                        type: 'step',
                        style: tracked
                            ? { stroke: '#f59e0b', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(245, 158, 11, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(245, 158, 11, 0.4)', strokeWidth: 1.5 }
                    });
                }
            });
        });

        // 3. Grand Finals
        grandFinals.forEach((round: Round, rIdx: number) => {
            const gfX = (winnersRounds.length + rIdx) * COLUMN_WIDTH;
            const gfY = getMatchY(winnersRounds.length - 1, 0);

            nodes.push({
                id: `header-round-${round.roundNumber}`,
                type: 'header',
                position: { x: gfX, y: 50 },
                data: { label: 'GRAND FINALS', sublabel: 'CHAMPIONSHIP' },
                draggable: false, selectable: false
            });

            round.matches.forEach((match: Match, mIdx: number) => {
                nodes.push({
                    id: match.id,
                    type: 'match',
                    position: { x: gfX, y: gfY + (mIdx * 200) },
                    data: { match, isAdmin, updating, leaderboard, trackedUserId, currentUserId, focusedMatchId, onOpenScoring },
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
                        type: 'step',
                        style: tracked
                            ? { stroke: '#ffffff', strokeWidth: 2, filter: 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.6))', zIndex: 10 }
                            : { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 1.5 }
                    });
                }
            });
        });

        // 4. Champion Pedestal
        const allRounds = [...winnersRounds, ...grandFinals];
        if (allRounds.length > 0) {
            const lastRound = allRounds[allRounds.length - 1];
            const finalMatch = lastRound.matches[0];
            if (finalMatch) {
                const championX = allRounds.length * COLUMN_WIDTH;
                const championY = getMatchY(winnersRounds.length - 1, 0);

                nodes.push({
                    id: 'champion-header',
                    type: 'championHeader',
                    position: { x: championX, y: 50 },
                    data: { label: 'CHAMPION' },
                    draggable: false, selectable: false
                });

                nodes.push({
                    id: 'champion-pedestal',
                    type: 'champion',
                    position: { x: championX, y: championY - 35 },
                    data: { 
                        label: tournament?.winner?.username || 'TBD',
                        hasChampion: !!tournament?.winner
                    },
                    draggable: false
                });

                const isFinalEdgeTracked = trackedUserId && 
                    (finalMatch.player1?.id === trackedUserId || finalMatch.player2?.id === trackedUserId) &&
                    tournament?.winner?.id === trackedUserId;

                edges.push({
                    id: `edge-final-champion`,
                    source: finalMatch.id,
                    sourceHandle: 'sr',
                    target: 'champion-pedestal',
                    targetHandle: 'cl',
                    type: 'step',
                    style: isFinalEdgeTracked
                        ? { stroke: '#52B946', strokeWidth: 2.5, strokeDasharray: '6 4', filter: 'drop-shadow(0px 0px 5px rgba(82, 185, 70, 0.8))', zIndex: 10 }
                        : { stroke: 'rgba(82, 185, 70, 0.45)', strokeWidth: 2, strokeDasharray: '6 4' }
                });
            }
        }

        // Sort edges so that tracked edges are rendered last (drawn on top)
        const sortedEdges = [...edges].sort((a, b) => {
            const aIsTracked = a.style?.filter ? 1 : 0;
            const bIsTracked = b.style?.filter ? 1 : 0;
            return aIsTracked - bIsTracked;
        });

        return { nodes, edges: sortedEdges };
    }, [winnersRounds, losersRounds, grandFinals, isAdmin, updating, leaderboard, trackedUserId, focusedMatchId, onOpenScoring, getMatchY, getLosersMatchY, tournament?.winner]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Toolbar Panel */}
            <div className="flex items-center justify-between px-6 py-4 bg-black border-b border-white/10 shrink-0 z-20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#52b946]" />
                         <span className="text-[11px] font-bold text-white uppercase tracking-wider">Tournament Bracket — {nodes.filter(n => n.type === 'match').length} Matches</span>
                    </div>
                    <div className="relative">
                        <select 
                            value={trackedUserId || ""} 
                            onChange={(e) => setTrackedUserId(e.target.value || null)} 
                            className={`bg-white/5 border border-white/10 px-4 py-2 pr-8 text-[10px] font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer transition-all rounded-sm ${trackedUserId ? 'text-primary' : 'text-white/60 hover:border-primary hover:text-white'}`}
                        >
                            <option value="">{trackedUserId ? "Stop Tracking" : "Track Participant"}</option>
                            {leaderboard.map(u => (
                                <option key={u.userId} value={u.userId}>{u.username}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">▼</div>
                    </div>
                </div>
            </div>

            {/* Bracket Canvas */}
            <div className="relative w-full h-full group">
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
                        panOnScroll={panOnScroll}
                        zoomOnScroll={zoomOnScroll}
                        zoomOnPinch={zoomOnPinch}
                        panOnScrollMode={panOnScrollMode}
                        zoomActivationKeyCode={null}
                    >
                        <Background color="#111" gap={20} />
                        <FlowControls focusedMatchId={focusedMatchId} nodes={nodes} />
                        <FlowLegend />

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
