'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Media = { type: 'photo' | 'sound'; url: string; attribution: string; observationUrl: string };
type Question = { media: Media; choices: string[]; answer: string; category: string };
type BirdItem = { id: number; name: string; category: string };
type QuizState = 'idle' | 'loading' | 'answering' | 'revealed' | 'answered' | 'complete' | 'error';
type Score = { correct: number; wrong: number; skipped: number };

const RARITIES = [
  { key: 'common',    label: 'Common',    bg: '#16a34a', color: 'white' },
  { key: 'uncommon',  label: 'Uncommon',  bg: '#ca8a04', color: 'white' },
  { key: 'rare',      label: 'Rare',      bg: '#2563eb', color: 'white' },
  { key: 'epic',      label: 'Epic',      bg: '#7c3aed', color: 'white' },
  { key: 'legendary', label: 'Legendary', bg: '#92400e', color: '#fef3c7' },
];

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    audio.play().then(() => setPlaying(true)).catch(() => {});
    return () => { audio.pause(); };
  }, [url]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  return (
    <div
      className="w-full rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg"
      style={{ aspectRatio: '4/3', background: '#1a2f40' }}
    >
      {/* Pulsing ring when playing */}
      {playing && (
        <div
          className="absolute w-40 h-40 rounded-full animate-ping"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
      )}

      {/* Play / pause */}
      <button
        onClick={togglePlay}
        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
        style={{ background: 'rgba(255,255,255,0.18)' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="w-9 h-9" fill="white">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-9 h-9" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}
      >
        <div
          style={{ width: `${progress}%`, height: '100%', background: 'var(--red)', transition: 'width 0.1s linear' }}
        />
      </div>

      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a?.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
    </div>
  );
}

export default function QuizClient({ categories }: { categories: string[] }) {
  const [category, setCategory] = useState('All');
  const [rarities, setRarities] = useState<string[]>([]);
  const [mode, setMode] = useState<'photo' | 'sound'>('photo');
  const [hardMode, setHardMode] = useState(false);
  const [birdList, setBirdList] = useState<BirdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [state, setState] = useState<QuizState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [hardResult, setHardResult] = useState<boolean | null>(null);
  const [score, setScore] = useState<Score>({ correct: 0, wrong: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef<((list: BirdItem[], idx: number) => Promise<void>) | null>(null);

  // Recreate when mode changes so the fetch URL stays in sync
  useEffect(() => {
    loadRef.current = async (list, idx) => {
      if (idx >= list.length) {
        setState('complete');
        setCurrentIndex(list.length);
        return;
      }
      setState('loading');
      setCurrentIndex(idx);
      setSelected(null);
      setHardResult(null);
      setQuestion(null);

      const bird = list[idx];
      try {
        const res = await fetch(
          `/api/quiz?birdId=${bird.id}&category=${encodeURIComponent(bird.category)}&mode=${mode}`
        );
        if (!res.ok) {
          setScore(s => ({ ...s, skipped: s.skipped + 1 }));
          loadRef.current?.(list, idx + 1);
          return;
        }
        setQuestion(await res.json());
        setState('answering');
      } catch {
        setScore(s => ({ ...s, skipped: s.skipped + 1 }));
        loadRef.current?.(list, idx + 1);
      }
    };
  }, [mode]);

  async function handleStart() {
    setState('loading');
    setScore({ correct: 0, wrong: 0, skipped: 0 });
    setQuestion(null);
    setError(null);
    setBirdList([]);
    setCurrentIndex(0);

    try {
      const params = new URLSearchParams({ category });
      for (const r of rarities) params.append('rarity', r);
      const res = await fetch(`/api/quiz/list?${params}`);
      if (!res.ok) throw new Error('Failed to load bird list');
      const list: BirdItem[] = await res.json();

      if (list.length === 0) {
        setError('No birds found for this filter combination.');
        setState('error');
        return;
      }

      const shuffled = [...list].sort(() => Math.random() - 0.5);
      setBirdList(shuffled);
      loadRef.current?.(shuffled, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setState('error');
    }
  }

  function handleAnswer(choice: string) {
    if (state !== 'answering' || !question) return;
    const correct = choice === question.answer;
    setSelected(choice);
    setState('answered');
    setScore(s => ({ ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }));
  }

  function handleReveal() { setState('revealed'); }

  function handleSelfReport(correct: boolean) {
    setHardResult(correct);
    setState('answered');
    setScore(s => ({ ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }));
  }

  function handleNext() { loadRef.current?.(birdList, currentIndex + 1); }

  function handleSkip() {
    setScore(s => ({ ...s, skipped: s.skipped + 1 }));
    loadRef.current?.(birdList, currentIndex + 1);
  }

  function toggleRarity(key: string) {
    setRarities(prev => prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]);
    resetToIdle();
  }

  function resetToIdle() {
    setState('idle');
    setBirdList([]);
    setScore({ correct: 0, wrong: 0, skipped: 0 });
    setQuestion(null);
  }

  const inQuiz = state !== 'idle' && state !== 'error';
  const answered = score.correct + score.wrong;
  const accuracy = answered > 0 ? Math.round((score.correct / answered) * 100) : null;
  const isCorrect = hardMode ? hardResult === true : selected === question?.answer;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: 'var(--red)', borderBottom: '3px solid var(--red-dark)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white text-sm transition-colors">← Back</Link>
          <h1 className="text-white font-bold text-lg tracking-wide">Bird Quiz</h1>
          <div className="flex gap-1">
            {mode === 'sound' && (
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'var(--red-dark)', color: '#ffcc00' }}>SOUND</span>
            )}
            {hardMode && (
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'var(--red-dark)', color: '#ffcc00' }}>HARD</span>
            )}
          </div>
        </div>
        {answered > 0 && (
          <div className="font-mono text-sm text-white">
            <span className="font-bold">{score.correct}</span>
            <span className="opacity-50">/{answered}</span>
            {accuracy !== null && <span className="ml-2 opacity-60 text-xs">{accuracy}%</span>}
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-4 max-w-lg mx-auto w-full">
        {/* Filters */}
        <div className="w-full flex flex-col gap-3">
          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              Category
            </label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); resetToIdle(); }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'white', border: '1px solid var(--card-border)', color: 'var(--text)' }}
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Rarity multi-select */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              Rarity {rarities.length > 0 && <span className="opacity-60 normal-case">({rarities.length} selected)</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RARITIES.map(r => {
                const active = rarities.includes(r.key);
                return (
                  <button
                    key={r.key}
                    onClick={() => toggleRarity(r.key)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                    style={active
                      ? { background: r.bg, color: r.color }
                      : { background: 'white', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode + Hard mode row */}
          <div className="flex items-center gap-3">
            {/* Photo / Sound toggle */}
            <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--card-border)' }}>
              {(['photo', 'sound'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); resetToIdle(); }}
                  className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={mode === m
                    ? { background: 'var(--red)', color: 'white' }
                    : { background: 'white', color: 'var(--text-muted)' }
                  }
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Hard mode toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Hard</span>
              <button
                onClick={() => { setHardMode(v => !v); resetToIdle(); }}
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
                style={{ background: hardMode ? 'var(--red)' : 'var(--card-border)' }}
                aria-label="Toggle hard mode"
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: hardMode ? 'translateX(22px)' : 'translateX(3px)' }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {inQuiz && birdList.length > 0 && (
          <div className="w-full">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-dim)' }}>
              <span>Bird {Math.min(currentIndex + 1, birdList.length)} of {birdList.length}</span>
              <span>{score.correct}✓ {score.wrong}✗{score.skipped > 0 ? ` ${score.skipped} skipped` : ''}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(currentIndex / birdList.length) * 100}%`, background: 'var(--red)' }}
              />
            </div>
          </div>
        )}

        {/* Idle */}
        {state === 'idle' && (
          <div className="w-full text-center py-6">
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {mode === 'sound'
                ? hardMode ? 'Listen to a bird call. Try to name it, then reveal the answer.' : 'Listen to a bird call. Guess the species from 5 choices.'
                : hardMode ? 'A bird photo will appear. Try to name it, then reveal the answer.' : 'A bird photo will appear. Guess the species from 5 choices.'
              }
            </p>
            <button
              onClick={handleStart}
              className="px-8 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'var(--red)' }}
            >
              Start Quiz
            </button>
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ color: 'var(--text-dim)' }}>
            <div className="w-7 h-7 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="w-full p-4 rounded-xl text-center" style={{ background: '#fff5f5', border: '1px solid #fca5a5' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--red)' }}>{error}</p>
            <button onClick={handleStart} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>Try again</button>
          </div>
        )}

        {/* Complete */}
        {state === 'complete' && (
          <div className="w-full rounded-2xl p-6 text-center" style={{ background: 'white', border: '1px solid var(--card-border)' }}>
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-bold text-xl mb-1" style={{ color: 'var(--text)' }}>Category Complete!</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
              {category}{rarities.length > 0 ? ` · ${rarities.join(', ')}` : ''}{hardMode ? ' · hard' : ''}{mode === 'sound' ? ' · sound' : ''}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3 rounded-xl" style={{ background: '#edfaf3' }}>
                <div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{score.correct}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: '#16a34a' }}>Correct</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: '#fff5f5' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--red)' }}>{score.wrong}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--red)' }}>Wrong</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--panel)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>{score.skipped}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-dim)' }}>Skipped</div>
              </div>
            </div>
            {accuracy !== null && (
              <div className="text-3xl font-bold mb-5" style={{ color: 'var(--red)' }}>{accuracy}% accuracy</div>
            )}
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'var(--red)' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Question */}
        {question && (state === 'answering' || state === 'revealed' || state === 'answered') && (
          <>
            {/* Media */}
            {question.media.type === 'photo' ? (
              <div
                className="w-full rounded-2xl overflow-hidden shadow-lg relative"
                style={{ aspectRatio: '4/3', background: '#1a2f40' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.media.url}
                  alt="mystery bird"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                />
                {state === 'answered' && (
                  <div
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-md"
                    style={isCorrect ? { background: '#16a34a', color: 'white' } : { background: 'var(--red)', color: 'white' }}
                  >
                    {isCorrect ? 'Correct!' : (hardMode ? 'Wrong!' : `It's: ${question.answer}`)}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full relative">
                <AudioPlayer url={question.media.url} />
                {state === 'answered' && (
                  <div
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-md"
                    style={isCorrect ? { background: '#16a34a', color: 'white' } : { background: 'var(--red)', color: 'white' }}
                  >
                    {isCorrect ? 'Correct!' : (hardMode ? 'Wrong!' : `It's: ${question.answer}`)}
                  </div>
                )}
              </div>
            )}

            {/* Attribution */}
            <p className="text-[10px] w-full -mt-2" style={{ color: 'var(--text-dim)' }}>
              {question.media.attribution} ·{' '}
              <a href={question.media.observationUrl} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70">
                iNaturalist
              </a>
            </p>

            {/* ── Normal mode ── */}
            {!hardMode && (
              <>
                <div className="w-full flex flex-col gap-2">
                  {question.choices.map(choice => {
                    const isSelected = selected === choice;
                    const correct = choice === question.answer;
                    const revealed = state === 'answered';
                    let style: React.CSSProperties;
                    if (!revealed) {
                      style = { background: 'white', border: '2px solid var(--card-border)', color: 'var(--text)' };
                    } else if (correct) {
                      style = { background: '#edfaf3', border: '2px solid #86efac', color: '#14532d' };
                    } else if (isSelected) {
                      style = { background: '#fff5f5', border: '2px solid #fca5a5', color: 'var(--red)' };
                    } else {
                      style = { background: 'white', border: '2px solid var(--card-border)', color: 'var(--text-dim)', opacity: 0.5 };
                    }
                    return (
                      <button
                        key={choice}
                        onClick={() => handleAnswer(choice)}
                        disabled={revealed}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:cursor-default"
                        style={style}
                      >
                        {revealed && correct && <span className="mr-2">✓</span>}
                        {revealed && isSelected && !correct && <span className="mr-2">✗</span>}
                        {choice}
                      </button>
                    );
                  })}
                </div>
                {state === 'answering' && (
                  <button onClick={handleSkip} className="text-xs underline" style={{ color: 'var(--text-dim)' }}>
                    Skip this bird
                  </button>
                )}
                {state === 'answered' && (
                  <button
                    onClick={handleNext}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--red)' }}
                  >
                    {currentIndex + 1 >= birdList.length ? 'See Results →' : 'Next Bird →'}
                  </button>
                )}
              </>
            )}

            {/* ── Hard mode ── */}
            {hardMode && (
              <>
                {state === 'answering' && (
                  <div className="w-full flex flex-col gap-2">
                    <button
                      onClick={handleReveal}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                      style={{ background: 'var(--red-dark)' }}
                    >
                      Reveal Answer
                    </button>
                    <button onClick={handleSkip} className="text-xs underline" style={{ color: 'var(--text-dim)' }}>
                      Skip this bird
                    </button>
                  </div>
                )}
                {state === 'revealed' && (
                  <>
                    <div className="w-full p-4 rounded-xl text-center" style={{ background: 'white', border: '1px solid var(--card-border)' }}>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Answer</p>
                      <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{question.answer}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{question.category}</p>
                    </div>
                    <div className="w-full flex gap-2">
                      <button
                        onClick={() => handleSelfReport(true)}
                        className="flex-1 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                        style={{ background: '#16a34a' }}
                      >
                        ✓ Got it right
                      </button>
                      <button
                        onClick={() => handleSelfReport(false)}
                        className="flex-1 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--red)' }}
                      >
                        ✗ Didn&apos;t get it
                      </button>
                    </div>
                  </>
                )}
                {state === 'answered' && (
                  <>
                    {!isCorrect && (
                      <div className="w-full p-4 rounded-xl text-center" style={{ background: '#fff5f5', border: '2px solid #fca5a5' }}>
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--red)' }}>Answer</p>
                        <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{question.answer}</p>
                      </div>
                    )}
                    <button
                      onClick={handleNext}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
                      style={{ background: 'var(--red)' }}
                    >
                      {currentIndex + 1 >= birdList.length ? 'See Results →' : 'Next Bird →'}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
