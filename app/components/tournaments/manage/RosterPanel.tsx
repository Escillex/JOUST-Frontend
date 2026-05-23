"use client";
import { Tournament } from "../../../tournaments/types";
import { DragDropProvider, PointerSensor, DragEndEvent } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

interface Props { 
  tournament: Tournament;
  onReorder: (activeUserId: string, newIndex: number) => void;
  onRemove: (userId: string) => void;
}

function SortableParticipantCard({ p, idx, isAdmin, onRemove }: { p: any; idx: number; isAdmin: boolean; onRemove: (id: string) => void }) {
  const { ref, handleRef, isDragging } = useSortable({
    id: p.userId,
    index: idx,
    disabled: !isAdmin,
  });

  return (
    <div
      ref={ref}
      className={`bg-[#000000] border transition-colors rounded flex items-center justify-between group h-12 px-4 ${isDragging ? 'border-[#52B946] bg-white/5' : 'border-white/20 hover:border-white/40'}`}
    >
      <div className="flex items-center gap-4">
        {isAdmin && (
          <div
            ref={handleRef}
            className="cursor-grab active:cursor-grabbing text-[#888888] hover:text-white transition-colors py-2 px-3 -ml-3 touch-none flex items-center h-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16"/>
            </svg>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-[#888888] font-mono text-xs w-6 text-right">{idx + 1}.</span>
          <span className="text-sm font-semibold text-white truncate max-w-[120px] md:max-w-xs">{p.user?.username || p.user?.guestName || "Unknown"}</span>
        </div>
        {p.user?.isGuest && (
          <span className="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded uppercase font-semibold">Guest</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[10px] text-[#888888] font-mono">#{p.user?.id?.slice(0, 6)}</span>
        {isAdmin && (
          <button 
            onClick={() => onRemove(p.userId)}
            className="w-6 h-6 flex items-center justify-center text-[#888888] hover:text-[#FF4D4D] rounded transition-colors"
            title="Remove Participant"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function RosterPanel({ tournament, onReorder, onRemove }: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { source, target } = event.operation;
    if (source && target && source.id !== target.id) {
      const oldIndex = tournament.participants.findIndex(p => p.userId === source.id);
      const newIndex = tournament.participants.findIndex(p => p.userId === target.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(source.id as string, newIndex);
      }
    }
  };

  const isOpen = tournament.status === "OPEN";

  return (
    <div className="lg:col-span-8 space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-white">
          Participant Roster <span className="text-[#888888] ml-2 font-normal text-sm">[{tournament.participants.length} / {tournament.maxPlayers}]</span>
        </h2>
        <div className="h-[1px] flex-1 bg-white/10" />
      </div>

      <DragDropProvider
        sensors={[PointerSensor]}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {tournament.participants.length === 0 ? (
            <div className="md:col-span-2 py-16 border border-dashed border-white/20 rounded bg-transparent flex flex-col items-center justify-center gap-2">
              <p className="font-semibold text-sm text-[#888888]">No participants registered</p>
            </div>
          ) : (
            tournament.participants.map((p, idx) => (
              <SortableParticipantCard key={p.userId} p={p} idx={idx} isAdmin={isOpen} onRemove={onRemove} />
            ))
          )}
        </div>
      </DragDropProvider>
    </div>
  );
}
