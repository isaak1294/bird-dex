import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import type { ThemeColors } from '../theme';

type Category = { category: string; total: number; discovered: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  total: number;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
};

const DRAWER_WIDTH = 240;

export default function CategoryDrawer({
  visible, onClose, categories, total, activeCategory, onSelectCategory,
}: Props) {
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  function select(cat: string) {
    onSelectCategory(cat);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={S.overlay}>
        <Pressable style={S.backdrop} onPress={onClose} />
        <Animated.View style={[S.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={S.header}>
            <Text style={S.headerLabel}>CATEGORIES</Text>
            <Pressable onPress={onClose} hitSlop={12} style={S.closeBtn}>
              <Text style={S.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => select('All')}
              style={[S.catRow, activeCategory === 'All' && { backgroundColor: C.accent }]}
            >
              <Text style={[S.catName, activeCategory === 'All' && S.catNameActive]}>All</Text>
              <Text style={[S.catCount, activeCategory === 'All' && { color: 'rgba(255,255,255,0.7)' }]}>
                {total}
              </Text>
            </Pressable>

            {categories.map(cat => {
              const active = activeCategory === cat.category;
              return (
                <Pressable
                  key={cat.category}
                  onPress={() => select(cat.category)}
                  style={[S.catRow, active && { backgroundColor: C.accentDark }]}
                >
                  <Text
                    style={[S.catName, S.catNameSmall, active && S.catNameActive]}
                    numberOfLines={1}
                  >
                    {cat.category}
                  </Text>
                  <Text style={[S.catCount, active && { color: 'rgba(255,255,255,0.7)' }]}>
                    {cat.discovered}/{cat.total}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawer: {
      width: DRAWER_WIDTH,
      backgroundColor: C.sidebar,
      borderRightWidth: 1,
      borderRightColor: C.sidebarBorder,
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: C.textMuted,
      letterSpacing: 1.5,
    },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 20, color: C.textSecondary, lineHeight: 20 },
    catRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginHorizontal: 6,
      marginBottom: 2,
      borderRadius: 8,
    },
    catName: {
      fontSize: 13,
      color: C.textSecondary,
      flex: 1,
      marginRight: 6,
      fontWeight: '500',
    },
    catNameSmall: { fontSize: 12 },
    catNameActive: { color: '#ffffff', fontWeight: '700' },
    catCount: {
      fontSize: 10,
      fontVariant: ['tabular-nums'],
      color: C.textMuted,
    },
  });
}
