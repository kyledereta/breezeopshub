import { useState, useEffect } from "react";

function FlipDigit({ digit, label }: { digit: string; label?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-7 h-9 bg-foreground/90 rounded-md overflow-hidden shadow-md">
        {/* Top half */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-foreground/95 border-b border-background/10 flex items-end justify-center overflow-hidden">
          <span className="text-background font-mono text-lg font-bold leading-none translate-y-[55%]">
            {digit}
          </span>
        </div>
        {/* Bottom half */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-foreground/85 flex items-start justify-center overflow-hidden">
          <span className="text-background font-mono text-lg font-bold leading-none -translate-y-[45%]">
            {digit}
          </span>
        </div>
        {/* Center line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-background/20" />
      </div>
      {label && (
        <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">
          {label}
        </span>
      )}
    </div>
  );
}

export function FlipClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const rawHours = time.getHours();
  const ampm = rawHours >= 12 ? "PM" : "AM";
  const h12 = (rawHours % 12 || 12).toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-0.5">
      <div className="flex gap-0.5">
        <FlipDigit digit={h12[0]} />
        <FlipDigit digit={h12[1]} />
      </div>
      <span className="text-foreground/60 font-mono text-sm font-bold mx-px animate-pulse">:</span>
      <div className="flex gap-0.5">
        <FlipDigit digit={minutes[0]} />
        <FlipDigit digit={minutes[1]} />
      </div>
      <span className="text-foreground/60 font-mono text-sm font-bold mx-px animate-pulse">:</span>
      <div className="flex gap-0.5">
        <FlipDigit digit={seconds[0]} />
        <FlipDigit digit={seconds[1]} />
      </div>
      <span className="text-foreground/70 font-mono text-[10px] font-bold ml-1">{ampm}</span>
    </div>
  );
}
