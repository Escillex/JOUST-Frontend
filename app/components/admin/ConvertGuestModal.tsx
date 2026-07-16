"use client";
import { useState, useEffect } from "react";
import { AdminUser } from "./UserRegistry";

interface Props {
  guest: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (guestId: string, data: any) => Promise<void>;
}

export default function ConvertGuestModal({ guest, isOpen, onClose, onSubmit }: Props) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (guest) {
      setFormData(prev => ({ ...prev, username: guest.username || "" }));
    }
  }, [guest, isOpen]);

  if (!isOpen || !guest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(guest.id || guest.sub!, formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1B1B1B]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#1B1B1B] border border-white/10 w-full max-w-[440px] shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden rounded-sm">
        <div className="p-6 border-b border-white/5 bg-[#1B1B1B]">
          {/* Reworded: this modal used sci-fi style wording ("Status
              Elevation Service"). Project rule: admin screens use plain,
              professional language. */}
          <h3 className="text-lg font-semibold text-white tracking-tight">Convert Guest to Account</h3>
          <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">Guest Account Conversion</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] leading-relaxed">
              Converting <span className="text-primary font-bold">{guest.username}</span> to a permanent registered account.
              This will preserve all match history and statistics.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-0.5">Username</label>
              <input
                type="text" required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full h-10 bg-[#1B1B1B] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/10 rounded-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-0.5">Email Address</label>
              <input
                type="email" required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-10 bg-[#1B1B1B] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/10 rounded-sm"
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-0.5">Password</label>
              <input
                type="password" required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-10 bg-[#1B1B1B] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/10 rounded-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 bg-primary text-black text-[11px] font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 rounded-sm"
            >
              {isSubmitting ? "Converting..." : "Convert Guest"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 h-10 bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all rounded-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
