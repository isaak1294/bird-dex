import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../AppContext';
import { useTheme } from '../ThemeContext';
import { RARITY, REGIONS, getRarity, capitalize, type ThemeColors } from '../theme';
import type { Bird, BirdDexStackParamList } from '../types';
import BirdCard from '../components/BirdCard';
import CategoryDrawer from '../components/CategoryDrawer';
import AuthModal from '../components/AuthModal';

type Props = NativeStackScreenProps<BirdDexStackParamList, 'BirdDexHome'>;

const GAP = 8;
const SEARCH_BAR_MAX_HEIGHT = 100;

function getNumColumns() {
  const w = Dimensions.get('window').width;
  if (w >= 600) return 3;
  return 2;
}

function getCardWidth(numCols: number) {
  const w = Dimensions.get('window').width;
  return (w - GAP * (numCols + 1)) / numCols;
}

export default function BirddexScreen({ navigation }: Props) {
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const {
    authUsername, viewUsername, region, birds, friends,
    loading, error, isOwner,
    login, switchViewUser, switchRegion, refreshBirds,
  } = useApp();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [targetOnly, setTargetOnly] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRegionMenu, setShowRegionMenu] = useState(false);
  const [switchingRegion, setSwitchingRegion] = useState(false);

  // Collapsible search bar
  const searchAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const searchVisible = useRef(true);

  const searchMaxHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SEARCH_BAR_MAX_HEIGHT],
  });

  const numCols = getNumColumns();
  const cardWidth = getCardWidth(numCols);

  const baseBirds = useMemo(
    () => (targetOnly ? birds.filter(b => b.is_target === 1) : birds),
    [birds, targetOnly]
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

  const totalDiscovered = useMemo(
    () => baseBirds.filter(b => b.discovered).length,
    [baseBirds]
  );

  const filteredBirds = useMemo(() => {
    let list = baseBirds;
    if (discoveredOnly) list = list.filter(b => b.discovered === 1);
    if (activeCategory !== 'All') list = list.filter(b => b.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }
    const RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    return [...list].sort((a, b) => {
      const ra = getRarity(a.frequency), rb = getRarity(b.frequency);
      const rankA = ra ? RANK[ra] : -1, rankB = rb ? RANK[rb] : -1;
      if (rankA !== rankB) return rankB - rankA;
      const cc = a.category.localeCompare(b.category);
      return cc !== 0 ? cc : a.name.localeCompare(b.name);
    });
  }, [baseBirds, activeCategory, search, discoveredOnly]);

  function handleBirdPress(bird: Bird, index: number) {
    const prevBirdId = index > 0 ? filteredBirds[index - 1].id : null;
    const nextBirdId = index < filteredBirds.length - 1 ? filteredBirds[index + 1].id : null;
    navigation.push('BirdDetail', { birdId: bird.id, prevBirdId, nextBirdId });
  }

  function handleScroll({ nativeEvent }: any) {
    const y = nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    lastScrollY.current = y;

    if (dy > 4 && y > 40 && searchVisible.current) {
      searchVisible.current = false;
      Animated.timing(searchAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    } else if (dy < -4 && !searchVisible.current) {
      searchVisible.current = true;
      Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    }
  }

  async function handleSwitchRegion(newRegion: string) {
    if (newRegion === region || switchingRegion) return;
    setSwitchingRegion(true);
    setShowRegionMenu(false);
    try {
      await switchRegion(newRegion);
    } catch {
      Alert.alert('Error', 'Failed to switch region.');
    } finally {
      setSwitchingRegion(false);
    }
  }

  function handleAuthSuccess(name: string, token: string) {
    login(name, token);
    switchViewUser(name);
  }

  const renderItem = useCallback(({ item, index }: { item: Bird; index: number }) => (
    <BirdCard
      bird={item}
      cardWidth={cardWidth}
      onPress={() => handleBirdPress(item, index)}
    />
  ), [cardWidth, filteredBirds]);

  const keyExtractor = useCallback((item: Bird) => String(item.id), []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={[S.center, { backgroundColor: C.bg }]} edges={['left', 'right']}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={{ color: C.textMuted, marginTop: 12, fontSize: 14 }}>Loading birds...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={[S.center, { backgroundColor: C.bg }]} edges={['left', 'right']}>
          <Text style={{ color: C.accent, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          <Pressable
            style={{ backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={() => switchViewUser(viewUsername)}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={S.root} edges={['left', 'right']}>
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDrawerOpen(true); }}
            style={S.hamburger}
          >
            <HamburgerLines />
          </Pressable>

          <View style={S.titleArea}>
            {authUsername ? (
              <Pressable onPress={() => setShowUserMenu(v => !v)} style={S.titleBtn}>
                <Text style={S.titleText}>{capitalize(viewUsername)}</Text>
                <Text style={S.chevron}>▾</Text>
              </Pressable>
            ) : (
              <Text style={S.titleText}>{capitalize(viewUsername)}</Text>
            )}
            <Text style={S.titleMuted}>'s </Text>
            {isOwner ? (
              <Pressable
                onPress={() => setShowRegionMenu(v => !v)}
                disabled={switchingRegion}
                style={S.titleBtn}
              >
                <Text style={S.titleText}>{switchingRegion ? '...' : region}</Text>
                <Text style={S.chevron}>▾</Text>
              </Pressable>
            ) : (
              <Text style={S.titleText}>{region}</Text>
            )}
            <Text style={S.titleMuted}> BirdDex</Text>
          </View>

          <Text style={S.scoreText}>
            {totalDiscovered}
            <Text style={{ color: 'rgba(255,255,255,0.4)' }}>/{baseBirds.length}</Text>
          </Text>
        </View>

        {/* User dropdown */}
        {showUserMenu && (
          <Modal transparent animationType="fade" onRequestClose={() => setShowUserMenu(false)}>
            <Pressable style={S.menuBackdrop} onPress={() => setShowUserMenu(false)}>
              <View style={[S.menuSheet, { top: 54, backgroundColor: C.surface }]}>
                {friends.map(u => (
                  <Pressable
                    key={u.username}
                    style={S.menuItem}
                    onPress={() => {
                      setShowUserMenu(false);
                      switchViewUser(u.username);
                      setActiveCategory('All');
                    }}
                  >
                    <Text style={[S.menuItemText, { color: C.text }, u.username === viewUsername && { color: C.accent, fontWeight: '700' }]}>
                      {capitalize(u.username)}
                    </Text>
                    <Text style={[S.menuItemSub, { color: C.textMuted }]}>{u.region}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Region dropdown */}
        {showRegionMenu && isOwner && (
          <Modal transparent animationType="fade" onRequestClose={() => setShowRegionMenu(false)}>
            <Pressable style={S.menuBackdrop} onPress={() => setShowRegionMenu(false)}>
              <View style={[S.menuSheet, { top: 54, right: 12, backgroundColor: C.surface }]}>
                {Object.entries(REGIONS).map(([code, info]) => (
                  <Pressable
                    key={code}
                    style={S.menuItem}
                    onPress={() => handleSwitchRegion(code)}
                  >
                    <Text style={[S.menuItemText, { color: C.text }, code === region && { color: C.accent, fontWeight: '700' }]}>
                      {info.label}
                    </Text>
                    <Text style={[S.menuItemSub, { color: C.textMuted }]}>{code}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Collapsible Search + Filters */}
        <Animated.View style={{ maxHeight: searchMaxHeight, overflow: 'hidden', opacity: searchAnim }}>
          <View style={S.searchBar}>
            <View style={S.searchInputWrap}>
              <SearchIcon color={C.textMuted} />
              <TextInput
                style={[S.searchInput, { color: C.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search birds..."
                placeholderTextColor={C.textMuted}
                clearButtonMode="while-editing"
              />
            </View>
            <View style={S.filterRow}>
              <Text style={[S.filterCount, { color: C.textMuted }]}>
                {filteredBirds.filter(b => b.discovered).length}/{filteredBirds.length} bird{filteredBirds.length !== 1 ? 's' : ''}
                {activeCategory !== 'All' ? ` · ${activeCategory}` : ''}
                {search ? ` · "${search}"` : ''}
              </Text>
              <View style={S.toggles}>
                <Pressable
                  onPress={() => setDiscoveredOnly(v => !v)}
                  style={[S.toggle, { borderColor: C.border, backgroundColor: C.surface }, discoveredOnly && { backgroundColor: C.successLight, borderColor: C.successBorder }]}
                >
                  <Text style={[S.toggleText, { color: C.textMuted }, discoveredOnly && { color: C.success }]}>
                    {discoveredOnly ? '★' : '☆'} Seen
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setTargetOnly(v => !v); setActiveCategory('All'); }}
                  style={[S.toggle, { borderColor: C.border, backgroundColor: C.surface }, targetOnly && { backgroundColor: C.surfaceAlt, borderColor: C.accent }]}
                >
                  <Text style={[S.toggleText, { color: C.textMuted }, targetOnly && { color: C.accent }]}>
                    {targetOnly ? '◉' : '○'} {targetOnly ? 'Target' : 'All'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Bird grid */}
        {filteredBirds.length === 0 ? (
          <View style={S.empty}>
            <Text style={{ color: C.textMuted, fontSize: 14 }}>No birds found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBirds}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            numColumns={numCols}
            key={numCols}
            contentContainerStyle={S.grid}
            columnWrapperStyle={numCols > 1 ? S.row : undefined}
            showsVerticalScrollIndicator={false}
            initialNumToRender={16}
            maxToRenderPerBatch={12}
            windowSize={8}
            removeClippedSubviews
            onRefresh={refreshBirds}
            refreshing={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )}

        <CategoryDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          categories={categories}
          total={baseBirds.length}
          activeCategory={activeCategory}
          onSelectCategory={cat => setActiveCategory(cat)}
        />

        <AuthModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </SafeAreaView>
    </View>
  );
}

function HamburgerLines() {
  return (
    <View style={{ gap: 4 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ width: 18, height: 2, backgroundColor: '#ffffff', borderRadius: 1 }} />
      ))}
    </View>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" style={{ marginRight: 6 }}>
      <Path
        d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.header,
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 10,
    },
    hamburger: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titleArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
    },
    titleBtn: { flexDirection: 'row', alignItems: 'center' },
    titleText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
    titleMuted: { color: 'rgba(255,255,255,0.45)', fontWeight: '400', fontSize: 15 },
    chevron: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginLeft: 2 },
    scoreText: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
      flexShrink: 0,
    },
    menuBackdrop: { flex: 1 },
    menuSheet: {
      position: 'absolute',
      left: 12,
      borderRadius: 14,
      paddingVertical: 4,
      minWidth: 180,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    menuItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    menuItemText: { fontSize: 14 },
    menuItemSub: { fontSize: 12, marginLeft: 12 },
    searchBar: {
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 6,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceAlt,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
    },
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    filterCount: { fontSize: 11, flex: 1, marginRight: 8 },
    toggles: { flexDirection: 'row', gap: 6 },
    toggle: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
    },
    toggleText: { fontSize: 11, fontWeight: '600' },
    grid: { padding: GAP, paddingBottom: 20 },
    row: { gap: GAP },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
}
