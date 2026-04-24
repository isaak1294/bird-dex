'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Bird } from '@/lib/db';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITY: Record<Rarity, { label: string; bg: string; color: string }> = {
  common: { label: 'Common', bg: '#16a34a', color: 'white' },
  uncommon: { label: 'Uncommon', bg: '#ca8a04', color: 'white' },
  rare: { label: 'Rare', bg: '#2563eb', color: 'white' },
  epic: { label: 'Epic', bg: '#7c3aed', color: 'white' },
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

type Props = { initialBirds: Bird[] };

function padId(id: number) {
  return String(id).padStart(3, '0');
}

function BirdCard({ bird }: { bird: Bird }) {
  const coverPhoto = bird.cover_photo_id
    ? (bird.photos.find(p => p.id === bird.cover_photo_id) ?? bird.photos[0])
    : bird.photos[0];
  const discovered = bird.discovered === 1;
  const rarity = getRarity(bird.frequency);
  const rarityStyle = rarity ? RARITY[rarity] : null;

  return (
    <Link href={`/bird/${bird.id}`}>
      <div
        className={`bird-card rounded-xl border cursor-pointer overflow-hidden flex flex-col ${discovered
            ? 'border-green-300 bg-[#edfaf3]'
            : 'border-[#b8d0e4] bg-[#f4f9fd]'
          }`}
        style={{ height: 200 }}
      >
        {/* Number bar */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="bird-number">#{padId(bird.id)}</span>
          {discovered && (
            <span className="text-green-600 text-xs font-bold">✓</span>
          )}
        </div>

        {/* Image area */}
        <div className={`flex-1 flex items-center justify-center mx-3 mb-2 rounded-lg overflow-hidden relative ${discovered ? 'bg-[#d8f2e6]' : 'bg-[#dce8f4] scanlines'
          }`}>
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPhoto.url}
              alt={bird.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <BirdIcon discovered={discovered} />
          )}

          {/* Rarity badge */}
          {rarityStyle && (
            <span
              className="absolute bottom-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded leading-none"
              style={{ background: rarityStyle.bg, color: rarityStyle.color }}
            >
              {rarityStyle.label}
            </span>
          )}
        </div>

        {/* Name */}
        <div className="px-3 pb-3">
          <p className={`text-xs font-semibold leading-tight truncate ${discovered ? 'text-green-800' : 'text-[#6a8898]'
            }`}>
            {bird.name}
          </p>
        </div>
      </div>
    </Link>
  );
}

function BirdIcon({ discovered }: { discovered: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="w-12 h-12"
      fill={discovered ? '#86c9a4' : '#a8c4d8'}
    >
      <path d="M32 8c-4 0-8 2-10 5-3-1-7 0-9 3-2 2-2 5-1 8-3 1-5 4-5 7 0 4 3 7 7 8v2c0 2 1 4 3 5 1 1 3 1 4 0v4c0 1 1 2 2 2h18c1 0 2-1 2-2v-4c1 1 3 1 4 0 2-1 3-3 3-5v-2c4-1 7-4 7-8 0-3-2-6-5-7 1-3 1-6-1-8-2-3-6-4-9-3-2-3-6-5-10-5z" />
    </svg>
  );
}

export default function BirddexClient({ initialBirds }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [targetOnly, setTargetOnly] = useState(true);

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
    const RARITY_RANK: Record<string, number> = {
      legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4,
    };
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

  function handleTargetToggle() {
    setTargetOnly(v => !v);
    setActiveCategory('All');
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0 z-10"
        style={{ background: 'var(--red)', borderBottom: '3px solid var(--red-dark)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-white opacity-80" />
          <div className="w-2 h-2 rounded-full bg-red-300 opacity-60" />
          <h1 className="text-white font-bold text-xl tracking-wide ml-1">
            BC BirdDex
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-200 text-sm font-mono">
            {totalDiscovered}
            <span className="text-red-400">/{total}</span>
          </span>
          <div
            className="text-xs px-2 py-1 rounded font-mono"
            style={{ background: 'var(--red-dark)', color: '#ffcc00' }}
          >
            DISCOVERED
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-56 shrink-0 flex flex-col overflow-y-auto"
          style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
        >
          <div className="p-3">
            <p className="text-[10px] uppercase tracking-widest mb-2 ml-1" style={{ color: 'var(--text-dim)' }}>
              Categories
            </p>

            <button
              onClick={() => setActiveCategory('All')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm flex items-center justify-between transition-colors ${activeCategory === 'All'
                  ? 'text-white font-semibold'
                  : 'hover:bg-white/40'
                }`}
              style={
                activeCategory === 'All'
                  ? { background: 'var(--red)', color: 'white' }
                  : { color: 'var(--text-muted)' }
              }
            >
              <span>All</span>
              <span className="font-mono text-xs opacity-70">{total}</span>
            </button>

            {categories.map(cat => {
              const active = activeCategory === cat.category;
              return (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 text-xs flex items-center justify-between transition-colors ${active ? 'text-white font-semibold' : 'hover:bg-white/40'
                    }`}
                  style={
                    active
                      ? { background: 'var(--red-dark)', color: 'white' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  <span className="truncate pr-1">{cat.category}</span>
                  <span className="font-mono text-[10px] shrink-0 opacity-60">
                    {cat.discovered}/{cat.total}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div
            className="px-4 py-3 shrink-0"
            style={{ background: 'var(--panel)', borderBottom: '1px solid var(--card-border)' }}
          >
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search birds..."
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'white',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text)',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none"
                  style={{ color: 'var(--text-dim)' }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 ml-1">
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {filteredBirds.length} bird{filteredBirds.length !== 1 ? 's' : ''}
                {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                {search ? ` matching "${search}"` : ''}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDiscoveredOnly(v => !v)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                  style={discoveredOnly
                    ? { background: '#edfaf3', color: '#16a34a', border: '1px solid #86efac' }
                    : { background: 'var(--card-border)', color: 'var(--text-muted)', border: '1px solid transparent' }
                  }
                >
                  <span>{discoveredOnly ? '★' : '☆'}</span>
                  <span>Seen</span>
                </button>
                <button
                  onClick={handleTargetToggle}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                  style={targetOnly
                    ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' }
                    : { background: 'var(--card-border)', color: 'var(--text-muted)', border: '1px solid transparent' }
                  }
                >
                  <span>{targetOnly ? '◉' : '○'}</span>
                  <span>{targetOnly ? 'Target' : 'All'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bird grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredBirds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--text-dim)' }}>
                <BirdIcon discovered={false} />
                <p className="mt-4 text-sm">No birds found</p>
              </div>
            ) : (
              <div className="grid gap-3" style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              }}>
                {filteredBirds.map(bird => (
                  <BirdCard key={bird.id} bird={bird} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2"
      style={{ color: 'var(--text-dim)' }}
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
