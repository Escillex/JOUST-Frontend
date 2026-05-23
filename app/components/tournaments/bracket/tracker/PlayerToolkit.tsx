'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'COIN' | 'DICE' | 'CALC' | 'TIMER';

export default function PlayerToolkit() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('COIN');

  return (
    <div className="w-full border border-white/10 bg-black mt-2 font-poppins text-white select-none">
      {/* Header Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Match Utilities</span>
        </div>
        <span className="text-white/40 text-xs font-black">{isOpen ? '−' : '+'}</span>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {(['COIN', 'DICE', 'CALC', 'TIMER'] as Tab[]).map((tab) => (
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
              ))}
            </div>

            {/* Tools Area */}
            <div className="p-4 bg-white/3 min-h-[220px] flex items-center justify-center">
              {activeTab === 'COIN' && <CoinFlipper />}
              {activeTab === 'DICE' && <DiceRoller />}
              {activeTab === 'CALC' && <MiniCalculator />}
              {activeTab === 'TIMER' && <MatchTimer />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── COIN FLIPPER ─────────────────────────────────────────────────────────────

function CoinFlipper() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<'HEADS' | 'TAILS' | null>(null);

  const flipCoin = () => {
    if (flipping) return;
    setFlipping(true);
    setResult(null);
    
    // Simulate flip delay
    setTimeout(() => {
      setResult(Math.random() > 0.5 ? 'HEADS' : 'TAILS');
      setFlipping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[200px]">
      <div 
        className="relative w-24 h-24 perspective-[1000px] cursor-pointer group"
        onClick={flipCoin}
      >
        <div 
          className={`w-full h-full relative preserve-3d transition-all duration-1000 ${flipping ? 'animate-[spin-y_0.2s_linear_infinite]' : ''}`}
          style={{ transform: result === 'TAILS' ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Heads side */}
          <div className="absolute inset-0 backface-hidden rounded-full border-[4px] border-primary bg-black flex items-center justify-center shadow-[0_0_20px_rgba(82,185,70,0.3)] group-hover:scale-105 transition-transform">
            <span className="text-2xl font-black text-primary">H</span>
          </div>
          {/* Tails side */}
          <div className="absolute inset-0 backface-hidden rounded-full border-[4px] border-amber-500 bg-black flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] [transform:rotateY(180deg)] group-hover:scale-105 transition-transform">
            <span className="text-2xl font-black text-amber-500">T</span>
          </div>
        </div>
      </div>
      
      <div className="h-8 flex items-center justify-center">
        {flipping ? (
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 animate-pulse">FLIPPING...</span>
        ) : result ? (
          <span className={`text-[12px] font-black uppercase tracking-[0.4em] ${result === 'HEADS' ? 'text-primary' : 'text-amber-500'}`}>
            {result}
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20">TAP COIN TO FLIP</span>
        )}
      </div>
      
      <style>{`
        .perspective-\\[1000px\\] { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        @keyframes spin-y { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
      `}</style>
    </div>
  );
}

// ── DICE ROLLER ──────────────────────────────────────────────────────────────

function DiceRoller() {
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  const [activeDie, setActiveDie] = useState<number>(6);
  const [customSides, setCustomSides] = useState<string>('100');
  const [showMore, setShowMore] = useState(false);
  const rollInterval = useRef<NodeJS.Timeout | null>(null);

  const rollDice = (sides: number) => {
    if (rolling || sides < 2) return;
    setActiveDie(sides);
    setRolling(true);
    
    let ticks = 0;
    rollInterval.current = setInterval(() => {
      setValue(Math.floor(Math.random() * sides) + 1);
      ticks++;
      if (ticks > 15) {
        if (rollInterval.current) clearInterval(rollInterval.current);
        setValue(Math.floor(Math.random() * sides) + 1);
        setRolling(false);
      }
    }, 50);
  };

  useEffect(() => {
    return () => { if (rollInterval.current) clearInterval(rollInterval.current); };
  }, []);

  const popularPresets = [6, 12, 20];
  const otherPresets = [4, 8, 10];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[240px]">
      {/* Result Screen */}
      <div className="w-full h-20 border-2 border-white/10 bg-black flex items-center justify-center shadow-inner relative overflow-hidden">
        {rolling && <div className="absolute inset-0 bg-primary/10 animate-pulse" />}
        <span className={`text-5xl font-black ${rolling ? 'text-white/50 blur-[1px]' : value ? 'text-white' : 'text-white/10'} transition-all`}>
          {value || '?'}
        </span>
      </div>

      {/* Popular Presets */}
      <div className="flex gap-2 w-full">
        {popularPresets.map(sides => (
          <button 
            key={sides}
            onClick={() => rollDice(sides)}
            disabled={rolling}
            className={`flex-1 py-3 border ${activeDie === sides && value && !rolling ? 'border-primary text-primary bg-primary/10 shadow-[0_0_10px_rgba(82,185,70,0.15)]' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white'} transition-all text-[10px] font-black tracking-widest disabled:opacity-50`}
          >
            D{sides}
          </button>
        ))}
      </div>

      {/* More Button */}
      <button 
        onClick={() => setShowMore(!showMore)}
        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 transition-all flex justify-center items-center gap-2"
      >
        {showMore ? 'HIDE OPTIONS' : 'MORE DICE'}
        <span className="text-white/20">{showMore ? '▲' : '▼'}</span>
      </button>

      {/* Extra Dice Dropdown */}
      <AnimatePresence>
        {showMore && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full overflow-hidden flex flex-col gap-2 border-t border-white/5 pt-2"
          >
            <div className="flex gap-2 w-full">
              {otherPresets.map(sides => (
                <button 
                  key={sides}
                  onClick={() => rollDice(sides)}
                  disabled={rolling}
                  className={`flex-1 py-2 border ${activeDie === sides && value && !rolling ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white'} transition-all text-[9px] font-black tracking-widest disabled:opacity-50`}
                >
                  D{sides}
                </button>
              ))}
            </div>

            {/* Custom Roll */}
            <div className="flex gap-2 w-full mt-1">
              <div className="flex-1 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/30">D</span>
                <input 
                  type="number" 
                  min="2"
                  value={customSides}
                  onChange={(e) => setCustomSides(e.target.value)}
                  disabled={rolling}
                  className="w-full bg-black border border-white/10 text-white text-center text-[10px] font-black py-2 outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                />
              </div>
              <button 
                onClick={() => {
                  const parsed = parseInt(customSides);
                  if (!isNaN(parsed) && parsed >= 2) rollDice(parsed);
                }}
                disabled={rolling}
                className="px-4 border border-white/10 hover:border-primary hover:text-primary text-white/40 transition-all text-[9px] font-black tracking-widest disabled:opacity-50 bg-white/5"
              >
                ROLL
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MINI CALCULATOR ──────────────────────────────────────────────────────────

function MiniCalculator() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleInput = (val: string) => {
    setHasError(false);
    if (val === 'C') { setDisplay('0'); setExpression(''); return; }
    if (val === '=') {
      try {
        // Safe evaluation of simple math
        const sanitized = expression.replace(/[^0-9+\-*/.]/g, '');
        if (!sanitized) return;
        // eslint-disable-next-line no-new-func
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
      setExpression(prev => prev + val);
      setDisplay('0');
    } else {
      setExpression(prev => prev + val);
      setDisplay(prev => prev === '0' ? val : prev + val);
    }
  };

  const btnClass = "bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all text-xs font-black py-3 active:scale-95";

  return (
    <div className="w-full max-w-[240px] flex flex-col gap-2">
      {/* Screen */}
      <div className="w-full p-3 bg-black border border-white/10 flex flex-col justify-end items-end min-h-[64px] relative overflow-hidden">
        <span className="text-[8px] font-black text-white/30 tracking-widest uppercase mb-1 truncate w-full text-right h-3">
          {expression}
        </span>
        <span className={`text-2xl font-black tabular-nums tracking-tighter truncate w-full text-right ${hasError ? 'text-red-500' : 'text-white'}`}>
          {display}
        </span>
      </div>

      {/* Grid */}
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

// ── MATCH TIMER ──────────────────────────────────────────────────────────────

function MatchTimer() {
  const [timeLeft, setTimeLeft] = useState(3000); // Default 50 mins
  const [isRunning, setIsRunning] = useState(false);
  const [initialTime, setInitialTime] = useState(3000);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const setPreset = (minutes: number) => {
    const seconds = minutes * 60;
    setTimeLeft(seconds);
    setInitialTime(seconds);
    setIsRunning(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[240px]">
      {/* Presets */}
      <div className="flex gap-2 w-full">
        {[5, 15, 40, 50].map(mins => (
          <button 
            key={mins}
            onClick={() => setPreset(mins)}
            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black tracking-widest text-white/50 hover:text-white transition-all"
          >
            {mins}M
          </button>
        ))}
      </div>

      {/* Screen */}
      <div className={`w-full h-24 border-2 flex items-center justify-center shadow-inner relative overflow-hidden transition-all ${timeLeft === 0 ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-black'}`}>
        {timeLeft === 0 && <div className="absolute inset-0 bg-red-500/20 animate-pulse" />}
        <span className={`text-5xl font-black tabular-nums tracking-tighter ${timeLeft === 0 ? 'text-red-500 animate-pulse' : timeLeft <= 60 ? 'text-amber-500' : 'text-white'}`}>
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => setIsRunning(!isRunning)}
          disabled={timeLeft === 0}
          className={`flex-[2] py-4 border ${isRunning ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 'border-primary text-primary bg-primary/10 hover:bg-primary/20'} transition-all text-xs font-black tracking-widest uppercase disabled:opacity-50 shadow-lg`}
        >
          {isRunning ? 'PAUSE' : 'START'}
        </button>
        <button 
          onClick={() => { setTimeLeft(initialTime); setIsRunning(false); }}
          className="flex-1 py-4 bg-white/5 border border-white/10 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 text-white/40 transition-all text-[10px] font-black tracking-widest uppercase"
        >
          RESET
        </button>
      </div>
    </div>
  );
}
