import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface LoadingScreenProps { onComplete: () => void; }

const STEPS = [
  'Initializing system...',
  'Loading credit models...',
  'Connecting to data sources...',
  'Preparing dashboard...',
];

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 18 + 5;
      if (prog >= 100) { prog = 100; clearInterval(interval); }
      setProgress(Math.min(prog, 100));
      setStepIndex(Math.min(Math.floor(prog / 25), STEPS.length - 1));
    }, 200);

    const timer = setTimeout(() => {
      gsap.to(overlayRef.current, {
        opacity: 0, duration: 0.6, ease: 'power2.out',
        onComplete,
      });
    }, 2200);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [onComplete]);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'var(--loading-gradient)' }}>
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold tracking-wide" style={{ color: 'var(--app-text-strong)' }}>CreditRisk AIS</div>
            <div className="text-xs tracking-widest uppercase" style={{ color: 'var(--app-text-dim)' }}>Home Credit Indonesia</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-64 mb-6">
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--divider)' }}>
          <div ref={barRef} className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#3B82F6,#6366F1)' }} />
        </div>
      </div>

      {/* Step text */}
      <p className="text-sm tracking-wider" style={{ color: 'var(--app-text-dim)' }}>{STEPS[stepIndex]}</p>
    </div>
  );
}
