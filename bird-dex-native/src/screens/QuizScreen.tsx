import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { type ThemeColors } from '../theme';
import { api } from '../api';
import { resolveUrl } from '../config';
import AudioPlayer from '../components/AudioPlayer';

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

export default function QuizScreen() {
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width, 480);
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('All');
  const [rarities, setRarities] = useState<string[]>([]);
  const [mode, setMode] = useState<'photo' | 'sound'>('photo');
  const [hardMode, setHardMode] = useState(false);
  const [birdList, setBirdList] = useState<BirdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [hardResult, setHardResult] = useState<boolean | null>(null);
  const [score, setScore] = useState<Score>({ correct: 0, wrong: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const thumbAnim = useRef(new Animated.Value(0)).current;
  const loadRef = useRef<((list: BirdItem[], idx: number) => Promise<void>) | null>(null);

  useEffect(() => {
    api.getQuizCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue: hardMode ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hardMode, thumbAnim]);

  useEffect(() => {
    loadRef.current = async (list: BirdItem[], idx: number) => {
      if (idx >= list.length) {
        setQuizState('complete');
        setCurrentIndex(list.length);
        return;
      }
      setQuizState('loading');
      setCurrentIndex(idx);
      setSelected(null);
      setHardResult(null);
      setQuestion(null);

      const bird = list[idx];
      try {
        const q = await api.getQuizQuestion(bird.id, bird.category, mode);
        setQuestion(q);
        setQuizState('answering');
      } catch {
        setScore(s => ({ ...s, skipped: s.skipped + 1 }));
        loadRef.current?.(list, idx + 1);
      }
    };
  }, [mode]);

  const resetToIdle = useCallback(() => {
    setQuizState('idle');
    setBirdList([]);
    setScore({ correct: 0, wrong: 0, skipped: 0 });
    setQuestion(null);
  }, []);

  async function handleStart() {
    setQuizState('loading');
    setScore({ correct: 0, wrong: 0, skipped: 0 });
    setQuestion(null);
    setError(null);
    setBirdList([]);
    setCurrentIndex(0);

    try {
      const list = await api.getQuizList(category, rarities);
      if (list.length === 0) {
        setError('No birds found for this filter combination.');
        setQuizState('error');
        return;
      }
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      setBirdList(shuffled);
      loadRef.current?.(shuffled, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setQuizState('error');
    }
  }

  function handleAnswer(choice: string) {
    if (quizState !== 'answering' || !question) return;
    const correct = choice === question.answer;
    setSelected(choice);
    setQuizState('answered');
    setScore(s => ({ ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }));
  }

  function handleReveal() { setQuizState('revealed'); }

  function handleSelfReport(correct: boolean) {
    setHardResult(correct);
    setQuizState('answered');
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

  const inQuiz = quizState !== 'idle' && quizState !== 'error';
  const answered = score.correct + score.wrong;
  const accuracy = answered > 0 ? Math.round((score.correct / answered) * 100) : null;
  const isCorrect = hardMode ? hardResult === true : selected === question?.answer;
  const progressPct = birdList.length > 0 ? (currentIndex / birdList.length) * 100 : 0;

  const thumbTranslate = thumbAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 22] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['left', 'right']}>
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + 14 }]}>
          <View style={S.headerLeft}>
            <Text style={S.headerTitle}>Bird Quiz</Text>
            <View style={S.badgeRow}>
              {mode === 'sound' && <View style={S.badge}><Text style={S.badgeText}>SOUND</Text></View>}
              {hardMode && <View style={S.badge}><Text style={S.badgeText}>HARD</Text></View>}
            </View>
          </View>
          {answered > 0 && (
            <Text style={S.scoreText}>
              <Text style={{ fontWeight: '700' }}>{score.correct}</Text>
              <Text style={{ opacity: 0.55 }}>/{answered}</Text>
              {accuracy !== null && <Text style={{ opacity: 0.65, fontSize: 11 }}>  {accuracy}%</Text>}
            </Text>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[S.content, { paddingHorizontal: Math.max(16, (width - maxWidth) / 2) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Filters */}
          <View style={S.filters}>
            {/* Category picker */}
            <View>
              <Text style={S.filterLabel}>Category</Text>
              <Pressable
                style={S.categoryBtn}
                onPress={() => setShowCategoryPicker(v => !v)}
              >
                <Text style={[S.categoryBtnText, { color: C.text }]}>
                  {category === 'All' ? 'All Categories' : category}
                </Text>
                <Text style={{ fontSize: 10, color: C.textMuted }}>{showCategoryPicker ? '▲' : '▼'}</Text>
              </Pressable>
              {showCategoryPicker && (
                <View style={S.categoryDropdown}>
                  {['All', ...categories].map(c => (
                    <Pressable
                      key={c}
                      style={[S.categoryOption, category === c && { backgroundColor: C.surfaceAlt }]}
                      onPress={() => { setCategory(c); resetToIdle(); setShowCategoryPicker(false); }}
                    >
                      <Text style={[S.categoryOptionText, { color: category === c ? C.accent : C.text }]}>
                        {c === 'All' ? 'All Categories' : c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Rarity chips */}
            <View>
              <Text style={S.filterLabel}>
                Rarity{rarities.length > 0 ? ` (${rarities.length})` : ''}
              </Text>
              <View style={S.rarityRow}>
                {RARITIES.map(r => {
                  const active = rarities.includes(r.key);
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => toggleRarity(r.key)}
                      style={[
                        S.rarityChip,
                        active ? { backgroundColor: r.bg } : { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
                      ]}
                    >
                      <Text style={[S.rarityChipText, { color: active ? r.color : C.textSecondary }]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Mode + Hard mode row */}
            <View style={S.modeRow}>
              <View style={[S.modeToggle, { borderColor: C.border }]}>
                {(['photo', 'sound'] as const).map(m => (
                  <Pressable
                    key={m}
                    onPress={() => { setMode(m); resetToIdle(); }}
                    style={[S.modeBtn, { backgroundColor: mode === m ? C.accent : C.surface }]}
                  >
                    <Text style={[S.modeBtnText, { color: mode === m ? '#ffffff' : C.textSecondary }]}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={S.hardRow}>
                <Text style={S.filterLabel}>Hard</Text>
                <Pressable onPress={() => { setHardMode(v => !v); resetToIdle(); }}>
                  <View style={[S.toggleTrack, { backgroundColor: hardMode ? C.accent : C.border }]}>
                    <Animated.View style={[S.toggleThumb, { transform: [{ translateX: thumbTranslate }] }]} />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          {inQuiz && birdList.length > 0 && (
            <View style={S.progressWrap}>
              <View style={S.progressLabels}>
                <Text style={[S.progressText, { color: C.textMuted }]}>
                  Bird {Math.min(currentIndex + 1, birdList.length)} of {birdList.length}
                </Text>
                <Text style={[S.progressText, { color: C.textMuted }]}>
                  {score.correct} correct  {score.wrong} wrong{score.skipped > 0 ? `  ${score.skipped} skip` : ''}
                </Text>
              </View>
              <View style={[S.progressTrack, { backgroundColor: C.border }]}>
                <View style={[S.progressFill, { width: `${progressPct}%` as any, backgroundColor: C.accent }]} />
              </View>
            </View>
          )}

          {/* Idle */}
          {quizState === 'idle' && (
            <View style={S.idleWrap}>
              <Text style={[S.idleDesc, { color: C.textSecondary }]}>
                {mode === 'sound'
                  ? hardMode
                    ? 'Listen to a bird call. Try to name it, then reveal the answer.'
                    : 'Listen to a bird call. Guess the species from 5 choices.'
                  : hardMode
                    ? 'A bird photo will appear. Try to name it, then reveal the answer.'
                    : 'A bird photo will appear. Guess the species from 5 choices.'
                }
              </Text>
              <Pressable style={[S.startBtn, { backgroundColor: C.accent }]} onPress={handleStart}>
                <Text style={S.startBtnText}>Start Quiz</Text>
              </Pressable>
            </View>
          )}

          {/* Loading */}
          {quizState === 'loading' && (
            <View style={S.loadingWrap}>
              <ActivityIndicator color={C.accent} size="large" />
              <Text style={[S.loadingText, { color: C.textMuted }]}>Loading...</Text>
            </View>
          )}

          {/* Error */}
          {quizState === 'error' && (
            <View style={[S.errorBox, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
              <Text style={[S.errorText, { color: C.accent }]}>{error}</Text>
              <Pressable onPress={handleStart}>
                <Text style={[S.tryAgain, { color: C.textMuted }]}>Try again</Text>
              </Pressable>
            </View>
          )}

          {/* Complete */}
          {quizState === 'complete' && (
            <View style={[S.completeCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[S.completeTitle, { color: C.text }]}>Complete!</Text>
              <Text style={[S.completeSubtitle, { color: C.textMuted }]}>
                {category}{rarities.length > 0 ? ` · ${rarities.join(', ')}` : ''}{hardMode ? ' · hard' : ''}{mode === 'sound' ? ' · sound' : ''}
              </Text>
              <View style={S.scoreGrid}>
                <View style={[S.scoreCell, { backgroundColor: C.successLight }]}>
                  <Text style={[S.scoreBigNum, { color: C.success }]}>{score.correct}</Text>
                  <Text style={[S.scoreCellLabel, { color: C.success }]}>Correct</Text>
                </View>
                <View style={[S.scoreCell, { backgroundColor: C.surfaceAlt }]}>
                  <Text style={[S.scoreBigNum, { color: C.accent }]}>{score.wrong}</Text>
                  <Text style={[S.scoreCellLabel, { color: C.accent }]}>Wrong</Text>
                </View>
                <View style={[S.scoreCell, { backgroundColor: C.card }]}>
                  <Text style={[S.scoreBigNum, { color: C.textSecondary }]}>{score.skipped}</Text>
                  <Text style={[S.scoreCellLabel, { color: C.textMuted }]}>Skipped</Text>
                </View>
              </View>
              {accuracy !== null && (
                <Text style={[S.accuracyBig, { color: C.accent }]}>{accuracy}%</Text>
              )}
              <Pressable style={[S.startBtn, { backgroundColor: C.accent }]} onPress={handleStart}>
                <Text style={S.startBtnText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {/* Question */}
          {question && (quizState === 'answering' || quizState === 'revealed' || quizState === 'answered') && (
            <>
              {/* Media */}
              <View style={S.mediaWrap}>
                {question.media.type === 'photo' ? (
                  <View style={S.photoCard}>
                    <Image
                      source={{ uri: resolveUrl(question.media.url) }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    {quizState === 'answered' && (
                      <View style={[S.resultBadge, { backgroundColor: isCorrect ? '#16a34a' : C.accent }]}>
                        <Text style={S.resultBadgeText}>
                          {isCorrect ? 'Correct' : hardMode ? 'Wrong' : `It's: ${question.answer}`}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    <AudioPlayer url={question.media.url} />
                    {quizState === 'answered' && (
                      <View style={[S.resultBadge, { backgroundColor: isCorrect ? '#16a34a' : C.accent }]}>
                        <Text style={S.resultBadgeText}>
                          {isCorrect ? 'Correct' : hardMode ? 'Wrong' : `It's: ${question.answer}`}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Attribution */}
              <Text style={[S.attribution, { color: C.textMuted }]} numberOfLines={1}>
                {question.media.attribution}
              </Text>

              {/* Normal mode */}
              {!hardMode && (
                <>
                  <View style={S.choiceList}>
                    {question.choices.map(choice => {
                      const isSelected = selected === choice;
                      const correct = choice === question.answer;
                      const revealed = quizState === 'answered';
                      let bg = C.surface;
                      let borderColor = C.border;
                      let textColor = C.text;
                      let opacity = 1;
                      if (revealed) {
                        if (correct) {
                          bg = C.successLight;
                          borderColor = C.successBorder;
                          textColor = C.success;
                        } else if (isSelected) {
                          bg = '#fff5f5';
                          borderColor = '#fca5a5';
                          textColor = C.accent;
                        } else {
                          opacity = 0.35;
                        }
                      }
                      return (
                        <Pressable
                          key={choice}
                          onPress={() => handleAnswer(choice)}
                          disabled={revealed}
                          style={[S.choiceBtn, { backgroundColor: bg, borderColor, opacity }]}
                        >
                          <Text style={[S.choiceBtnText, { color: textColor }]}>
                            {revealed && correct ? '✓  ' : ''}
                            {revealed && isSelected && !correct ? '✗  ' : ''}
                            {choice}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {quizState === 'answering' && (
                    <Pressable onPress={handleSkip} style={S.skipBtn}>
                      <Text style={[S.skipText, { color: C.textMuted }]}>Skip</Text>
                    </Pressable>
                  )}
                  {quizState === 'answered' && (
                    <Pressable style={[S.nextBtn, { backgroundColor: C.accent }]} onPress={handleNext}>
                      <Text style={S.nextBtnText}>
                        {currentIndex + 1 >= birdList.length ? 'See Results' : 'Next Bird'}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}

              {/* Hard mode */}
              {hardMode && (
                <>
                  {quizState === 'answering' && (
                    <View style={S.choiceList}>
                      <Pressable style={[S.nextBtn, { backgroundColor: C.accentDark }]} onPress={handleReveal}>
                        <Text style={S.nextBtnText}>Reveal Answer</Text>
                      </Pressable>
                      <Pressable onPress={handleSkip} style={S.skipBtn}>
                        <Text style={[S.skipText, { color: C.textMuted }]}>Skip</Text>
                      </Pressable>
                    </View>
                  )}
                  {quizState === 'revealed' && (
                    <>
                      <View style={[S.revealCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                        <Text style={[S.revealLabel, { color: C.textMuted }]}>Answer</Text>
                        <Text style={[S.revealAnswer, { color: C.text }]}>{question.answer}</Text>
                        <Text style={[S.revealCategory, { color: C.textMuted }]}>{question.category}</Text>
                      </View>
                      <View style={S.selfReportRow}>
                        <Pressable style={[S.selfBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleSelfReport(true)}>
                          <Text style={S.selfBtnText}>Got it</Text>
                        </Pressable>
                        <Pressable style={[S.selfBtn, { backgroundColor: C.accent }]} onPress={() => handleSelfReport(false)}>
                          <Text style={S.selfBtnText}>Missed it</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                  {quizState === 'answered' && (
                    <>
                      {!isCorrect && (
                        <View style={[S.revealCard, { backgroundColor: C.surfaceAlt, borderColor: '#fca5a5', borderWidth: 2 }]}>
                          <Text style={[S.revealLabel, { color: C.accent }]}>Answer</Text>
                          <Text style={[S.revealAnswer, { color: C.text }]}>{question.answer}</Text>
                        </View>
                      )}
                      <Pressable style={[S.nextBtn, { backgroundColor: C.accent }]} onPress={handleNext}>
                        <Text style={S.nextBtnText}>
                          {currentIndex + 1 >= birdList.length ? 'See Results' : 'Next Bird'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: C.header,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },
    badgeRow: { flexDirection: 'row', gap: 4 },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#ffcc00' },
    scoreText: { fontFamily: 'monospace', fontSize: 13, color: '#ffffff' },

    content: { paddingVertical: 16, gap: 16 },

    filters: { gap: 12 },
    filterLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: C.textMuted,
      marginBottom: 6,
    },

    categoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: C.surface,
    },
    categoryBtnText: { fontSize: 14 },
    categoryDropdown: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      backgroundColor: C.surface,
      overflow: 'hidden',
      maxHeight: 260,
    },
    categoryOption: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    categoryOptionText: { fontSize: 14 },

    rarityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    rarityChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
    rarityChipText: { fontSize: 12, fontWeight: '500' },

    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    modeToggle: {
      flexDirection: 'row',
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
    },
    modeBtn: { paddingHorizontal: 14, paddingVertical: 7 },
    modeBtnText: { fontSize: 12, fontWeight: '600' },
    hardRow: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleTrack: {
      width: 44,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
    },
    toggleThumb: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#ffffff',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },

    progressWrap: { gap: 4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText: { fontSize: 10 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    idleWrap: { alignItems: 'center', paddingVertical: 24, gap: 16 },
    idleDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    startBtn: { paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
    startBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    loadingWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    loadingText: { fontSize: 14 },

    errorBox: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      gap: 8,
    },
    errorText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
    tryAgain: { fontSize: 12, textDecorationLine: 'underline' },

    completeCard: {
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      gap: 8,
    },
    completeTitle: { fontSize: 22, fontWeight: '700' },
    completeSubtitle: { fontSize: 12, marginBottom: 8 },
    scoreGrid: { flexDirection: 'row', gap: 8, width: '100%' },
    scoreCell: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
    scoreBigNum: { fontSize: 26, fontWeight: '700' },
    scoreCellLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    accuracyBig: { fontSize: 28, fontWeight: '700' },

    mediaWrap: { width: '100%' },
    photoCard: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: C.card,
    },
    resultBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 99,
    },
    resultBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

    attribution: { fontSize: 10, marginTop: -4 },

    choiceList: { gap: 8, width: '100%' },
    choiceBtn: {
      width: '100%',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 2,
    },
    choiceBtnText: { fontSize: 14, fontWeight: '500' },

    skipBtn: { alignSelf: 'center', paddingVertical: 4 },
    skipText: { fontSize: 12, textDecorationLine: 'underline' },
    nextBtn: {
      width: '100%',
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
    },
    nextBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    revealCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      gap: 2,
    },
    revealLabel: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    revealAnswer: { fontSize: 20, fontWeight: '700' },
    revealCategory: { fontSize: 12 },
    selfReportRow: { flexDirection: 'row', gap: 8 },
    selfBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    selfBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  });
}
