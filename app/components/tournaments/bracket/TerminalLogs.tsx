const MaximizeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
  </svg>
);

interface LogEntry { id: string; action: string; details?: string; timestamp: string; }
interface Props { logs: LogEntry[]; onMaximize: () => void; }

export default function TerminalLogs({ logs, onMaximize }: Props) {
  return (
    <div className="bg-foreground/5 border border-foreground/5 p-8 rounded-[3rem]">
      <div className="flex justify-between items-center mb-6 border-b border-foreground/10 pb-4">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.4em] font-poppins">Terminal Logs</h3>
        <button onClick={onMaximize} className="p-2 hover:bg-primary/10 rounded-lg text-foreground/20 hover:text-primary transition-all" title="MAXIMIZE">
          <MaximizeIcon />
        </button>
      </div>
      <div className="bg-background rounded-2xl p-6 h-64 overflow-y-auto no-scrollbar font-mono text-[11px] border border-foreground/5">
        {logs.length === 0 ? (
          <p className="text-foreground/10 uppercase font-black tracking-widest">NO LOGS RECEIVED</p>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="flex gap-6 border-b border-foreground/5 pb-3 last:border-0 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-foreground/20 shrink-0 font-black">[{log.timestamp}]</span>
                <span className="text-primary font-black uppercase tracking-widest">{log.action}</span>
                {log.details && <span className="text-foreground/40 tracking-wider truncate">/ {log.details}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
