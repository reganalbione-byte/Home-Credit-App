import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ParticleCanvas from './components/ParticleCanvas';
import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import CustomCursor from './components/CustomCursor';
import AIChat from './components/AIChat';
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
  voidApplication,
  type Application,
  type SystemUser,
} from './lib/data';
import {
  loadApplications,
  seedIfEmpty,
  insertApplication,
  upsertApplication,
  resetApplications,
  subscribeApplications,
} from './lib/cloudStore';
import { isCloudEnabled } from './lib/supabase';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

// ID nasabah berikutnya = C + (angka id terbesar + 1), zero-padded 3 digit.
function nextAppId(apps: Application[]): string {
  const max = apps.reduce((m, a) => {
    const n = parseInt(a.id.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `C${String(max + 1).padStart(3, '0')}`;
}

const PAGES = ['cover', 'form', 'result', 'portfolio', 'report'];

type Theme = 'dark' | 'light';

function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudLoaded, setCloudLoaded] = useState(!isCloudEnabled);
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

  // Muat data dari cloud (Supabase) + langganan perubahan realtime, sehingga data
  // yang diinput di satu perangkat langsung muncul di perangkat lain (mis. laptop dosen).
  // Kalau env Supabase belum di-set, semua fungsi ini no-op → app pakai data in-memory.
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadApplications().then(apps => { if (alive) { setApplications(apps); setCloudLoaded(true); } });
    };
    seedIfEmpty().then(refresh);
    const unsubscribe = subscribeApplications(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);

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

  // Scroll wheel sengaja TIDAK dipakai untuk pindah halaman.
  // Wheel = scroll konten atas/bawah (native) di dalam tiap section (overflow-y-auto).
  // Pindah halaman lewat klik: nav bar, dot indicator, tombol di section, panah kiri/kanan.

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
      // Hanya panah kiri/kanan untuk pindah halaman. Panah atas/bawah dibiarkan
      // untuk scroll konten secara native.
      if (e.key === 'ArrowRight') goToPage(Math.min(currentPage + 1, PAGES.length - 1));
      else if (e.key === 'ArrowLeft') goToPage(Math.max(currentPage - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, goToPage]);

  const handleResult = useCallback((result: any) => { setLastResult(result); }, []);
  const handleAddToPortfolio = useCallback(async () => {
    if (!lastResult) return;
    const newApp = buildApplicationFromForm({
      id: nextAppId(applications),
      name: lastResult.name,
      income: lastResult.income,
      loan: lastResult.loan,
      purpose: lastResult.purpose,
      empYears: lastResult.empYears,
      extScore: lastResult.extScore,
      date: lastResult.date,
      createdBy: currentUserId,
    });
    setApplications(prev => [...prev, newApp]);  // optimistic — langsung tampil
    const res = await insertApplication(newApp); // simpan ke cloud → sync realtime
    if (res.ok) {
      toast.success(`${newApp.name} ditambahkan ke portfolio (${newApp.id})`);
    } else {
      toast.error('Gagal menyimpan ke cloud — memuat ulang data.');
      setApplications(await loadApplications());  // rollback ke kondisi server
    }
  }, [lastResult, applications, currentUserId]);

  const handleManualReviewDecision = useCallback(
    async (appId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => {
      const target = applications.find(a => a.id === appId);
      if (!target) return;
      const updated = manualReviewDecision(target, decision, currentUserId, notes);
      setApplications(prev => prev.map(a => (a.id === appId ? updated : a)));  // optimistic
      const res = await upsertApplication(updated);                            // simpan ke cloud
      if (res.ok) toast.success(`${updated.name}: ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'}`);
      else toast.error('Gagal menyimpan keputusan ke cloud.');
    },
    [applications, currentUserId]
  );

  const handleVoidApplication = useCallback(
    async (appId: string, reason: string) => {
      const target = applications.find(a => a.id === appId);
      if (!target) return;
      const updated = voidApplication(target, currentUserId, reason);
      setApplications(prev => prev.map(a => (a.id === appId ? updated : a)));  // optimistic
      const res = await upsertApplication(updated);
      if (res.ok) toast.success(`${updated.name} (${updated.id}) di-void`);
      else toast.error('Gagal void ke cloud.');
    },
    [applications, currentUserId]
  );

  const handleResetData = useCallback(async () => {
    setApplications(INITIAL_APPLICATIONS.map(a => ({ ...a })));  // optimistic / mode lokal
    const res = await resetApplications();                       // cloud: hapus + seed ulang
    if (res.ok) toast.success('Data direset ke 10 nasabah awal.');
    else toast.error('Reset cloud gagal — cek koneksi Supabase.');
  }, []);

  const pageStyle = (i: number) => ({
    transform: i !== 0 ? 'translateX(100vw)' : undefined,
    opacity: i !== 0 ? 0 : 1,
    pointerEvents: i !== 0 ? ('none' as const) : ('auto' as const),
    zIndex: currentPage === i ? 10 : 1,
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden app-shell" style={{ background: 'var(--app-bg)' }}>
      <ParticleCanvas />
      <CustomCursor />
      <Toaster theme={theme} position="top-center" richColors closeButton />
      {!isLoading && isCloudEnabled && !cloudLoaded && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#6366F1]/40 border-t-transparent animate-spin" />
            <span className="text-sm" style={{ color: 'var(--app-text-dim)' }}>Menyinkronkan data dari cloud…</span>
          </div>
        </div>
      )}
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
            className={`absolute top-0 left-0 w-full h-full ${currentPage === i ? 'page-active' : 'page-inactive'}`}
            style={pageStyle(i)}>
            {i === 0 && <CoverSpread isActive={!isLoading && currentPage === 0} onEnterGallery={() => goToPage(1)} onResetData={handleResetData} applications={applications} />}
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
                onVoidApplication={handleVoidApplication}
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
        <AIChat applications={applications} currentUser={currentUser} currentPage={currentPage} theme={theme} />
      )}

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
