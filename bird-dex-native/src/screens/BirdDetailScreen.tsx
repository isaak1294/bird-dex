import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

import { useApp } from '../AppContext';
import { useTheme } from '../ThemeContext';
import { api } from '../api';
import { resolveUrl } from '../config';
import { getRarity, RARITY, type ThemeColors } from '../theme';
import type { BirdDexStackParamList, Photo } from '../types';
import BirdIcon from '../components/BirdIcon';

type Props = NativeStackScreenProps<BirdDexStackParamList, 'BirdDetail'>;

const { width: SCREEN_W } = Dimensions.get('window');

export default function BirdDetailScreen({ navigation, route }: Props) {
  const { birdId, prevBirdId, nextBirdId } = route.params;
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);
  const { birds, isOwner, viewUsername, updateBird } = useApp();

  const initialBird = birds.find(b => b.id === birdId);
  const [bird, setBird] = useState(initialBird ?? null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fieldNotes, setFieldNotes] = useState(initialBird?.field_notes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [caption, setCaption] = useState('');
  const flatRef = useRef<FlatList>(null);

  if (!bird) {
    return (
      <View style={[S.center, { backgroundColor: C.bg }]}>
        <Text style={{ color: C.textMuted }}>Bird not found.</Text>
      </View>
    );
  }

  const discovered = bird.discovered === 1;
  const photos = bird.photos;
  const safeIndex = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const activePhoto = photos[safeIndex] ?? null;
  const coverPhotoId = bird.cover_photo_id ?? photos[0]?.id ?? null;
  const rarity = getRarity(bird.frequency);
  const rarityInfo = rarity ? RARITY[rarity] : null;

  function syncBird(updated: typeof bird) {
    setBird(updated);
    updateBird(updated);
  }

  async function toggleDiscovered() {
    const next = discovered ? 0 : 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updated = await api.patchBird(viewUsername, bird.id, { discovered: next as 0 | 1 });
      syncBird(updated);
    } catch {
      Alert.alert('Error', 'Could not update discovered status.');
    }
  }

  async function saveNotes() {
    try {
      const updated = await api.patchBird(viewUsername, bird.id, { field_notes: fieldNotes });
      syncBird(updated);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'Could not save notes.');
    }
  }

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to photos in settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: result.assets.length });
    const newPhotos: Photo[] = [];

    for (const asset of result.assets) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1920 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        const photo = await api.uploadPhoto(viewUsername, bird.id, compressed.uri, caption);
        newPhotos.push(photo);
      } catch (e) {
        console.warn('Upload failed for one photo:', e);
      }
      setUploadProgress(p => ({ ...p, done: p.done + 1 }));
    }

    if (newPhotos.length > 0) {
      const updatedPhotos = [...bird.photos, ...newPhotos];
      const updatedBird = { ...bird, discovered: 1 as const, photos: updatedPhotos };
      syncBird(updatedBird);
      const newIndex = updatedPhotos.length - 1;
      setPhotoIndex(newIndex);
      setTimeout(() => flatRef.current?.scrollToIndex({ index: newIndex, animated: true }), 100);
      setCaption('');
    }

    setUploading(false);
  }

  async function deletePhoto() {
    if (!activePhoto) return;
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deletePhoto(viewUsername, bird.id, activePhoto.id);
          const remaining = bird.photos.filter(p => p.id !== activePhoto.id);
          syncBird({ ...bird, photos: remaining });
          setPhotoIndex(i => Math.min(i, Math.max(0, remaining.length - 1)));
        },
      },
    ]);
  }

  async function setCover(photoId: number) {
    const updated = await api.patchBird(viewUsername, bird.id, { cover_photo_id: photoId });
    syncBird(updated);
  }

  function navigateTo(id: number | null) {
    if (!id) return;
    navigation.replace('BirdDetail', { birdId: id, prevBirdId: null, nextBirdId: null });
  }

  const photoAreaWidth = SCREEN_W - 32;
  const photoAreaHeight = photoAreaWidth * 0.75;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => navigation.goBack()} style={S.backBtn} hitSlop={8}>
            <Text style={S.backText}>Back</Text>
          </Pressable>
          <Text style={S.headerTitle} numberOfLines={1}>{bird.name}</Text>
          <View style={S.navBtns}>
            {prevBirdId && (
              <Pressable onPress={() => navigateTo(prevBirdId)} style={S.navBtn}>
                <Text style={S.navBtnText}>Prev</Text>
              </Pressable>
            )}
            {nextBirdId && (
              <Pressable onPress={() => navigateTo(nextBirdId)} style={S.navBtn}>
                <Text style={S.navBtnText}>Next</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={S.body}>
          {/* Photo viewer */}
          <View
            style={[
              S.photoArea,
              {
                width: photoAreaWidth,
                height: photoAreaHeight,
                backgroundColor: discovered ? C.successLight : C.surfaceAlt,
                borderColor: discovered ? C.successBorder : C.border,
              },
            ]}
          >
            {activePhoto ? (
              <Image
                source={{ uri: resolveUrl(activePhoto.url) }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            ) : (
              <View style={S.noPhotoWrap}>
                <BirdIcon size={80} discovered={discovered} />
                <Text style={{ color: discovered ? C.success : C.textMuted, marginTop: 8, fontSize: 13 }}>
                  {discovered ? 'No photos yet' : 'Undiscovered'}
                </Text>
              </View>
            )}

            {photos.length > 1 && safeIndex > 0 && (
              <Pressable onPress={() => setPhotoIndex(i => i - 1)} style={[S.arrowBtn, { left: 8 }]}>
                <Text style={S.arrowText}>‹</Text>
              </Pressable>
            )}
            {photos.length > 1 && safeIndex < photos.length - 1 && (
              <Pressable onPress={() => setPhotoIndex(i => i + 1)} style={[S.arrowBtn, { right: 8 }]}>
                <Text style={S.arrowText}>›</Text>
              </Pressable>
            )}
            {photos.length > 1 && (
              <View style={S.photoCounter}>
                <Text style={S.photoCounterText}>{safeIndex + 1} / {photos.length}</Text>
              </View>
            )}
          </View>

          {/* Caption + delete */}
          {activePhoto && isOwner && (
            <View style={S.captionRow}>
              {activePhoto.caption
                ? <Text style={[S.caption, { color: C.textSecondary }]} numberOfLines={2}>"{activePhoto.caption}"</Text>
                : <View style={{ flex: 1 }} />
              }
              <Pressable onPress={deletePhoto}>
                <Text style={{ color: '#ef4444', fontSize: 13 }}>Delete photo</Text>
              </Pressable>
            </View>
          )}
          {activePhoto && !isOwner && !!activePhoto.caption && (
            <Text style={[S.caption, { color: C.textSecondary }]}>"{activePhoto.caption}"</Text>
          )}

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <FlatList
              ref={flatRef}
              data={photos}
              horizontal
              keyExtractor={p => String(p.id)}
              showsHorizontalScrollIndicator={false}
              style={S.thumbStrip}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              renderItem={({ item, index }) => {
                const isActive = index === safeIndex;
                const isCover = item.id === coverPhotoId;
                return (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Pressable onPress={() => setPhotoIndex(index)}>
                      <Image
                        source={{ uri: resolveUrl(item.url) }}
                        style={[
                          S.thumb,
                          { borderColor: isActive ? C.success : C.border, opacity: isActive ? 1 : 0.5 },
                        ]}
                      />
                    </Pressable>
                    {isOwner && (
                      <Pressable onPress={() => setCover(item.id)}>
                        <Text style={{ color: isCover ? C.gold : C.textMuted, fontSize: 14 }}>
                          {isCover ? '★' : '☆'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              }}
            />
          )}

          {/* Info card */}
          <View style={[S.card, { borderColor: discovered ? C.successBorder : C.border }]}>
            <View style={S.cardTopRow}>
              <Text style={[S.birdCategory, { color: C.textSecondary }]}>{bird.category}</Text>
              <View style={[
                S.statusBadge,
                { backgroundColor: discovered ? C.successLight : C.surfaceAlt },
              ]}>
                <Text style={[S.statusText, { color: discovered ? C.success : C.textMuted }]}>
                  {discovered ? 'DISCOVERED' : 'UNDISCOVERED'}
                </Text>
              </View>
            </View>
            <Text style={[S.birdName, { color: C.text }]}>{bird.name}</Text>
            {rarityInfo && (
              <View style={[S.rarityBadge, { backgroundColor: rarityInfo.bg, alignSelf: 'flex-start' }]}>
                <Text style={[S.rarityLabel, { color: rarityInfo.color }]}>{rarityInfo.label}</Text>
              </View>
            )}
          </View>

          {/* Toggle discovered */}
          {isOwner && (
            <Pressable
              onPress={toggleDiscovered}
              style={[
                S.actionBtn,
                discovered
                  ? { backgroundColor: C.successLight, borderWidth: 1, borderColor: C.successBorder }
                  : { backgroundColor: C.accent },
              ]}
            >
              <Text style={[S.actionBtnText, { color: discovered ? C.success : '#ffffff' }]}>
                {discovered ? 'Mark as Undiscovered' : 'Mark as Discovered'}
              </Text>
            </Pressable>
          )}

          {/* Photo upload */}
          {isOwner && (
            <View style={S.card}>
              <Text style={[S.sectionLabel, { color: C.textMuted }]}>Add Photos</Text>
              <TextInput
                style={[S.input, { borderColor: C.border, color: C.text, backgroundColor: C.surfaceAlt }]}
                value={caption}
                onChangeText={setCaption}
                placeholder="Caption (applied to all)"
                placeholderTextColor={C.textMuted}
              />
              <Pressable
                onPress={pickAndUpload}
                disabled={uploading}
                style={[S.uploadBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }, uploading && { opacity: 0.6 }]}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color={C.textSecondary} size="small" />
                    <Text style={[S.uploadBtnText, { color: C.textSecondary }]}>
                      {uploadProgress.done}/{uploadProgress.total} uploading...
                    </Text>
                  </>
                ) : (
                  <Text style={[S.uploadBtnText, { color: C.textSecondary }]}>Choose Photos</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Field notes */}
          <View style={S.card}>
            <View style={S.notesHeader}>
              <Text style={[S.sectionLabel, { color: C.textMuted }]}>Field Notes</Text>
              {notesSaved && <Text style={{ fontSize: 12, color: C.success }}>Saved</Text>}
            </View>
            {isOwner ? (
              <>
                <TextInput
                  style={[S.notesInput, { borderColor: C.border, color: C.text, backgroundColor: C.surfaceAlt }]}
                  value={fieldNotes}
                  onChangeText={setFieldNotes}
                  placeholder="Record your observations: location, date, behaviour, plumage details..."
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
                <Pressable onPress={saveNotes} style={[S.saveBtn, { backgroundColor: C.accent }]}>
                  <Text style={S.saveBtnText}>Save Notes</Text>
                </Pressable>
              </>
            ) : (
              <Text style={[S.notesReadonly, { color: bird.field_notes ? C.text : C.textMuted }]}>
                {bird.field_notes || 'No field notes recorded.'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      backgroundColor: C.header,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingBottom: 12,
      gap: 8,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
    headerTitle: { flex: 1, color: '#ffffff', fontWeight: '700', fontSize: 16 },
    navBtns: { flexDirection: 'row', gap: 6 },
    navBtn: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    navBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
    body: { padding: 16, gap: 12 },
    photoArea: {
      borderRadius: 16,
      borderWidth: 2,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
    },
    noPhotoWrap: { justifyContent: 'center', alignItems: 'center' },
    arrowBtn: {
      position: 'absolute',
      top: '50%',
      marginTop: -20,
      width: 36,
      height: 40,
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    arrowText: { fontSize: 20, color: '#1a2f40', lineHeight: 22 },
    photoCounter: {
      position: 'absolute',
      bottom: 8,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    photoCounterText: { color: '#ffffff', fontSize: 11, fontVariant: ['tabular-nums'] },
    captionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      gap: 8,
    },
    caption: { fontSize: 12, fontStyle: 'italic', flex: 1 },
    thumbStrip: { maxHeight: 80 },
    thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2 },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      gap: 8,
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    birdCategory: { fontSize: 13 },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
    },
    statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    birdName: { fontSize: 24, fontWeight: '700' },
    rarityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    rarityLabel: { fontSize: 11, fontWeight: '700' },
    actionBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    actionBtnText: { fontSize: 15, fontWeight: '700' },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
    },
    uploadBtn: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    uploadBtnText: { fontSize: 14, fontWeight: '500' },
    notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    notesInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
      minHeight: 140,
      lineHeight: 20,
    },
    saveBtn: {
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      alignSelf: 'flex-end',
      paddingHorizontal: 24,
    },
    saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
    notesReadonly: {
      fontSize: 13,
      lineHeight: 20,
      fontStyle: 'italic',
    },
  });
}
