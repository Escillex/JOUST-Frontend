"use client";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Tournament } from "../../tournaments/types";
import { resolveImageUrl } from "../../utils/api";

type SortField = "name" | "date" | "status" | "prizePool";
type SortOrder = "asc" | "desc";

interface TournamentDirectoryProps {
    tournaments: Tournament[];
}

export default function TournamentDirectory({ tournaments }: TournamentDirectoryProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<SortField>("date");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    const filteredAndSortedTournaments = useMemo(() => {
        let filtered = tournaments.filter(t => {
            const nameMatch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
            const statusMatch = statusFilter === "ALL" || t.status === statusFilter;
            return nameMatch && statusMatch;
        });

        return filtered.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];

            if (sortField === "date") {
                valA = a.date ? new Date(a.date).getTime() : 0;
                valB = b.date ? new Date(b.date).getTime() : 0;
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });
    }, [tournaments, searchTerm, sortField, sortOrder, statusFilter]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    return (
        <section className="space-y-16">
            <div className="border-b-8 border-white pb-8">
                <h2 className="text-6xl md:text-9xl font-black text-white uppercase tracking-tighter leading-none font-poppins italic">
                    Tournaments
                </h2>
                <p className="text-primary text-[10px] font-black uppercase tracking-[0.5em] mt-4">
                    {filteredAndSortedTournaments.length} tournaments found
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Control Sidebar */}
                <aside className="lg:col-span-3 space-y-10 sticky top-24">
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-white/30 uppercase tracking-widest">Search</h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name or ID"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-component-background border-2 border-component-border px-4 py-4 text-xs text-white placeholder:text-white/10 focus:border-primary transition-all outline-none uppercase font-poppins"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black">SEARCH</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-white/30 uppercase tracking-widest">Sort By</h3>
                        <div className="flex flex-col gap-2">
                            {(["name", "date", "status", "prizePool"] as SortField[]).map(field => (
                                <button
                                    key={field}
                                    onClick={() => toggleSort(field)}
                                    className={`w-full px-5 py-4 border-2 font-black text-[10px] uppercase tracking-widest transition-all flex justify-between items-center ${sortField === field ? "bg-white text-black border-white" : "bg-component-background border-component-border text-white/40 hover:border-white hover:text-white"
                                        }`}
                                >
                                    {field === "prizePool" ? "Prize Pool" : field}
                                    {sortField === field && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-white/30 uppercase tracking-widest">Filter by Status</h3>
                        <div className="flex flex-wrap gap-2">
                            {["ALL", "UPCOMING", "OPEN", "ONGOING", "COMPLETED"].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 border-2 font-black text-[9px] uppercase tracking-widest transition-all ${statusFilter === status ? "bg-primary border-primary text-black" : "bg-component-background border-component-border text-white/20 hover:border-white/20 hover:text-white"
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main Directory Grid */}
                <div className="lg:col-span-9">
                    {filteredAndSortedTournaments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {filteredAndSortedTournaments.map((t, idx) => (
                                <motion.div
                                    key={t.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`group relative bg-component-background border-2 transition-all overflow-hidden ${t.status === 'COMPLETED'
                                            ? 'border-component-border hover:border-white/40 hover:bg-white/5 hover:shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)]'
                                            : 'border-component-border hover:border-primary hover:bg-primary/5 hover:shadow-[12px_12px_0px_0px_#52B946]'
                                        }`}
                                >
                                    <Link href={`/tournaments/${t.id}`} className="flex flex-col h-full">
                                        <div className={`h-40 w-full overflow-hidden border-b-2 transition-colors bg-component-background relative ${t.status === 'COMPLETED' ? 'border-component-border' : 'border-component-border group-hover:border-primary'
                                            }`}>
                                            <img
                                                src={resolveImageUrl(t.bannerUrl, "/placeholder.jpg")}
                                                alt={t.name}
                                                className={`w-full h-full object-cover opacity-95 group-hover:opacity-100 brightness-100 group-hover:brightness-110 transition-all duration-700 ${t.status === 'COMPLETED' ? 'grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100' : ''
                                                    }`}
                                            />
                                            <div className="absolute top-4 right-4 bg-component-background/80 border border-component-border px-3 py-1 text-[8px] font-black text-white uppercase tracking-widest">
                                                ID: {t.id.slice(0, 8)}
                                            </div>
                                        </div>
                                        <div className="p-8 space-y-8 flex-1 flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${t.status === "OPEN" ? "bg-primary animate-pulse shadow-[0_0_8px_#52B946]" : "bg-white/20"}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${t.status === "OPEN" ? "text-primary" : "text-white/40"
                                                        }`}>
                                                        {t.status}
                                                    </span>
                                                </div>
                                                <h4 className={`text-3xl font-black uppercase tracking-tighter leading-none font-poppins transition-colors italic ${t.status === 'COMPLETED' ? 'text-white/40 group-hover:text-white' : 'text-white group-hover:text-primary'
                                                    }`}>
                                                    {t.name}
                                                </h4>
                                            </div>
                                            <div className="flex flex-col gap-3 pt-6 border-t border-component-border">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Format</span>
                                                    <span className="text-[10px] font-black text-white uppercase">
                                                        {((t.format && typeof t.format === 'object') ? t.format.system : "UNKNOWN")?.replace("_", " ") || "UNKNOWN"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Prize Pool</span>
                                                    <span className={`text-xl font-black ${t.status === 'COMPLETED' ? 'text-white/20 group-hover:text-primary' : 'text-primary'}`}>
                                                        ${t.prizePool?.toLocaleString() || "0"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center border-4 border-dashed border-white/5 space-y-6">
                            <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.5em]">No tournaments found</p>
                            <button onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }} className="px-8 py-3 border-2 border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all">Clear Filters</button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
