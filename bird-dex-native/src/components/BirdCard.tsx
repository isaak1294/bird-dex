import React, { memo, useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { RARITY, getRarity, type ThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';
import { resolveUrl } from '../config';
import BirdIcon from './BirdIcon';
import type { Bird } from '../types';

type Props = { bird: Bird; cardWidth: number; onPress: () => void };

function BirdCard({ bird, cardWidth, onPress }: Props) {
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);

  const discovered = bird.discovered === 1;
  const rarity = getRarity(bird.frequency);
  const rarityInfo = rarity ? RARITY[rarity] : null;

  const coverPhoto = bird.cover_photo_id
    ? (bird.photos.find(p => p.id === bird.cover_photo_id) ?? bird.photos[0])
    : bird.photos[0];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.card,
        {
          width: cardWidth,
          borderColor: discovered ? C.successBorder : C.border,
          backgroundColor: discovered ? C.successLight : C.surface,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[S.imageArea, { backgroundColor: discovered ? C.successLight : C.surfaceAlt }]}>
        {coverPhoto ? (
          <Image source={{ uri: resolveUrl(coverPhoto.url) }} style={S.image} resizeMode="cover" />
        ) : (
          <BirdIcon size={38} discovered={discovered} />
        )}
        {rarityInfo && (
          <View style={[S.rarityDot, { backgroundColor: rarityInfo.bg }]} />
        )}
        {discovered && (
          <View style={S.checkBadge}>
            <Text style={S.checkText}>✓</Text>
          </View>
        )}
      </View>

      <View style={S.nameRow}>
        <Text
          style={[S.name, { color: discovered ? C.success : C.textSecondary }]}
          numberOfLines={1}
        >
          {bird.name}
        </Text>
        {rarityInfo && (
          <Text style={[S.rarityLabel, { color: rarityInfo.bg }]}>{rarityInfo.label}</Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: 8,
    },
    imageArea: {
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    rarityDot: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    checkBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkText: {
      fontSize: 10,
      color: '#ffffff',
      fontWeight: '700',
      lineHeight: 12,
    },
    nameRow: {
      paddingHorizontal: 8,
      paddingTop: 6,
      paddingBottom: 7,
    },
    name: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 15,
    },
    rarityLabel: {
      fontSize: 9,
      fontWeight: '600',
      marginTop: 1,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
  });
}

export default memo(BirdCard);
