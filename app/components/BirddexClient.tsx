'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Bird } from '@/lib/db';

type Category = { category: string; total: number; discovered: number };

type Props = {
  initialBirds: Bird[];
  categories: Category[];
  totalDiscovered: number;
};

function padId(id: number) {
  return String(id).padStart(3, '0');
}

function BirdCard({ bird }: { bird: Bird }) {
  const firstPhoto = bird.photos[0];
  const discovered = bird.discovered === 1;

  return (
    <Link href={`/bird/${bird.id}`}>
      <div
        className={`bird-card rounded-xl border cursor-pointer overflow-hidden flex flex-col ${
          discovered
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
        <div className={`flex-1 flex items-center justify-center mx-3 mb-2 rounded-lg overflow-hidden relative ${
          discovered ? 'bg-[#d8f2e6]' : 'bg-[#dce8f4] scanlines'
        }`}>
          {firstPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstPhoto.url}
              alt={bird.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <BirdIcon discovered={discovered} />
          )}
        </div>

        {/* Name */}
        <div className="px-3 pb-3">
          <p className={`text-xs font-semibold leading-tight truncate ${
            discovered ? 'text-green-800' : 'text-[#6a8898]'
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

export default function BirddexClient({ initialBirds, categories, totalDiscovered }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredBirds = useMemo(() => {
    let birds = initialBirds;
    if (activeCategory !== 'All') {
      birds = birds.filter(b => b.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      birds = birds.filter(b => b.name.toLowerCase().includes(q));
    }
    return birds;
  }, [initialBirds, activeCategory, search]);

  const total = initialBirds.length;

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
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm flex items-center justify-between transition-colors ${
                activeCategory === 'All'
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
                  className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 text-xs flex items-center justify-between transition-colors ${
                    active ? 'text-white font-semibold' : 'hover:bg-white/40'
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
            <p className="text-[11px] mt-1.5 ml-1" style={{ color: 'var(--text-dim)' }}>
              {filteredBirds.length} bird{filteredBirds.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
              {search ? ` matching "${search}"` : ''}
            </p>
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
