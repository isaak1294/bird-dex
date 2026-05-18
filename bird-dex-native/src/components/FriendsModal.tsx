import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, capitalize } from '../theme';
import { api } from '../api';
import type { User } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  username: string;
  initialFriends: User[];
  onFriendsChange: (friends: User[]) => void;
  onNavigateToUser: (username: string) => void;
};

export default function FriendsModal({
  visible, onClose, username, initialFriends, onFriendsChange, onNavigateToUser,
}: Props) {
  const [friends, setFriends] = useState<User[]>(initialFriends);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Keep local friends in sync when prop changes
  React.useEffect(() => { setFriends(initialFriends); }, [initialFriends]);

  async function handleAdd() {
    const name = addInput.trim().toLowerCase();
    if (!name) return;
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addFriend(username, name);
      setFriends(updated);
      onFriendsChange(updated);
      setAddInput('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(friendUsername: string) {
    try {
      const updated = await api.removeFriend(username, friendUsername);
      setFriends(updated);
      onFriendsChange(updated);
    } catch { /* ignore */ }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <Text style={styles.title}>Friends</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.closeX}>×</Text>
              </Pressable>
            </View>

            <View style={styles.addRow}>
              <TextInput
                style={[styles.addInput, addError ? styles.addInputError : null]}
                value={addInput}
                onChangeText={t => { setAddInput(t); setAddError(''); }}
                placeholder="Add by username"
                placeholderTextColor={COLORS.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              <Pressable
                style={[styles.addBtn, (!addInput.trim() || addLoading) && styles.disabled]}
                onPress={handleAdd}
                disabled={!addInput.trim() || addLoading}
              >
                {addLoading
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={styles.addBtnText}>Add</Text>
                }
              </Pressable>
            </View>
            {addError ? <Text style={styles.addError}>{addError}</Text> : null}

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {friends.length === 0 ? (
                <Text style={styles.empty}>No friends yet.</Text>
              ) : (
                friends.map(f => {
                  const isSelf = f.username === username;
                  return (
                    <View key={f.username} style={styles.friendRow}>
                      <Pressable
                        onPress={() => { onClose(); onNavigateToUser(f.username); }}
                        style={styles.friendInfo}
                      >
                        <Text style={styles.friendName}>{capitalize(f.username)}</Text>
                        <Text style={styles.friendRegion}>{f.region}</Text>
                        {isSelf && <Text style={styles.youBadge}> (you)</Text>}
                      </Pressable>
                      {!isSelf && (
                        <Pressable onPress={() => handleRemove(f.username)} hitSlop={8} style={styles.removeBtn}>
                          <Text style={styles.removeText}>×</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  kav: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeX: {
    fontSize: 22,
    color: COLORS.textDim,
    lineHeight: 22,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.text,
  },
  addInputError: {
    borderColor: '#ef4444',
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.red,
    justifyContent: 'center',
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  addError: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 8,
  },
  list: {
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    color: COLORS.textDim,
    fontSize: 14,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  friendRegion: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  youBadge: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  removeBtn: {
    padding: 4,
  },
  removeText: {
    fontSize: 20,
    color: '#ef4444',
    lineHeight: 20,
  },
});
