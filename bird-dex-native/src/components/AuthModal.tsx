import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { REGIONS, type ThemeColors } from '../theme';
import { API_BASE } from '../config';
import { api } from '../api';

type Step = 'login' | 'region';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (username: string, token: string) => void;
};

export default function AuthModal({ visible, onClose, onSuccess }: Props) {
  const C = useTheme();
  const S = useMemo(() => makeStyles(C), [C]);

  const [step, setStep] = useState<Step>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('BC');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep('login');
    setUsername('');
    setPassword('');
    setRegion('BC');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleContinue() {
    const name = username.trim().toLowerCase();
    if (!name || !password) return;
    setLoading(true);
    setError('');
    try {
      const userRes = await fetch(`${API_BASE}/api/users/${name}`);
      if (userRes.ok) {
        const authRes = await api.authUser(name, password).catch(() => null);
        if (authRes) {
          onSuccess(authRes.user.username, authRes.token);
          reset();
          onClose();
        } else {
          setError('Wrong password.');
        }
      } else {
        setStep('region');
      }
    } catch {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = username.trim().toLowerCase();
    setLoading(true);
    try {
      const res = await api.createUser(name, region, password);
      onSuccess(res.user.username, res.token);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={S.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={S.sheet} onPress={() => {}}>
            {step === 'login' ? (
              <>
                <Text style={S.title}>Sign in</Text>
                <Text style={S.subtitle}>Enter your username and password to sign in or create an account.</Text>

                <TextInput
                  style={S.input}
                  value={username}
                  onChangeText={t => { setUsername(t); setError(''); }}
                  placeholder="Username"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TextInput
                  style={[S.input, error ? S.inputError : null]}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  placeholder="Password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                />
                {error ? <Text style={S.error}>{error}</Text> : null}

                <View style={S.buttonRow}>
                  <Pressable style={S.cancelBtn} onPress={handleClose}>
                    <Text style={S.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[S.primaryBtn, (!username.trim() || !password || loading) && S.disabled]}
                    onPress={handleContinue}
                    disabled={!username.trim() || !password || loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#ffffff" size="small" />
                      : <Text style={S.primaryText}>Continue</Text>
                    }
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={S.title}>Choose region</Text>
                <Text style={S.subtitle}>
                  New account: <Text style={{ fontWeight: '700', color: C.text }}>{username}</Text>
                </Text>

                <ScrollView style={{ marginBottom: 12 }}>
                  {Object.entries(REGIONS).map(([code, info]) => (
                    <Pressable
                      key={code}
                      onPress={() => setRegion(code)}
                      style={[
                        S.regionOption,
                        region === code && { borderColor: C.accent, backgroundColor: C.surfaceAlt },
                      ]}
                    >
                      <View style={[S.radio, region === code && { borderColor: C.accent, backgroundColor: C.accent }]} />
                      <View>
                        <Text style={[S.regionName, region === code && { color: C.accent }]}>{info.label}</Text>
                        <Text style={S.regionSpecies}>{info.species} species</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>

                {error ? <Text style={S.error}>{error}</Text> : null}

                <View style={S.buttonRow}>
                  <Pressable style={S.cancelBtn} onPress={() => setStep('login')}>
                    <Text style={S.cancelText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[S.primaryBtn, loading && S.disabled]}
                    onPress={handleCreate}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#ffffff" size="small" />
                      : <Text style={S.primaryText}>Create Account</Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    sheet: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 380,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: C.textSecondary,
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: C.text,
      marginBottom: 10,
      backgroundColor: C.surfaceAlt,
    },
    inputError: { borderColor: '#ef4444' },
    error: { fontSize: 12, color: '#ef4444', marginBottom: 10 },
    buttonRow: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
    },
    cancelText: { fontSize: 14, color: C.textSecondary },
    primaryBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: C.accent,
      alignItems: 'center',
    },
    primaryText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
    disabled: { opacity: 0.5 },
    regionOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: C.border,
      marginBottom: 8,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: C.border,
    },
    regionName: { fontSize: 14, fontWeight: '600', color: C.text },
    regionSpecies: { fontSize: 12, color: C.textMuted },
  });
}
