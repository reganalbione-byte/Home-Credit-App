import { useEffect, useRef, useState } from 'react';
import { USERS, ROLE_LABELS, type SystemUser } from '../lib/data';

interface NavigationProps {
  activePage: number;
  onNavigate: (page: number) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentUser: SystemUser;
  onChangeUser: (userId: string) => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard', page: 0, icon: '⬡' },
  { label: 'New Application', page: 1, icon: '＋' },
  { label: 'Assessment', page: 2, icon: '◎' },
  { label: 'Portfolio', page: 3, icon: '▦' },
  { label: 'Financial Report', page: 4, icon: '≡' },
];

const ROLE_COLOR: Record<string, string> = {
  LOAN_OFFICER:   '#3B82F6',
  CREDIT_ANALYST: '#F59E0B',
  FINANCE:        '#10B981',
  AUDITOR:        '#a5b4fc',
};

export default function Navigation({ activePage, onNavigate, theme, onToggleTheme, currentUser, onChangeUser }: NavigationProps) {
  const [visible, setVisible] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [userOpen]);

  const userList = Object.values(USERS);

  return (
    <nav ref={navRef}
      className="fixed top-0 left-0 w-full h-16 flex items-center justify-between px-8 z-50 no-print"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: visible ? 'auto' : 'none',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--nav-border)',
      }}>
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold leading-none" style={{ color: 'var(--app-text)' }}>CreditRisk AIS</div>
          <div className="text-[10px] leading-none mt-0.5 tracking-widest uppercase" style={{ color: 'var(--app-text-dim)' }}>Home Credit Indonesia</div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button key={item.page} onClick={() => onNavigate(item.page)}
            className="relative px-4 py-2 rounded-lg text-xs font-medium tracking-wide cursor-pointer border-none"
            style={{
              background: activePage === item.page ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activePage === item.page ? 'var(--accent-soft)' : 'var(--app-text-dim)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (activePage !== item.page) (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
            onMouseLeave={e => { if (activePage !== item.page) (e.currentTarget as HTMLElement).style.color = 'var(--app-text-dim)'; }}>
            {activePage === item.page && (
              <span className="absolute bottom-0 left-4 right-4 h-px"
                style={{ background: 'linear-gradient(90deg,#3B82F6,#6366F1)' }} />
            )}
            {item.label}
          </button>
        ))}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
          <span className="text-xs tracking-wide" style={{ color: 'var(--app-text-dim)' }}>LIVE SYSTEM</span>
        </div>

        {/* Role / User switcher — IC-4 + IC-5 (SoD) */}
        <div ref={userMenuRef} className="relative">
          <button onClick={() => setUserOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--app-text-muted)',
            }}
            aria-haspopup="listbox"
            aria-expanded={userOpen}
            title="Switch user / role (Segregation of Duties)">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: ROLE_COLOR[currentUser.role] }}>{currentUser.initials}</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: ROLE_COLOR[currentUser.role] }}>
                {ROLE_LABELS[currentUser.role]}
              </span>
              <span className="text-xs font-medium mt-0.5" style={{ color: 'var(--app-text)' }}>{currentUser.name}</span>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: userOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 12px 32px rgba(15,23,42,0.35)',
                backdropFilter: 'blur(20px)',
              }}>
              <div className="px-4 pt-3 pb-2">
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--app-text-dim)' }}>Switch Role — Segregation of Duties</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--app-text-dim)' }}>IC-4 Dual Control · IC-5 Audit Trail</div>
              </div>
              <div className="border-t" style={{ borderColor: 'var(--divider-soft)' }}/>
              <div role="listbox" className="max-h-80 overflow-y-auto py-1">
                {userList.map(u => {
                  const active = u.id === currentUser.id;
                  return (
                    <button key={u.id} onClick={() => { onChangeUser(u.id); setUserOpen(false); }}
                      role="option"
                      aria-selected={active}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 cursor-pointer border-none"
                      style={{
                        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--overlay-bg-soft)'; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: ROLE_COLOR[u.role] }}>{u.initials}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>{u.name}</div>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: ROLE_COLOR[u.role] }}>{ROLE_LABELS[u.role]} · {u.id}</div>
                      </div>
                      {active && <span className="text-xs" style={{ color: 'var(--accent-soft)' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          role="switch"
          aria-checked={theme === 'light'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative flex items-center cursor-pointer transition-all duration-300 rounded-full"
          style={{
            width: 64,
            height: 30,
            padding: 3,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ color: theme === 'light' ? 'var(--accent-primary)' : 'var(--app-text-dim)', opacity: theme === 'light' ? 1 : 0.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ color: theme === 'dark' ? 'var(--accent-soft)' : 'var(--app-text-dim)', opacity: theme === 'dark' ? 1 : 0.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
          <span className="rounded-full transition-all duration-300 ease-out"
            style={{
              width: 22, height: 22,
              transform: theme === 'light' ? 'translateX(0)' : 'translateX(34px)',
              background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
              boxShadow: '0 2px 6px rgba(15,23,42,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }} />
        </button>
      </div>
    </nav>
  );
}
