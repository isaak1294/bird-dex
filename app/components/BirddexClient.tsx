'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Bird, User } from '@/lib/db';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITY: Record<Rarity, { label: string; bg: string; color: string }> = {
  common:    { label: 'Common',    bg: '#16a34a', color: 'white' },
  uncommon:  { label: 'Uncommon',  bg: '#ca8a04', color: 'white' },
  rare:      { label: 'Rare',      bg: '#2563eb', color: 'white' },
  epic:      { label: 'Epic',      bg: '#7c3aed', color: 'white' },
  legendary: { label: 'Legendary', bg: '#92400e', color: '#fef3c7' },
};

function getRarity(frequency: number | null): Rarity | null {
  if (frequency === null) return null;
  if (frequency > 10) return 'common';
  if (frequency > 3) return 'uncommon';
  if (frequency > 1) return 'rare';
  if (frequency > 0.1) return 'epic';
  return 'legendary';
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const REGIONS: Record<string, { label: string; species: number }> = {
  BC: { label: 'British Columbia', species: 864 },
  SK: { label: 'Saskatchewan', species: 410 },
};

type Props = { initialBirds: Bird[]; username: string; region: string; allUsers: User[] };

function padId(id: number) { return String(id).padStart(3, '0'); }

function BirdCard({ bird, username }: { bird: Bird; username: string }) {
  const coverPhoto = bird.cover_photo_id
    ? (bird.photos.find(p => p.id === bird.cover_photo_id) ?? bird.photos[0])
    : bird.photos[0];
  const discovered = bird.discovered === 1;
  const rarity = getRarity(bird.frequency);
  const rarityStyle = rarity ? RARITY[rarity] : null;

  return (
    <Link href={`/user/${username}/bird/${bird.id}`}>
      <div
        className={`bird-card rounded-xl border cursor-pointer overflow-hidden flex flex-col ${
          discovered ? 'border-green-300 bg-[#edfaf3]' : 'border-[#b8d0e4] bg-[#f4f9fd]'
        }`}
        style={{ height: 200 }}
      >
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="bird-number">#{padId(bird.id)}</span>
          {discovered && <span className="text-green-600 text-xs font-bold">✓</span>}
        </div>
        <div className={`flex-1 flex items-center justify-center mx-3 mb-2 rounded-lg overflow-hidden relative ${
          discovered ? 'bg-[#d8f2e6]' : 'bg-[#dce8f4] scanlines'
        }`}>
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhoto.url} alt={bird.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <BirdIcon discovered={discovered} />
          )}
          {rarityStyle && (
            <span className="absolute bottom-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded leading-none" style={{ background: rarityStyle.bg, color: rarityStyle.color }}>
              {rarityStyle.label}
            </span>
          )}
        </div>
        <div className="px-3 pb-3">
          <p className={`text-xs font-semibold leading-tight truncate ${discovered ? 'text-green-800' : 'text-[#6a8898]'}`}>
            {bird.name}
          </p>
        </div>
      </div>
    </Link>
  );
}

function BirdIcon({ discovered }: { discovered: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" fill={discovered ? '#86c9a4' : '#a8c4d8'}>
      <path d="M32 8c-4 0-8 2-10 5-3-1-7 0-9 3-2 2-2 5-1 8-3 1-5 4-5 7 0 4 3 7 7 8v2c0 2 1 4 3 5 1 1 3 1 4 0v4c0 1 1 2 2 2h18c1 0 2-1 2-2v-4c1 1 3 1 4 0 2-1 3-3 3-5v-2c4-1 7-4 7-8 0-3-2-6-5-7 1-3 1-6-1-8-2-3-6-4-9-3-2-3-6-5-10-5z" />
    </svg>
  );
}

type CategoryList = { category: string; total: number; discovered: number }[];

function SidebarContent({
  categories, total, activeCategory, setActiveCategory, onSelect,
}: {
  categories: CategoryList; total: number; activeCategory: string;
  setActiveCategory: (c: string) => void; onSelect?: () => void;
}) {
  return (
    <div className="p-3">
      <p className="text-[10px] uppercase tracking-widest mb-2 ml-1" style={{ color: 'var(--text-dim)' }}>
        Categories
      </p>
      <button
        onClick={() => { setActiveCategory('All'); onSelect?.(); }}
        className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm flex items-center justify-between transition-colors ${activeCategory === 'All' ? 'text-white font-semibold' : 'hover:bg-white/40'}`}
        style={activeCategory === 'All' ? { background: 'var(--red)', color: 'white' } : { color: 'var(--text-muted)' }}
      >
        <span>All</span>
        <span className="font-mono text-xs opacity-70">{total}</span>
      </button>
      {categories.map(cat => {
        const active = activeCategory === cat.category;
        return (
          <button
            key={cat.category}
            onClick={() => { setActiveCategory(cat.category); onSelect?.(); }}
            className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 text-xs flex items-center justify-between transition-colors ${active ? 'text-white font-semibold' : 'hover:bg-white/40'}`}
            style={active ? { background: 'var(--red-dark)', color: 'white' } : { color: 'var(--text-muted)' }}
          >
            <span className="truncate pr-1">{cat.category}</span>
            <span className="font-mono text-[10px] shrink-0 opacity-60">{cat.discovered}/{cat.total}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BirddexClient({ initialBirds, username, region, allUsers }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [targetOnly, setTargetOnly] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [switchingRegion, setSwitchingRegion] = useState(false);

  // Auth modal
  const [storedUsername, setStoredUsername] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<'login' | 'region'>('login');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('BC');
  const [loginError, setLoginError] = useState('');
  const [checking, setChecking] = useState(false);

  // Friends modal
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('birddex_username');
    setStoredUsername(stored);
    if (!stored && username !== 'isaak') router.replace('/user/isaak');
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [username, router]);

  const isOwner = storedUsername?.toLowerCase() === username.toLowerCase();

  async function switchRegion(newRegion: string) {
    if (newRegion === region || switchingRegion) return;
    setSwitchingRegion(true);
    setShowRegionDropdown(false);
    try {
      await fetch(`/api/users/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: newRegion }),
      });
      router.refresh();
    } finally {
      setSwitchingRegion(false);
    }
  }

  async function handleLoginSubmit() {
    const name = inputUsername.trim().toLowerCase();
    const pass = inputPassword;
    if (!name || !pass) return;
    setChecking(true);
    setLoginError('');
    try {
      const existsRes = await fetch(`/api/users/${name}`);
      if (existsRes.ok) {
        const authRes = await fetch(`/api/users/${name}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass }),
        });
        if (authRes.ok) {
          localStorage.setItem('birddex_username', name);
          setStoredUsername(name);
          setShowModal(false);
          router.push(`/user/${name}`);
        } else {
          setLoginError('Wrong password');
        }
      } else {
        setModalStep('region');
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleCreateUser() {
    const name = inputUsername.trim().toLowerCase();
    setChecking(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, region: selectedRegion, password: inputPassword }),
      });
      if (res.ok) {
        localStorage.setItem('birddex_username', name);
        setStoredUsername(name);
        setShowModal(false);
        router.push(`/user/${name}`);
      }
    } finally {
      setChecking(false);
    }
  }

  function openModal() {
    setModalStep('login');
    setInputUsername('');
    setInputPassword('');
    setSelectedRegion('BC');
    setLoginError('');
    setShowModal(true);
  }
  function signOut() { localStorage.removeItem('birddex_username'); setStoredUsername(null); }

  async function openFriendsModal() {
    const res = await fetch(`/api/users/${username}/friends`);
    if (res.ok) setFriendsList(await res.json());
    setAddFriendInput('');
    setAddFriendError('');
    setShowFriendsModal(true);
  }

  async function handleAddFriend() {
    const name = addFriendInput.trim().toLowerCase();
    if (!name) return;
    setAddFriendLoading(true);
    setAddFriendError('');
    try {
      const res = await fetch(`/api/users/${username}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendUsername: name }),
      });
      if (res.ok) {
        setFriendsList(await res.json());
        setAddFriendInput('');
        router.refresh();
      } else {
        const { error } = await res.json();
        setAddFriendError(error ?? 'Something went wrong');
      }
    } finally {
      setAddFriendLoading(false);
    }
  }

  async function handleRemoveFriend(friendUsername: string) {
    const res = await fetch(`/api/users/${username}/friends/${friendUsername}`, { method: 'DELETE' });
    if (res.ok) {
      setFriendsList(await res.json());
      router.refresh();
    }
  }

  const baseBirds = useMemo(
    () => (targetOnly ? initialBirds.filter(b => b.is_target === 1) : initialBirds),
    [initialBirds, targetOnly]
  );

  const categories = useMemo(() => {
    const map = new Map<string, { total: number; discovered: number }>();
    for (const b of baseBirds) {
      const e = map.get(b.category) ?? { total: 0, discovered: 0 };
      e.total++;
      if (b.discovered) e.discovered++;
      map.set(b.category, e);
    }
    return Array.from(map.entries())
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [baseBirds]);

  const totalDiscovered = useMemo(() => baseBirds.filter(b => b.discovered).length, [baseBirds]);

  const filteredBirds = useMemo(() => {
    let birds = baseBirds;
    if (discoveredOnly) birds = birds.filter(b => b.discovered === 1);
    if (activeCategory !== 'All') birds = birds.filter(b => b.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      birds = birds.filter(b => b.name.toLowerCase().includes(q));
    }
    const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    return [...birds].sort((a, b) => {
      const ra = getRarity(a.frequency);
      const rb = getRarity(b.frequency);
      const rankA = ra ? RARITY_RANK[ra] : -1;
      const rankB = rb ? RARITY_RANK[rb] : -1;
      if (rankA !== rankB) return rankB - rankA;
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      return a.name.localeCompare(b.name);
    });
  }, [baseBirds, activeCategory, search, discoveredOnly]);

  const total = baseBirds.length;

  function handleTargetToggle() { setTargetOnly(v => !v); setActiveCategory('All'); }

  const sidebarProps = { categories, total, activeCategory, setActiveCategory };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-3 md:px-6 py-3 shrink-0 z-10 gap-2"
        style={{ background: 'var(--red)', borderBottom: '3px solid var(--red-dark)' }}
      >
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors text-white"
            aria-label="Toggle sidebar"
          >
            <HamburgerIcon />
          </button>

          <div className="hidden md:block w-3 h-3 rounded-full bg-white opacity-80 shrink-0" />
          <div className="hidden md:block w-2 h-2 rounded-full bg-red-300 opacity-60 shrink-0" />

          <h1 className="text-white font-bold text-base md:text-xl tracking-wide flex items-baseline gap-0 min-w-0">
            {/* Username dropdown (only when signed in) */}
            <div className="relative shrink-0">
              {storedUsername ? (
                <button
                  onClick={() => setShowUserDropdown(v => !v)}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none"
                >
                  {capitalize(username)}
                  <svg width="10" height="7" viewBox="0 0 10 7" fill="none" className="opacity-70 mb-0.5">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                <span>{capitalize(username)}</span>
              )}
              {showUserDropdown && storedUsername && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl py-1 z-50 overflow-hidden" style={{ minWidth: 170 }}>
                    {allUsers.map(u => {
                      const isCurrent = u.username === username;
                      return (
                        <Link
                          key={u.username}
                          href={`/user/${u.username}`}
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                          style={{ color: isCurrent ? 'var(--red)' : 'var(--text)', fontWeight: isCurrent ? 600 : 400 }}
                        >
                          <span>{capitalize(u.username)}</span>
                          <span className="text-xs opacity-40 ml-3">{u.region}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Region dropdown */}
            <span className="text-red-200">&rsquo;s&nbsp;</span>
            <div className="relative shrink-0">
              {isOwner ? (
                <button
                  onClick={() => setShowRegionDropdown(v => !v)}
                  disabled={switchingRegion}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity focus:outline-none disabled:opacity-60"
                >
                  {switchingRegion ? '…' : region}
                  <svg width="10" height="7" viewBox="0 0 10 7" fill="none" className="opacity-70 mb-0.5">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                <span>{region}</span>
              )}
              {showRegionDropdown && isOwner && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRegionDropdown(false)} />
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl py-1 z-50 overflow-hidden" style={{ minWidth: 200 }}>
                    {Object.entries(REGIONS).map(([code, info]) => {
                      const isCurrent = code === region;
                      return (
                        <button
                          key={code}
                          onClick={() => switchRegion(code)}
                          className="w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                          style={{ color: isCurrent ? 'var(--red)' : 'var(--text)', fontWeight: isCurrent ? 600 : 400 }}
                        >
                          <span>{info.label}</span>
                          <span className="text-xs opacity-40 ml-3">{code}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <span className="truncate text-red-200">&nbsp;BirdDex</span>
          </h1>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-red-200 text-sm font-mono hidden sm:inline">
            {totalDiscovered}<span className="text-red-400">/{total}</span>
          </span>
          <div className="hidden md:block text-xs px-2 py-1 rounded font-mono" style={{ background: 'var(--red-dark)', color: '#ffcc00' }}>
            DISCOVERED
          </div>

          <Link
            href="/quiz"
            className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            Quiz
          </Link>

          {isOwner && (
            <button
              onClick={openFriendsModal}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              title="Manage friends"
            >
              <span className="hidden sm:inline">Friends</span>
              <span className="sm:hidden"><FriendsIcon /></span>
            </button>
          )}

          {storedUsername ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/user/${storedUsername}`}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-80 max-w-[80px] truncate"
                style={{ background: 'rgba(255,255,255,0.2)' }}
                title={storedUsername}
              >
                {storedUsername}
              </Link>
              <button onClick={signOut} className="text-red-300 hover:text-white text-sm px-1 leading-none shrink-0" title="Sign out">×</button>
            </div>
          ) : (
            <button
              onClick={openModal}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <span className="hidden sm:inline">My BirdDex</span>
              <span className="sm:hidden"><UserIcon /></span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside
              className="relative z-50 flex flex-col overflow-y-auto"
              style={{ width: 224, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Categories</p>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-black/10 text-lg leading-none" style={{ color: 'var(--text-dim)' }}>×</button>
              </div>
              <SidebarContent {...sidebarProps} onSelect={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside
          className="hidden md:flex shrink-0 flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-in-out"
          style={{
            width: sidebarOpen ? 224 : 0,
            background: 'var(--sidebar)',
            borderRight: sidebarOpen ? '1px solid var(--sidebar-border)' : 'none',
          }}
        >
          <SidebarContent {...sidebarProps} />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="px-3 md:px-4 py-3 shrink-0" style={{ background: 'var(--panel)', borderBottom: '1px solid var(--card-border)' }}>
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search birds..."
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'white', border: '1px solid var(--card-border)', color: 'var(--text)' }}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none" style={{ color: 'var(--text-dim)' }}>×</button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 ml-1">
              <p className="text-[11px] truncate" style={{ color: 'var(--text-dim)' }}>
                {filteredBirds.filter(b => b.discovered).length}/{filteredBirds.length} bird{filteredBirds.length !== 1 ? 's' : ''}
                {activeCategory !== 'All' ? ` · ${activeCategory}` : ''}
                {search ? ` · "${search}"` : ''}
              </p>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  onClick={() => setDiscoveredOnly(v => !v)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all"
                  style={discoveredOnly ? { background: '#edfaf3', color: '#16a34a', border: '1px solid #86efac' } : { background: 'var(--card-border)', color: 'var(--text-muted)', border: '1px solid transparent' }}
                >
                  <span>{discoveredOnly ? '★' : '☆'}</span>
                  <span>Seen</span>
                </button>
                <button
                  onClick={handleTargetToggle}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all"
                  style={targetOnly ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' } : { background: 'var(--card-border)', color: 'var(--text-muted)', border: '1px solid transparent' }}
                >
                  <span>{targetOnly ? '◉' : '○'}</span>
                  <span>{targetOnly ? 'Target' : 'All'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {filteredBirds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--text-dim)' }}>
                <BirdIcon discovered={false} />
                <p className="mt-4 text-sm">No birds found</p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {filteredBirds.map(bird => (
                  <BirdCard key={bird.id} bird={bird} username={username} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Auth Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {modalStep === 'login' ? (
              <>
                <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>My BirdDex</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Sign in or create a new account.</p>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={e => { setInputUsername(e.target.value); setLoginError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
                  placeholder="Username"
                  className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--text)' }}
                  autoFocus
                  autoComplete="username"
                />
                <input
                  type="password"
                  value={inputPassword}
                  onChange={e => { setInputPassword(e.target.value); setLoginError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
                  placeholder="Password"
                  className="w-full px-3 py-2 rounded-lg text-sm mb-3 outline-none"
                  style={{ border: `1px solid ${loginError ? '#ef4444' : 'var(--card-border)'}`, color: 'var(--text)' }}
                  autoComplete="current-password"
                />
                {loginError && <p className="text-xs text-red-500 mb-3">{loginError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Cancel</button>
                  <button onClick={handleLoginSubmit} disabled={!inputUsername.trim() || !inputPassword || checking} className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--red)' }}>
                    {checking ? '...' : 'Continue'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>Create Account</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  New account: <strong>{inputUsername}</strong>. Choose your region.
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  {Object.entries(REGIONS).map(([code, info]) => (
                    <label
                      key={code}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                      style={selectedRegion === code
                        ? { border: '2px solid var(--red)', background: '#fff5f5' }
                        : { border: '2px solid var(--card-border)', background: 'white' }}
                    >
                      <input
                        type="radio"
                        name="region"
                        checked={selectedRegion === code}
                        onChange={() => setSelectedRegion(code)}
                      />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{info.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{info.species} species</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalStep('login')} className="flex-1 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Back</button>
                  <button onClick={handleCreateUser} disabled={checking} className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: 'var(--red)' }}>
                    {checking ? '...' : 'Create Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Friends Modal */}
      {showFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) setShowFriendsModal(false); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Friends</h2>
              <button onClick={() => setShowFriendsModal(false)} className="text-xl leading-none" style={{ color: 'var(--text-dim)' }}>×</button>
            </div>

            {/* Add friend */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={addFriendInput}
                onChange={e => { setAddFriendInput(e.target.value); setAddFriendError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                placeholder="Add by username"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${addFriendError ? '#ef4444' : 'var(--card-border)'}`, color: 'var(--text)' }}
              />
              <button
                onClick={handleAddFriend}
                disabled={!addFriendInput.trim() || addFriendLoading}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ background: 'var(--red)' }}
              >
                {addFriendLoading ? '…' : 'Add'}
              </button>
            </div>
            {addFriendError && <p className="text-xs text-red-500 mb-2">{addFriendError}</p>}

            {/* Friends list */}
            <div className="mt-3 max-h-64 overflow-y-auto">
              {friendsList.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-dim)' }}>No friends yet</p>
              ) : (
                friendsList.map(f => {
                  const isSelf = f.username === username;
                  return (
                    <div key={f.username} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                      <div>
                        <Link
                          href={`/user/${f.username}`}
                          onClick={() => setShowFriendsModal(false)}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--text)' }}
                        >
                          {capitalize(f.username)}
                        </Link>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>{f.region}</span>
                        {isSelf && <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>(you)</span>}
                      </div>
                      {!isSelf && (
                        <button
                          onClick={() => handleRemoveFriend(f.username)}
                          className="text-sm px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                          style={{ color: '#ef4444' }}
                          title="Remove friend"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="0" y1="1" x2="18" y2="1" />
      <line x1="0" y1="7" x2="18" y2="7" />
      <line x1="0" y1="13" x2="18" y2="13" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="17" cy="7" r="3" />
      <path d="M21 20c0-3-2.7-5-4-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
