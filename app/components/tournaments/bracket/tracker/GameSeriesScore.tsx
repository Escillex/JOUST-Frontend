'use client';
import { motion } from 'framer-motion';

interface GameSeriesScoreProps {
  player1Wins: number;
  player2Wins: number;
  winsNeeded: number;
  player1Name: string;
  player2Name: string;
}

function WinPips({ wins, total, reverse }: { wins: number; total: number; reverse?: boolean }) {
  const pips = Array.from({ length: total });
  return (
    <div className={`flex gap-1 ${reverse ? 'flex-row-reverse' : 'flex-row'}`}>
      {pips.map((_, i) => (
        <motion.div
          key={i}
          className="w-2 h-2 border border-white/20"
          animate={{
            // rgba(...,0), NOT 'transparent': Framer resolves the initial to
            // "rgba(0,0,0,0)" and cannot interpolate that against the keyword
            // 'transparent' (it warns "not an animatable value"). A zero-alpha
            // rgba is the same colour and animates cleanly.
            backgroundColor: i < wins ? '#52B946' : 'rgba(82,185,70,0)',
            borderColor: i < wins ? '#52B946' : 'rgba(255,255,255,0.2)',
            // A transparent zero-spread shadow, NOT 'none': Framer can't
            // interpolate a shadow string against the keyword 'none' (it warns
            // "not an animatable value"), but it happily fades between two real
            // shadow strings — so the glow animates cleanly on/off.
            boxShadow: i < wins ? '0 0 6px rgba(82,185,70,0.6)' : '0 0 0px rgba(82,185,70,0)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}
    </div>
  );
}

export default function GameSeriesScore({
  player1Wins,
  player2Wins,
  winsNeeded,
  player1Name,
  player2Name,
}: GameSeriesScoreProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 border-y border-white/5">
      {/* Player labels. Capped at a share of the row rather than a flat 100px:
          at 9px with 0.3em tracking that fitted about eleven characters, so
          "Cy Nakamura P902" read as "CY NAKAMU…" in the middle of a 700px
          drawer with the space to spell it out twice over. */}
      <div className="w-full flex justify-between gap-4 px-2">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 truncate min-w-0 flex-1">
          {player1Name}
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 truncate min-w-0 flex-1 text-right">
          {player2Name}
        </span>
      </div>

      {/* Main score display */}
      <div className="flex items-center gap-6">
        <motion.span
          key={`p1-${player1Wins}`}
          initial={{ scale: 1.6, color: '#52B946' }}
          animate={{ scale: 1, color: '#ffffff' }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="text-7xl font-black tabular-nums leading-none"
        >
          {player1Wins}
        </motion.span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-black text-white/15 uppercase tracking-widest">vs</span>
          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
            FT{winsNeeded}
          </span>
        </div>

        <motion.span
          key={`p2-${player2Wins}`}
          initial={{ scale: 1.6, color: '#52B946' }}
          animate={{ scale: 1, color: '#ffffff' }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="text-7xl font-black tabular-nums leading-none"
        >
          {player2Wins}
        </motion.span>
      </div>

      {/* Win pips */}
      <div className="flex items-center gap-6">
        <WinPips wins={player1Wins} total={winsNeeded} />
        <div className="w-4" />
        <WinPips wins={player2Wins} total={winsNeeded} reverse />
      </div>
    </div>
  );
}
