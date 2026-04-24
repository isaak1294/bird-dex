'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Bird, Photo } from '@/lib/db';

type Props = { bird: Bird; prevId: number | null; nextId: number | null };

function padId(id: number) {
  return String(id).padStart(3, '0');
}

export default function BirdDetail({ bird: initialBird, prevId, nextId }: Props) {
  const router = useRouter();
  const [bird, setBird] = useState(initialBird);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fieldNotes, setFieldNotes] = useState(initialBird.field_notes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0); // how many in current batch
  const [uploadDone, setUploadDone] = useState(0);
  const [caption, setCaption] = useState('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const discovered = bird.discovered === 1;
  const photos = bird.photos;
  const safeIndex = Math.min(activeIndex, Math.max(0, photos.length - 1));
  const activePhoto = photos[safeIndex] ?? null;
  const coverPhotoId = bird.cover_photo_id ?? photos[0]?.id ?? null;

  function goPrev() { setActiveIndex(i => Math.max(0, i - 1)); }
  function goNext() { setActiveIndex(i => Math.min(photos.length - 1, i + 1)); }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) delta > 0 ? goNext() : goPrev();
    setTouchStartX(null);
  }

  async function toggleDiscovered() {
    const next = discovered ? 0 : 1;
    const res = await fetch(`/api/birds/${bird.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discovered: next }),
    });
    setBird(await res.json());
    startTransition(() => router.refresh());
  }

  async function saveNotes() {
    await fetch(`/api/birds/${bird.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_notes: fieldNotes }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    startTransition(() => router.refresh());
  }

  async function uploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadCount(files.length);
    setUploadDone(0);

    const newPhotos: Photo[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('photo', file);
      form.append('caption', caption);
      const res = await fetch(`/api/birds/${bird.id}/photos`, { method: 'POST', body: form });
      if (res.ok) newPhotos.push(await res.json());
      setUploadDone(d => d + 1);
    }

    if (newPhotos.length > 0) {
      const updatedPhotos = [...bird.photos, ...newPhotos];
      setBird(b => ({ ...b, discovered: 1, photos: updatedPhotos }));
      setActiveIndex(updatedPhotos.length - 1);
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      startTransition(() => router.refresh());
    }
    setUploading(false);
  }

  async function setCover(photoId: number) {
    const res = await fetch(`/api/birds/${bird.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_photo_id: photoId }),
    });
    setBird(await res.json());
    startTransition(() => router.refresh());
  }

  async function deleteActivePhoto() {
    if (!activePhoto) return;
    await fetch(`/api/birds/${bird.id}/photos/${activePhoto.id}`, { method: 'DELETE' });
    const remaining = bird.photos.filter(p => p.id !== activePhoto.id);
    setBird(b => ({ ...b, photos: remaining }));
    setActiveIndex(i => Math.min(i, Math.max(0, remaining.length - 1)));
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ background: 'var(--red)', borderBottom: '3px solid var(--red-dark)' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white text-sm hover:text-red-200 flex items-center gap-1.5 transition-colors">
            <span>←</span><span>Back</span>
          </Link>
          <div className="w-px h-4 bg-red-800" />
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-white opacity-80" />
            <span className="text-white font-bold text-lg tracking-wide">BC BirdDex</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prevId && (
            <Link href={`/bird/${prevId}`} className="text-red-200 hover:text-white text-sm px-3 py-1 rounded transition-colors" style={{ background: 'rgba(0,0,0,0.2)' }}>
              ← #{padId(prevId)}
            </Link>
          )}
          {nextId && (
            <Link href={`/bird/${nextId}`} className="text-red-200 hover:text-white text-sm px-3 py-1 rounded transition-colors" style={{ background: 'rgba(0,0,0,0.2)' }}>
              #{padId(nextId)} →
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        <div className="flex gap-8 flex-col md:flex-row">
          {/* Photo panel */}
          <div className="flex-1 flex flex-col gap-3">

            {/* Main viewer */}
            <div
              className={`relative rounded-2xl overflow-hidden flex items-center justify-center select-none ${!discovered ? 'scanlines' : ''}`}
              style={{
                background: discovered ? '#d8f2e6' : '#dce8f4',
                border: `2px solid ${discovered ? '#86efac' : 'var(--card-border)'}`,
                minHeight: 300,
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {activePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePhoto.url}
                  alt={bird.name}
                  className="max-h-80 max-w-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12">
                  <BirdSilhouette discovered={discovered} />
                  <span className="text-sm" style={{ color: discovered ? '#3a8a5a' : 'var(--text-dim)' }}>
                    {discovered ? 'No photos yet' : 'Undiscovered'}
                  </span>
                </div>
              )}

              {/* Prev arrow */}
              {photos.length > 1 && safeIndex > 0 && (
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                  aria-label="Previous photo"
                >
                  <ChevronLeft />
                </button>
              )}

              {/* Next arrow */}
              {photos.length > 1 && safeIndex < photos.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                  aria-label="Next photo"
                >
                  <ChevronRight />
                </button>
              )}

              {/* Counter */}
              {photos.length > 1 && (
                <div
                  className="absolute bottom-2 right-3 text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.35)', color: 'white' }}
                >
                  {safeIndex + 1} / {photos.length}
                </div>
              )}
            </div>

            {/* Caption + delete */}
            {activePhoto && (
              <div className="flex items-center gap-3 px-1">
                {activePhoto.caption ? (
                  <p className="text-xs flex-1 italic" style={{ color: 'var(--text-muted)' }}>"{activePhoto.caption}"</p>
                ) : (
                  <div className="flex-1" />
                )}
                <button onClick={deleteActivePhoto} className="text-xs text-red-500 hover:text-red-700 transition-colors shrink-0">
                  Delete photo
                </button>
              </div>
            )}

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((photo, i) => {
                  const isCover = photo.id === coverPhotoId;
                  const isActive = i === safeIndex;
                  return (
                    <div key={photo.id} className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setActiveIndex(i)}
                        className={`rounded-lg overflow-hidden w-14 h-14 border-2 transition-all shrink-0 ${
                          isActive ? 'border-green-400 opacity-100' : 'border-[#b8d0e4] opacity-50 hover:opacity-80'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.caption || bird.name} className="w-full h-full object-cover" />
                      </button>
                      <button
                        onClick={() => setCover(photo.id)}
                        title={isCover ? 'Cover photo' : 'Set as cover'}
                        className="text-[11px] transition-colors leading-none"
                        style={{ color: isCover ? '#ca8a04' : 'var(--text-dim)' }}
                      >
                        {isCover ? '★' : '☆'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="w-full md:w-72 flex flex-col gap-4">
            {/* Name card */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: `1px solid ${discovered ? '#86efac' : 'var(--card-border)'}` }}>
              <div className="flex items-start justify-between mb-2">
                <span className="bird-number text-base">#{padId(bird.id)}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${discovered ? 'bg-green-100 text-green-700' : 'text-[#6a90a8]'}`}
                  style={!discovered ? { background: 'var(--card-border)' } : {}}
                >
                  {discovered ? 'DISCOVERED' : 'UNDISCOVERED'}
                </span>
              </div>
              <h1 className="text-2xl font-bold leading-tight mb-1" style={{ color: 'var(--text)' }}>{bird.name}</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{bird.category}</p>
            </div>

            {/* Discovered toggle */}
            <button
              onClick={toggleDiscovered}
              disabled={isPending}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${discovered ? 'border hover:bg-green-50' : 'text-white hover:opacity-90'}`}
              style={discovered ? { background: '#edfaf3', color: '#16a34a', borderColor: '#86efac' } : { background: 'var(--red)' }}
            >
              {discovered ? '✓ Mark as Undiscovered' : '+ Mark as Discovered'}
            </button>

            {/* Upload */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--panel)', border: '1px solid var(--card-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Add Photos</p>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Caption (applied to all)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'white', border: '1px solid var(--card-border)', color: 'var(--text)' }}
              />
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={uploadPhotos} className="hidden" id="photo-upload" />
              <label
                htmlFor="photo-upload"
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${uploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}`}
                style={{ background: 'var(--card-border)', color: 'var(--text-muted)' }}
              >
                {uploading ? (
                  <><Spinner /> {uploadDone}/{uploadCount} uploaded…</>
                ) : (
                  <><span>📷</span> Choose Photos</>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Field notes */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--panel)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Field Notes</p>
            {notesSaved && <span className="text-xs text-green-600">Saved ✓</span>}
          </div>
          <textarea
            value={fieldNotes}
            onChange={e => setFieldNotes(e.target.value)}
            placeholder="Record your observations: location, date, behaviour, plumage details..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none font-mono leading-relaxed"
            style={{ background: 'white', border: '1px solid var(--card-border)', color: 'var(--text)' }}
          />
          <div className="flex justify-end mt-3">
            <button onClick={saveNotes} className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90" style={{ background: 'var(--red)' }}>
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BirdSilhouette({ discovered }: { discovered: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="w-24 h-24" fill={discovered ? '#86c9a4' : '#a8c4d8'}>
      <path d="M32 8c-4 0-8 2-10 5-3-1-7 0-9 3-2 2-2 5-1 8-3 1-5 4-5 7 0 4 3 7 7 8v2c0 2 1 4 3 5 1 1 3 1 4 0v4c0 1 1 2 2 2h18c1 0 2-1 2-2v-4c1 1 3 1 4 0 2-1 3-3 3-5v-2c4-1 7-4 7-8 0-3-2-6-5-7 1-3 1-6-1-8-2-3-6-4-9-3-2-3-6-5-10-5z" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
    </svg>
  );
}
