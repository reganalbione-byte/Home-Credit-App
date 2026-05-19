import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
    let animId: number;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = mouseX + 'px';
        dotRef.current.style.top = mouseY + 'px';
      }
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const animate = () => {
      ringX = lerp(ringX, mouseX, 0.12);
      ringY = lerp(ringY, mouseY, 0.12);
      if (ringRef.current) {
        ringRef.current.style.left = ringX + 'px';
        ringRef.current.style.top = ringY + 'px';
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    const onEnter = () => { if (ringRef.current) ringRef.current.style.transform = 'translate(-50%,-50%) scale(1.8)'; };
    const onLeave = () => { if (ringRef.current) ringRef.current.style.transform = 'translate(-50%,-50%) scale(1)'; };
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="pointer-events-none fixed z-[9999] w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)', transition: 'none' }} />
      <div ref={ringRef} className="pointer-events-none fixed z-[9998] w-8 h-8 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{ border: '1.5px solid rgba(99,102,241,0.5)', transition: 'transform 0.2s ease' }} />
    </>
  );
}
