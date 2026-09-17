'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  authenticatedFetch,
  API_ENDPOINTS,
  safeJson,
  SOCKET_URL,
} from '../../../../utils/api';

type Tab = 'COIN' | 'DICE' | 'CALC' | 'TIMER';
type Perm = 'NONE' | 'STAFF' | 'PARTICIPANTS' | 'STAFF_AND_PARTICIPANTS';

interface FlipEntry {
  kind: 'COIN' | 'DICE';
  result: string;
  at: string;
}
interface UtilityState {
  matchId: string;
  perms: { enabled: boolean; coinWho: Perm; diceWho: Perm; timerWho: Perm };
  timer: {
    durationSec: number | null;
    endsAt: string | null;
    running: boolean;
    pausedRemainingSec: number | null;
  };
  flips: Record<string, FlipEntry>;
}

interface Props {
  matchId?: string;
  tournamentId?: string;
  currentUserId?: string;
  /** Tournament staff (creator / admin / co-organizer) — from `isAdmin`. */
  isStaff?: boolean;
  /** The two match players, for labelling whose flip is whose. */
  players?: { id: string; name: string }[];
}

/**
 * Shared "Match Utilities": coin, dice and timer are live per-match state,
 * broadcast to everyone viewing the match (socket, with a polling fallback per
 * Core Rule 8). Who may trigger each is resolved from the tournament config on
 * the server; the client shows a trigger only when the viewer is allowed. Calc
 * stays a personal, local tool.
 */
function useMatchUtilities(
  { matchId, tournamentId, currentUserId, isStaff, players = [] }: Props,
  isOpen: boolean,
) {
  const [state, setState] = useState<UtilityState | null>(null);
  const [connected, setConnected] = useState(false);

  const apply = useCallback((s: UtilityState | null) => {
    if (s && typeof s === 'object') setState(s);
  }, []);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.UTILITY_GET(matchId));
    if (res.ok) apply(await safeJson(res));
  }, [matchId, apply]);

  // Fetch once when the panel opens.
  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  // Live push over the tournament socket room; filter to this match.
  useEffect(() => {
    if (!isOpen || !matchId || !tournamentId) return;
    const socket: Socket = io(SOCKET_URL, { withCredentials: true, reconnection: true });
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', tournamentId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('utility:update', (payload: { matchId: string; state: UtilityState }) => {
      if (payload?.matchId === matchId) apply(payload.state);
    });
    return () => {
      socket.disconnect();
    };
  }, [isOpen, matchId, tournamentId, apply]);

  // temporary polling block — fallback while the socket is down (Rule 8).
  useEffect(() => {
    if (!isOpen || connected) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [isOpen, connected, refresh]);
  // end of temporary polling block

  const perms = state?.perms;
  const isParticipant = !!currentUserId && players.some((p) => p.id === currentUserId);
  const allowed = (perm?: Perm): boolean => {
    if (!perm || perm === 'NONE' || perms?.enabled === false) return false;
    const staffOk = (perm === 'STAFF' || perm === 'STAFF_AND_PARTICIPANTS') && !!isStaff;
    const partOk =
      (perm === 'PARTICIPANTS' || perm === 'STAFF_AND_PARTICIPANTS') && isParticipant;
    return staffOk || partOk;
  };

  const post = useCallback(
    async (endpoint: string, body?: object) => {
      const res = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) apply(await safeJson(res));
    },
    [apply],
  );

  return {
    state,
    enabled: perms?.enabled !== false,
    canCoin: allowed(perms?.coinWho),
    canDice: allowed(perms?.diceWho),
    canTimer: allowed(perms?.timerWho),
    coinEnabled: perms?.coinWho !== 'NONE',
    diceEnabled: perms?.diceWho !== 'NONE',
    timerEnabled: perms?.timerWho !== 'NONE',
    flipCoin: () => matchId && post(API_ENDPOINTS.MATCHES.UTILITY_COIN(matchId)),
    rollDice: (sides: number, count = 1) =>
      matchId && post(API_ENDPOINTS.MATCHES.UTILITY_DICE(matchId), { sides, count }),
    timerAction: (action: string, durationSec?: number) =>
      matchId &&
      post(API_ENDPOINTS.MATCHES.UTILITY_TIMER(matchId), { action, durationSec }),
    nameFor: (userId: string) =>
      userId === currentUserId
        ? 'You'
        : players.find((p) => p.id === userId)?.name || 'Organizer',
  };
}

export default function PlayerToolkit(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('COIN');
  const u = useMatchUtilities(props, isOpen);

  // Master switch off: hide the panel entirely (config utilitiesEnabled = false).
  if (props.matchId && u.state && !u.enabled) return null;

  return (
    <div className="w-full border border-white/10 bg-black mt-2 font-poppins text-white select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Match Utilities</span>
        </div>
        <span className="text-white/40 text-xs font-black">{isOpen ? '−' : '+'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="flex border-b border-white/5">
              {(['COIN', 'DICE', 'CALC', 'TIMER'] as Tab[]).map((tab) => {
                // Hide a shared tab the organizer disabled; CALC is always local.
                if (tab === 'COIN' && u.state && !u.coinEnabled) return null;
                if (tab === 'DICE' && u.state && !u.diceEnabled) return null;
                if (tab === 'TIMER' && u.state && !u.timerEnabled) return null;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab
                        ? 'bg-primary/10 text-primary border-b-2 border-primary'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/70 border-b-2 border-transparent'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-white/3 min-h-[220px] flex items-center justify-center">
              {activeTab === 'COIN' && (
                <CoinFlipper flips={u.state?.flips} canFlip={u.canCoin} onFlip={u.flipCoin} nameFor={u.nameFor} />
              )}
              {activeTab === 'DICE' && (
                <DiceRoller flips={u.state?.flips} canRoll={u.canDice} onRoll={u.rollDice} nameFor={u.nameFor} />
              )}
              {activeTab === 'CALC' && <MiniCalculator />}
              {activeTab === 'TIMER' && (
                <MatchTimer timer={u.state?.timer} canControl={u.canTimer} onAction={u.timerAction} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── shared flip list ─────────────────────────────────────────────────────────

/** Each person's latest coin/dice result, newest first — the "you see what they
 *  flip" display. */
function FlipList({
  flips,
  kind,
  nameFor,
}: {
  flips?: Record<string, FlipEntry>;
  kind: 'COIN' | 'DICE';
  nameFor: (id: string) => string;
}) {
  const entries = Object.entries(flips ?? {})
    .filter(([, f]) => f.kind === kind)
    .sort((a, b) => b[1].at.localeCompare(a[1].at));
  if (entries.length === 0) return null;
  return (
    <div className="w-full flex flex-col gap-1.5 mt-2 border-t border-white/5 pt-3">
      {entries.map(([userId, f]) => (
        <div key={userId} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-white/40 truncate">{nameFor(userId)}</span>
          <span className="text-primary">{f.result}</span>
        </div>
      ))}
    </div>
  );
}

// ── COIN FLIPPER (shared) ────────────────────────────────────────────────────

function CoinFlipper({
  flips,
  canFlip,
  onFlip,
  nameFor,
}: {
  flips?: Record<string, FlipEntry>;
  canFlip: boolean;
  onFlip: () => void;
  nameFor: (id: string) => string;
}) {
  const [flipping, setFlipping] = useState(false);

  const doFlip = async () => {
    if (!canFlip || flipping) return;
    setFlipping(true);
    await onFlip();
    // Brief spin regardless of latency; the result comes from the broadcast.
    setTimeout(() => setFlipping(false), 700);
  };

  // The newest coin result, whoever threw it — the coin shows what it landed on
  // rather than a currency symbol, which is what a `$` on the face made it look
  // like: a money button, not a coin, and it never changed when the coin did.
  const latest = Object.values(flips ?? {})
    .filter((f) => f.kind === 'COIN')
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const face = flipping ? '' : latest?.result?.toUpperCase() === 'HEADS' ? 'H' : latest?.result?.toUpperCase() === 'TAILS' ? 'T' : '';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[220px]">
      <button
        onClick={doFlip}
        disabled={!canFlip}
        aria-label={latest ? `Coin — last flip ${latest.result}. Flip again` : 'Flip the coin'}
        className={`relative w-20 h-20 rounded-full border-[4px] border-primary bg-black flex items-center justify-center shadow-[0_0_20px_rgba(82,185,70,0.3)] transition-transform ${
          canFlip ? 'hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'
        } ${flipping ? 'animate-[spin-y_0.2s_linear_infinite]' : ''}`}
      >
        {face ? (
          <span className="text-3xl font-black text-primary leading-none">{face}</span>
        ) : (
          /* Nothing thrown yet: a struck ring reads as a coin edge-on, where a
             letter would read as a result nobody has produced. */
          <span aria-hidden className="w-7 h-7 rounded-full border-2 border-primary/50" />
        )}
      </button>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/40 h-3">
        {flipping
          ? 'FLIPPING…'
          : latest
            ? latest.result?.toUpperCase()
            : canFlip
              ? 'TAP TO FLIP'
              : 'VIEW ONLY'}
      </span>
      <FlipList flips={flips} kind="COIN" nameFor={nameFor} />
      <style>{`@keyframes spin-y { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }`}</style>
    </div>
  );
}

// ── DICE ROLLER (shared) ─────────────────────────────────────────────────────

function DiceRoller({
  flips,
  canRoll,
  onRoll,
  nameFor,
}: {
  flips?: Record<string, FlipEntry>;
  canRoll: boolean;
  onRoll: (sides: number, count?: number) => void;
  nameFor: (id: string) => string;
}) {
  const [rolling, setRolling] = useState(false);
  const [customSides, setCustomSides] = useState('20');

  const roll = async (sides: number) => {
    if (!canRoll || rolling || sides < 2) return;
    setRolling(true);
    await onRoll(sides, 1);
    setTimeout(() => setRolling(false), 500);
  };

  const presets = [6, 12, 20];
  const otherPresets = [4, 8, 10];

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[240px]">
      <div className="flex gap-2 w-full">
        {presets.map((sides) => (
          <button
            key={sides}
            onClick={() => roll(sides)}
            disabled={!canRoll || rolling}
            className="flex-1 py-3 border border-white/10 text-white/40 hover:border-white/30 hover:text-white transition-all text-[10px] font-black tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            D{sides}
          </button>
        ))}
      </div>
      <div className="flex gap-2 w-full">
        {otherPresets.map((sides) => (
          <button
            key={sides}
            onClick={() => roll(sides)}
            disabled={!canRoll || rolling}
            className="flex-1 py-2 border border-white/10 text-white/40 hover:border-white/30 hover:text-white transition-all text-[9px] font-black tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            D{sides}
          </button>
        ))}
      </div>
      <div className="flex gap-2 w-full">
        <div className="flex-1 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/30">D</span>
          <input
            type="number"
            min="2"
            value={customSides}
            onChange={(e) => setCustomSides(e.target.value)}
            disabled={!canRoll || rolling}
            className="w-full bg-black border border-white/10 text-white text-center text-[10px] font-black py-2 outline-none focus:border-primary/50 transition-all disabled:opacity-40"
          />
        </div>
        <button
          onClick={() => { const p = parseInt(customSides); if (!isNaN(p) && p >= 2) roll(p); }}
          disabled={!canRoll || rolling}
          className="px-4 border border-white/10 hover:border-primary hover:text-primary text-white/40 transition-all text-[9px] font-black tracking-widest disabled:opacity-40 bg-white/5"
        >
          ROLL
        </button>
      </div>
      {!canRoll && (
        <span className="text-[9px] font-black uppercase tracking-widest text-white/20">VIEW ONLY</span>
      )}
      <FlipList flips={flips} kind="DICE" nameFor={nameFor} />
    </div>
  );
}

// ── MINI CALCULATOR (local) ──────────────────────────────────────────────────

function MiniCalculator() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleInput = (val: string) => {
    setHasError(false);
    if (val === 'C') { setDisplay('0'); setExpression(''); return; }
    if (val === '=') {
      try {
        const sanitized = expression.replace(/[^0-9+\-*/.]/g, '');
        if (!sanitized) return;
        const result = new Function('return ' + sanitized)();
        if (!isFinite(result)) throw new Error('Math Error');
        setDisplay(String(result));
        setExpression(String(result));
      } catch {
        setDisplay('ERR');
        setHasError(true);
        setExpression('');
      }
      return;
    }
    if (['+', '-', '*', '/'].includes(val)) {
      setExpression((prev) => prev + val);
      setDisplay('0');
    } else {
      setExpression((prev) => prev + val);
      setDisplay((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const btnClass = "bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all text-xs font-black py-3 active:scale-95";

  return (
    <div className="w-full max-w-[240px] flex flex-col gap-2">
      <div className="w-full p-3 bg-black border border-white/10 flex flex-col justify-end items-end min-h-[64px] relative overflow-hidden">
        <span className="text-[8px] font-black text-white/30 tracking-widest uppercase mb-1 truncate w-full text-right h-3">{expression}</span>
        <span className={`text-2xl font-black tabular-nums tracking-tighter truncate w-full text-right ${hasError ? 'text-red-500' : 'text-white'}`}>{display}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button className={`${btnClass} col-span-2 !text-red-400 !border-red-500/20`} onClick={() => handleInput('C')}>CLR</button>
        <button className={`${btnClass} !bg-white/10`} onClick={() => handleInput('/')}>/</button>
        <button className={`${btnClass} !bg-white/10`} onClick={() => handleInput('*')}>×</button>
        <button className={btnClass} onClick={() => handleInput('7')}>7</button>
        <button className={btnClass} onClick={() => handleInput('8')}>8</button>
        <button className={btnClass} onClick={() => handleInput('9')}>9</button>
        <button className={`${btnClass} !bg-white/10`} onClick={() => handleInput('-')}>−</button>
        <button className={btnClass} onClick={() => handleInput('4')}>4</button>
        <button className={btnClass} onClick={() => handleInput('5')}>5</button>
        <button className={btnClass} onClick={() => handleInput('6')}>6</button>
        <button className={`${btnClass} !bg-white/10`} onClick={() => handleInput('+')}>+</button>
        <button className={btnClass} onClick={() => handleInput('1')}>1</button>
        <button className={btnClass} onClick={() => handleInput('2')}>2</button>
        <button className={btnClass} onClick={() => handleInput('3')}>3</button>
        <button className={`${btnClass} row-span-2 !bg-primary/20 !border-primary/40 !text-primary`} onClick={() => handleInput('=')}>=</button>
        <button className={`${btnClass} col-span-2`} onClick={() => handleInput('0')}>0</button>
        <button className={btnClass} onClick={() => handleInput('.')}>.</button>
      </div>
    </div>
  );
}

// ── MATCH TIMER (shared, organizer-controlled) ───────────────────────────────

function MatchTimer({
  timer,
  canControl,
  onAction,
}: {
  timer?: UtilityState['timer'];
  canControl: boolean;
  onAction: (action: string, durationSec?: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = !!timer?.running;

  // Tick locally while running so the synced countdown is smooth; the authority
  // is `endsAt`, so every viewer shows the same remaining time.
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [running]);

  const endsAtMs = timer?.endsAt ? new Date(timer.endsAt).getTime() : null;
  const remaining = running && endsAtMs
    ? Math.max(0, Math.round((endsAtMs - now) / 1000))
    : (timer?.pausedRemainingSec ?? timer?.durationSec ?? 0);

  const format = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[240px]">
      {canControl && (
        <div className="flex gap-2 w-full">
          {[5, 15, 40, 50].map((mins) => (
            <button
              key={mins}
              onClick={() => onAction('set', mins * 60)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black tracking-widest text-white/50 hover:text-white transition-all"
            >
              {mins}M
            </button>
          ))}
        </div>
      )}

      <div className={`w-full h-24 border-2 flex items-center justify-center shadow-inner relative overflow-hidden transition-all ${remaining === 0 && (endsAtMs || timer?.pausedRemainingSec === 0) ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-black'}`}>
        {remaining === 0 && running && <div className="absolute inset-0 bg-red-500/20 animate-pulse" />}
        <span className={`text-5xl font-black tabular-nums tracking-tighter ${remaining === 0 && running ? 'text-red-500 animate-pulse' : remaining <= 60 && remaining > 0 ? 'text-amber-500' : 'text-white'}`}>
          {format(remaining)}
        </span>
      </div>

      {canControl ? (
        <div className="flex gap-2 w-full">
          <button
            onClick={() => onAction(running ? 'pause' : 'start')}
            className={`flex-[2] py-4 border ${running ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 'border-primary text-primary bg-primary/10 hover:bg-primary/20'} transition-all text-xs font-black tracking-widest uppercase shadow-lg`}
          >
            {running ? 'PAUSE' : 'START'}
          </button>
          <button
            onClick={() => onAction('reset')}
            className="flex-1 py-4 bg-white/5 border border-white/10 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 text-white/40 transition-all text-[10px] font-black tracking-widest uppercase"
          >
            RESET
          </button>
        </div>
      ) : (
        <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
          {running ? 'MATCH CLOCK RUNNING' : 'ORGANIZER-CONTROLLED'}
        </span>
      )}
    </div>
  );
}
