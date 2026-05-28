/**
 * UnifiedLoginScreen
 *
 * Single login screen for both students and tutors.
 * - Typing an email  → routes to tutor login  (POST /tutors/login)
 * - Typing a reg no  → routes to student login (POST /auth/login)
 *
 * The user never sees "Student Login" or "Tutor Login" labels.
 * The UI subtly adapts (placeholder hint, forgot-password target) as they type.
 *
 * HOW TO INTEGRATE
 * ────────────────
 * 1. Drop this file into src/screens/UnifiedLoginScreen.tsx
 * 2. In RootNavigator.tsx replace the separate Login / TutorLogin screens:
 *
 *    import UnifiedLoginScreen from '../screens/UnifiedLoginScreen';
 *    ...
 *    <Stack.Screen name="Login" component={UnifiedLoginScreen} />
 *    // Remove: TutorLogin screen entry (or keep if you still want deep-link access)
 *
 * 3. Remove the "Login as Tutor" button from anywhere it appears — it's no longer needed.
 */

import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, {invalidateStudentTokenCache} from '../api/axiosInstance';
import tutorAxios, {invalidateTutorTokenCache} from '../api/tutorAxios';
import {useAuth} from '../context/AuthContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns true when the string looks like an e-mail address. */
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * Detects credential type from what the user has typed so far.
 * We use a lightweight heuristic so the UI can update while they type,
 * but the actual routing decision is made at submit time.
 */
const detectType = (identifier: string): 'tutor' | 'student' | 'unknown' => {
  if (!identifier) return 'unknown';
  if (identifier.includes('@')) return 'tutor';
  // Register numbers are typically all-caps alphanumeric (e.g. TVE22CS001)
  if (/^[A-Za-z0-9]{3,}$/.test(identifier.trim())) return 'student';
  return 'unknown';
};

// ─── component ──────────────────────────────────────────────────────────────

export default function UnifiedLoginScreen({navigation}: any) {
  const {setUser, setRole} = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated hint opacity — fades in when type is detected
  const hintOpacity = useRef(new Animated.Value(0)).current;

  const detectedType = detectType(identifier);

  // Fade hint in/out as detection flips
  React.useEffect(() => {
    Animated.timing(hintOpacity, {
      toValue: detectedType !== 'unknown' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [detectedType, hintOpacity]);

  // ── submit ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Error', 'Please enter your credentials and password.');
      return;
    }

    const isTutor = looksLikeEmail(identifier);

    setLoading(true);
    try {
      if (isTutor) {
        // ── Tutor path ──
        const res = await tutorAxios.post('/tutors/login', {
          email: identifier.trim().toLowerCase(),
          password,
        });
        if (!res?.data?.token) throw new Error('No token returned');
        await AsyncStorage.multiSet([
          ['tutorToken', res.data.token],
          ['tutorName', res.data.tutor?.name || 'Tutor'],
          ['role', 'tutor'],
        ]);
        invalidateTutorTokenCache(); // flush cache so next request picks up the new token
        setUser({name: res.data.tutor?.name || 'Tutor'});
        setRole('tutor');
      } else {
        // ── Student path ──
        const res = await axiosInstance.post('/auth/login', {
          registerNumber: identifier.trim().toUpperCase(),
          password,
        });
        if (!res?.data?.token) throw new Error('No token returned');
        await AsyncStorage.multiSet([
          ['token', res.data.token],
          ['role', 'student'],
          ['userName', res.data.student?.name || 'Student'],
        ]);
        invalidateStudentTokenCache(); // flush cache so next request picks up the new token
        setUser(res.data.student);
        setRole('student');
      }
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ── first-time OTP (students only) ───────────────────────────────────────

  const handleRequestOTP = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your register number.');
      return;
    }
    if (looksLikeEmail(identifier)) {
      Alert.alert('Info', 'OTP login is only available for students.');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/auth/start-login', {
        registerNumber: identifier.trim().toUpperCase(),
      });
      navigation.navigate('VerifyOtp', {
        registerNumber: identifier.trim().toUpperCase(),
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── forgot password — adapts based on detected type ───────────────────────

  const handleForgotPassword = () => {
    if (detectedType === 'tutor') {
      navigation.navigate('TutorForgotPassword');
    } else {
      navigation.navigate('ForgotPassword');
    }
  };

  // ── placeholder copy adapts to detected type ──────────────────────────────

  const identifierPlaceholder =
    detectedType === 'tutor'
      ? 'Email address'
      : detectedType === 'student'
      ? 'Register number'
      : 'Email or register number';

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="school-outline" size={52} color="#1e3a8a" />
          <Text style={styles.title}>Activity Points</Text>
          <Text style={styles.subtitle}>Management System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {/* ── Identifier field ── */}
          <Text style={styles.label}>Email or Register Number</Text>
          <TextInput
            style={styles.input}
            placeholder={identifierPlaceholder}
            placeholderTextColor="#9ca3af"
            value={identifier}
            onChangeText={v => {
              setIdentifier(v);
              // If user starts typing email, OTP mode doesn't apply
              if (v.includes('@')) setIsFirstTimeUser(false);
            }}
            autoCapitalize="none"
            keyboardType={detectedType === 'tutor' ? 'email-address' : 'default'}
            editable={!loading}
            autoCorrect={false}
          />

          {/* Subtle detected-type hint */}
          <Animated.Text style={[styles.typeHint, {opacity: hintOpacity}]}>
            {detectedType === 'tutor' ? '🔑 Tutor account detected' : '🎓 Student account detected'}
          </Animated.Text>

          {/* ── Password field (hidden in OTP mode) ── */}
          {!isFirstTimeUser && (
            <>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(p => !p)}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* First-time user toggle — only shown for students */}
          {detectedType !== 'tutor' && (
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setIsFirstTimeUser(p => !p)}
              disabled={loading}>
              <View style={[styles.checkbox, isFirstTimeUser && styles.checkboxChecked]}>
                {isFirstTimeUser && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>First-time user (login via OTP)</Text>
            </TouchableOpacity>
          )}

          {/* Forgot password */}
          {!isFirstTimeUser && (
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          {!isFirstTimeUser ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                (!identifier || !password || loading) && styles.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={!identifier || !password || loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.btnOutline,
                (!identifier || loading) && styles.btnDisabled,
              ]}
              onPress={handleRequestOTP}
              disabled={!identifier || loading}>
              {loading ? (
                <ActivityIndicator color="#1e3a8a" />
              ) : (
                <Text style={styles.btnOutlineText}>Request OTP</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footerText}>
          Need help? Contact your institution's IT support
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#f0f4ff'},
  container: {flexGrow: 1, justifyContent: 'center', padding: 20},
  header: {alignItems: 'center', marginBottom: 28},
  title: {fontSize: 26, fontWeight: '800', color: '#1e3a8a', letterSpacing: 0.5, marginTop: 10},
  subtitle: {fontSize: 14, color: '#6b7280', marginTop: 4},
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#1e3a8a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  typeHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 5,
    marginLeft: 2,
  },
  passwordRow: {position: 'relative'},
  passwordInput: {paddingRight: 48},
  eyeBtn: {position: 'absolute', right: 12, top: 12},
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {backgroundColor: '#1e3a8a', borderColor: '#1e3a8a'},
  checkmark: {color: '#fff', fontSize: 13, fontWeight: '700'},
  checkLabel: {fontSize: 14, color: '#374151'},
  forgotText: {
    color: '#2563eb',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 4,
  },
  btnPrimary: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {opacity: 0.5},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 16},
  btnOutlineText: {color: '#1e3a8a', fontWeight: '700', fontSize: 16},
  footerText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
  },
});
