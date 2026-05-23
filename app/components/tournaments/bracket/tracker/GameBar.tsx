'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { GameTrackingMode } from '../../../../tournaments/types';

interface GameBarProps {
  mode: GameTrackingMode;
  currentValue: number;
  maxValue: number;
  label: string;
  side: 'left' | 'right';
  isUpdating?: boolean;
}

function getBarColor(mode: GameTrackingMode, current: number, max: number): string {
  if (mode === 'POINTS') return '#52B946';
  const pct = max > 0 ? current / max : 0;
  if (pct >= 0.5) return '#52B946';
  if (pct >= 0.25) return '#f59e0b';
  return '#ef4444';
}

export default function GameBar({ mode, currentValue, maxValue, label, side, isUpdating }: GameBarProps) {
  const pct = maxValue > 0 ? Math.min(currentValue / maxValue, 1) : 0;
  const fillPct = mode === 'HP' ? pct : pct;          // HP depletes → fill = remaining. Points fill → fill = accumulated.
  const barColor = getBarColor(mode, currentValue, maxValue);
  const isRight = side === 'right';

  return (
    <div className={`flex flex-col gap-2 ${isRight ? 'items-end' : 'items-start'} ${isUpdating ? 'opacity-50' : ''}`}>
      {/* Label */}
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
        {label}
      </span>

      {/* Value display */}
      <div className={`flex items-baseline gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <motion.span
          key={currentValue}
          initial={{ scale: 1.3, color: barColor }}
          animate={{ scale: 1, color: '#ffffff' }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="text-5xl font-black tabular-nums leading-none"
          style={{ color: barColor }}
        >
          {currentValue}
        </motion.span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-4 bg-white/5 border border-white/10 relative overflow-hidden"
        style={{ direction: isRight ? 'rtl' : 'ltr' }}
      >
        <motion.div
          className="h-full"
          style={{ backgroundColor: barColor }}
          initial={false}
          animate={{ width: `${fillPct * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {/* Critical flash overlay at low HP */}
        {mode === 'HP' && pct < 0.25 && (
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: '#ef4444' }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* Mode label */}
      <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
        {mode === 'HP' ? 'HP REMAINING' : 'PTS SCORED'}
      </span>
    </div>
  );
}
