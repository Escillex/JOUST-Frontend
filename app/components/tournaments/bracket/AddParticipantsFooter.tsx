"use client";
const inputCls = "h-12 bg-background border border-foreground/10 px-4 text-xs text-foreground focus:outline-none focus:border-primary transition-all rounded-xl";

interface Props {
  tournament: any;
  allUsers: any[];
  guestUsername: string;
  setGuestUsername: (v: string) => void;
  selectedUserId: string;
  setSelectedUserId: (v: string) => void;
  onAddGuest: () => void;
  onJoin: (userId: string) => void;
}

export default function AddParticipantsFooter({ tournament, allUsers, guestUsername, setGuestUsername, selectedUserId, setSelectedUserId, onAddGuest, onJoin }: Props) {
  const available = allUsers.filter(u => !tournament.participants.some((p: any) => p.userId === u.id));

  return (
    <div className="bg-foreground/5 border border-foreground/5 p-8 rounded-[3rem] space-y-8 lg:col-span-2">
      <h3 className="text-xs font-black text-primary uppercase tracking-[0.4em] font-poppins border-b border-foreground/10 pb-4">Participant Registration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Summon Guest */}
        <div className="space-y-4">
          <p className="text-[9px] font-black text-foreground/40 uppercase tracking-widest font-poppins ml-1">Add Guest</p>
          <div className="flex gap-2">
            <input placeholder="GUEST NAME" value={guestUsername} onChange={e => setGuestUsername(e.target.value)} className={`flex-1 ${inputCls}`} />
            <button onClick={onAddGuest} className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary font-black text-xl hover:bg-primary hover:text-white transition-all rounded-xl">+</button>
          </div>
        </div>

        {/* Invite Player */}
        <div className="space-y-4">
          <p className="text-[9px] font-black text-foreground/40 uppercase tracking-widest font-poppins ml-1">Invite Player</p>
          <div className="flex flex-col gap-2">
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className={`w-full ${inputCls}`}>
              <option value="">SELECT PLAYER</option>
              {available.map((u: any) => (
                <option key={u.id} value={u.id}>{(u.username || "Unknown User").toUpperCase()}</option>
              ))}
            </select>
            <button onClick={() => selectedUserId && onJoin(selectedUserId)} className="w-full h-12 bg-foreground/10 text-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-foreground hover:text-background transition-all font-poppins">Add Player</button>
          </div>
        </div>

      </div>
    </div>
  );
}
