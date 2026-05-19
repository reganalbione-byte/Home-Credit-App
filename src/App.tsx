import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ParticleCanvas from './components/ParticleCanvas';
import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import CustomCursor from './components/CustomCursor';
import CoverSpread from './sections/CoverSpread';
import FeaturedArtifacts from './sections/FeaturedArtifacts';
import HistorySpread from './sections/HistorySpread';
import WorldInside from './sections/WorldInside';
import VisitExplore from './sections/VisitExplore';
import {
  INITIAL_APPLICATIONS,
  USERS,
  buildApplicationFromForm,
  manualReviewDecision,
  type Application,
  type SystemUser,
} from './lib/data';

const PAGES = ['cover', 'form', 'result', 'portfolio', 'report'];

type Theme = 'dark' | 'light';

function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [lastResult, setLastResult] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    return stored === 'light' ? 'light' : 'dark';
  });
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUserId') : null;
    return stored && USERS[stored] ? stored : 'OFC-001';
  });
  const currentUser: SystemUser = USERS[currentUserId] ?? USERS['OFC-001'];
  const isTransitioning = useRef(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('currentUserId', currentUserId);
  }, [currentUserId]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const goToPage = useCallback((targetPage: number) => {
    if (isTransitioning.current || targetPage === currentPage) return;
    if (targetPage < 0 || targetPage >= PAGES.length) return;

    isTransitioning.current = true;
    const direction = targetPage > currentPage ? 1 : -1;
    const currentEl = pageRefs.current[currentPage];
    const targetEl = pageRefs.current[targetPage];

    if (currentEl && targetEl) {
      gsap.set(targetEl, { x: direction * 100 + 'vw', opacity: 1, pointerEvents: 'auto', position: 'absolute', top: 0, left: 0 });
      const tl = gsap.timeline({ onComplete: () => { setCurrentPage(targetPage); isTransitioning.current = false; } });
      tl.to(currentEl, { x: -direction * 100 + 'vw', duration: 0.75, ease: 'power3.inOut' }, 0);
      tl.to(targetEl, { x: '0vw', duration: 0.75, ease: 'power3.inOut' }, 0);
    } else {
      setCurrentPage(targetPage); isTransitioning.current = false;
    }
  }, [currentPage]);

  // Wheel navigation
  useEffect(() => {
    let acc = 0;
    const threshold = 80;
    let resetTimer: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isTransitioning.current) return;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (acc > threshold) { acc = 0; goToPage(Math.min(currentPage + 1, PAGES.length - 1)); }
      else if (acc < -threshold) { acc = 0; goToPage(Math.max(currentPage - 1, 0)); }
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { acc = 0; }, 200);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => { window.removeEventListener('wheel', onWheel); clearTimeout(resetTimer); };
  }, [currentPage, goToPage]);

  // Touch
  useEffect(() => {
    let sx = 0, sy = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (isTransitioning.current) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        goToPage(dx < 0 ? Math.min(currentPage + 1, PAGES.length - 1) : Math.max(currentPage - 1, 0));
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [currentPage, goToPage]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTransitioning.current) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(Math.min(currentPage + 1, PAGES.length - 1));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(Math.max(currentPage - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, goToPage]);

  const handleResult = useCallback((result: any) => { setLastResult(result); }, []);
  const handleAddToPortfolio = useCallback(() => {
    if (!lastResult) return;
    const newApp = buildApplicationFromForm({
      id: `C${String(applications.length + 1).padStart(3, '0')}`,
      name: lastResult.name,
      income: lastResult.income,
      loan: lastResult.loan,
      purpose: lastResult.purpose,
      empYears: lastResult.empYears,
      extScore: lastResult.extScore,
      date: lastResult.date,
      createdBy: currentUserId,
    });
    setApplications(prev => [...prev, newApp]);
  }, [lastResult, applications.length, currentUserId]);

  const handleManualReviewDecision = useCallback(
    (appId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => {
      setApplications(prev =>
        prev.map(a => (a.id === appId ? manualReviewDecision(a, decision, currentUserId, notes) : a))
      );
    },
    [currentUserId]
  );

  const pageStyle = (i: number) => ({
    transform: i !== 0 ? 'translateX(100vw)' : undefined,
    opacity: i !== 0 ? 0 : 1,
    pointerEvents: i !== 0 ? ('none' as const) : ('auto' as const),
    zIndex: currentPage === i ? 10 : 1,
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <ParticleCanvas />
      <CustomCursor />
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      {!isLoading && (
        <Navigation
          activePage={currentPage}
          onNavigate={goToPage}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentUser={currentUser}
          onChangeUser={setCurrentUserId}
        />
      )}

      <div className="relative w-full h-full">
        {[CoverSpread, FeaturedArtifacts, HistorySpread, WorldInside, VisitExplore].map((_Component, i) => (
          <div key={i} ref={el => { pageRefs.current[i] = el; }}
            className="absolute top-0 left-0 w-full h-full"
            style={pageStyle(i)}>
            {i === 0 && <CoverSpread isActive={!isLoading && currentPage === 0} onEnterGallery={() => goToPage(1)} />}
            {i === 1 && (
              <FeaturedArtifacts
                isActive={!isLoading && currentPage === 1}
                onResult={handleResult}
                onNavigateToResult={() => goToPage(2)}
                currentUser={currentUser}
              />
            )}
            {i === 2 && (
              <HistorySpread
                isActive={!isLoading && currentPage === 2}
                result={lastResult}
                onNewApplication={() => goToPage(1)}
                onAddToPortfolio={handleAddToPortfolio}
                currentUser={currentUser}
              />
            )}
            {i === 3 && (
              <WorldInside
                isActive={!isLoading && currentPage === 3}
                applications={applications}
                currentUser={currentUser}
                onManualReviewDecision={handleManualReviewDecision}
              />
            )}
            {i === 4 && (
              <VisitExplore
                isActive={!isLoading && currentPage === 4}
                applications={applications}
                currentUser={currentUser}
              />
            )}
          </div>
        ))}
      </div>

      {!isLoading && (
        <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2.5 no-print">
          {PAGES.map((_, i) => (
            <button key={i} onClick={() => goToPage(i)}
              className="w-1.5 h-1.5 rounded-full border-none cursor-pointer transition-all duration-300"
              style={{ background: i === currentPage ? 'var(--accent-secondary)' : 'var(--dot-inactive)', transform: i === currentPage ? 'scale(1.5)' : 'scale(1)' }}
              aria-label={`Page ${i+1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
export default App;
