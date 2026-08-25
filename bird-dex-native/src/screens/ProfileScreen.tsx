import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useApp } from '../AppContext';
import { useTheme } from '../ThemeContext';
import { api } from '../api';
import { capitalize, REGIONS, type ThemeColors } from '../theme';
import type { User } from '../types';
import type { RootTabParamList } from '../types';
import AuthModal from '../components/AuthModal';

type Nav = BottomTabNavigationProp<RootTabParamList>;

export default function ProfileScreen() {
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const {
    authUsername, viewUsername, region, birds, friends,
    login, logout, switchViewUser, switchRegion,
  } = useApp();

  const [showAuth, setShowAuth] = useState(false);
  const [myFriends, setMyFriends] = useState<User[]>([]);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [switchingRegion, setSwitchingRegion] = useState(false);

  const totalBirds = birds.length;
  const lifeCount = birds.filter(b => b.discovered).length;
  const currentYear = String(new Date().getFullYear());
  const yearCount = birds.filter(
    b => b.discovered && (b.discovered_at ?? '').startsWith(currentYear)
  ).length;

  // Load the auth user's own friends when signed in
  useEffect(() => {
    if (!authUsername) { setMyFriends([]); return; }
    if (authUsername === viewUsername) {
      setMyFriends(friends);
    } else {
      api.getUserFriends(authUsername).then(setMyFriends).catch(() => {});
    }
  }, [authUsername, viewUsername, friends]);

  async function handleAddFriend() {
    const name = addInput.trim().toLowerCase();
    if (!name || !authUsername) return;
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addFriend(authUsername, name);
      setMyFriends(updated);
      setAddInput('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveFriend(username: string) {
    if (!authUsername) return;
    try {
      const updated = await api.removeFriend(authUsername, username);
      setMyFriends(updated);
    } catch { /* silent */ }
  }

  function viewFriend(username: string) {
    switchViewUser(username);
    navigation.navigate('BirdDexTab');
  }

  async function handleSwitchRegion(newRegion: string) {
    if (newRegion === region || switchingRegion || !authUsername) return;
    setSwitchingRegion(true);
    try {
      await switchRegion(newRegion);
    } catch {
      Alert.alert('Error', 'Failed to switch region.');
    } finally {
      setSwitchingRegion(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign out', `Sign out of ${capitalize(authUsername!)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['left', 'right']}>
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + 14 }]}>
          <Text style={S.headerTitle}>Profile</Text>
        </View>

        {!authUsername ? (
          // ── Not signed in ──
          <View style={S.signInPane}>
            <View style={S.signInCard}>
              <Text style={S.signInTitle}>Track your birds</Text>
              <Text style={S.signInBody}>
                Sign in to keep track of every species you have spotted, add field notes, upload photos, and compare lists with friends.
              </Text>
              <Pressable style={S.signInBtn} onPress={() => setShowAuth(true)}>
                <Text style={S.signInBtnText}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // ── Signed in ──
          <ScrollView
            style={S.scroll}
            contentContainerStyle={S.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar + name */}
            <View style={S.profileHeader}>
              <View style={S.avatar}>
                <Text style={S.avatarText}>
                  {authUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={S.profileInfo}>
                <Text style={S.profileName}>{capitalize(authUsername)}</Text>
                <Text style={S.profileRegion}>{REGIONS[region]?.label ?? region}</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={S.statsRow}>
              <View style={S.statCell}>
                <Text style={S.statNum}>{yearCount}</Text>
                <Text style={S.statLabel}>This year</Text>
              </View>
              <View style={[S.statCell, S.statCellMid]}>
                <Text style={S.statNum}>{lifeCount}</Text>
                <Text style={S.statLabel}>Life list</Text>
              </View>
              <View style={S.statCell}>
                <Text style={S.statNum}>{totalBirds}</Text>
                <Text style={S.statLabel}>Total birds</Text>
              </View>
            </View>

            {/* Region */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Region</Text>
              <View style={S.regionRow}>
                {Object.entries(REGIONS).map(([code, info]) => (
                  <Pressable
                    key={code}
                    onPress={() => handleSwitchRegion(code)}
                    style={[S.regionBtn, region === code && S.regionBtnActive]}
                  >
                    {switchingRegion && region !== code ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <>
                        <Text style={[S.regionBtnCode, region === code && S.regionBtnCodeActive]}>
                          {code}
                        </Text>
                        <Text style={[S.regionBtnLabel, region === code && S.regionBtnLabelActive]}
                          numberOfLines={1}
                        >
                          {info.label}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Friends */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Friends</Text>

              {/* Add friend */}
              <View style={S.addRow}>
                <TextInput
                  style={[S.addInput, addError ? S.addInputError : null]}
                  value={addInput}
                  onChangeText={t => { setAddInput(t); setAddError(''); }}
                  placeholder="Add by username"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleAddFriend}
                />
                <Pressable
                  style={[S.addBtn, (!addInput.trim() || addLoading) && S.addBtnDisabled]}
                  onPress={handleAddFriend}
                  disabled={!addInput.trim() || addLoading}
                >
                  {addLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={S.addBtnText}>Add</Text>
                  }
                </Pressable>
              </View>
              {addError ? <Text style={S.addError}>{addError}</Text> : null}

              {/* Friends list */}
              {myFriends.filter(f => f.username !== authUsername).length === 0 ? (
                <Text style={S.emptyFriends}>No friends yet.</Text>
              ) : (
                myFriends
                  .filter(f => f.username !== authUsername)
                  .map(f => (
                    <View key={f.username} style={S.friendRow}>
                      <Pressable
                        style={S.friendInfo}
                        onPress={() => viewFriend(f.username)}
                      >
                        <View style={S.friendAvatar}>
                          <Text style={S.friendAvatarText}>
                            {f.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={S.friendName}>{capitalize(f.username)}</Text>
                          <Text style={S.friendRegion}>{f.region}</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveFriend(f.username)}
                        hitSlop={12}
                        style={S.removeBtn}
                      >
                        <Text style={S.removeText}>×</Text>
                      </Pressable>
                    </View>
                  ))
              )}
            </View>

            {/* Sign out */}
            <Pressable style={S.signOutBtn} onPress={handleLogout}>
              <Text style={S.signOutText}>Sign out</Text>
            </Pressable>

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(username, token) => {
          login(username, token);
          setShowAuth(false);
        }}
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    header: {
      backgroundColor: C.header,
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    headerTitle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    signInPane: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    signInCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 28,
      width: '100%',
      maxWidth: 360,
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 16,
      elevation: 4,
      borderWidth: 1,
      borderColor: C.border,
    },
    signInTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text,
      marginBottom: 10,
    },
    signInBody: {
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 21,
      marginBottom: 24,
    },
    signInBtn: {
      backgroundColor: C.accent,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
    },
    signInBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 20 },

    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: C.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#ffffff',
      fontSize: 26,
      fontWeight: '700',
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    profileRegion: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },

    statsRow: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 20,
      overflow: 'hidden',
    },
    statCell: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
    },
    statCellMid: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: C.border,
    },
    statNum: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text,
    },
    statLabel: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    section: { marginBottom: 24 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
    },

    regionRow: { flexDirection: 'row', gap: 8 },
    regionBtn: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    regionBtnActive: {
      borderColor: C.accent,
      backgroundColor: C.surfaceAlt,
    },
    regionBtnCode: {
      fontSize: 16,
      fontWeight: '700',
      color: C.textSecondary,
    },
    regionBtnCodeActive: {
      color: C.accent,
    },
    regionBtnLabel: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    regionBtnLabelActive: {
      color: C.textSecondary,
    },

    addRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: C.text,
      backgroundColor: C.surface,
    },
    addInputError: { borderColor: '#ef4444' },
    addBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.accent,
      justifyContent: 'center',
    },
    addBtnDisabled: { opacity: 0.45 },
    addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
    addError: { fontSize: 12, color: '#ef4444', marginBottom: 8 },

    emptyFriends: {
      color: C.textMuted,
      fontSize: 13,
      paddingVertical: 12,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    friendInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    friendAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.surfaceAlt,
      borderWidth: 1,
      borderColor: C.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendAvatarText: {
      fontSize: 15,
      fontWeight: '700',
      color: C.textSecondary,
    },
    friendName: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    friendRegion: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 1,
    },
    removeBtn: { padding: 8 },
    removeText: { fontSize: 20, color: '#ef4444', lineHeight: 20 },

    signOutBtn: {
      marginTop: 8,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    signOutText: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textSecondary,
    },
  });
}
