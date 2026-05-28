/**
 * LoginScreen — updated to add a "Tutor Login" link at the bottom.
 *
 * Only the footer section changes; the rest of the logic is identical
 * to the original. Drop this file in place of src/screens/LoginScreen.tsx
 */
import React, {useState} from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, {invalidateStudentTokenCache} from '../api/axiosInstance';
import {useAuth} from '../context/AuthContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LoginScreen({navigation}: any) {
  const {setUser, setRole} = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Error', 'Register number and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/login', {
        registerNumber: identifier,
        password,
      });
      if (!res?.data?.token) throw new Error('No token returned');
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('role', 'student');
      await AsyncStorage.setItem('userName', res.data.student?.name || 'Student');
      invalidateStudentTokenCache(); // flush cache so next request picks up the new token
      setUser(res.data.student);
      setRole('student');
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.response?.data?.error || err.message || 'Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Register number is required');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/auth/start-login', {registerNumber: identifier});
      navigation.navigate('VerifyOtp', {registerNumber: identifier});
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="school-outline" size={48} color="#1e3a8a" />
          <Text style={styles.title}>Activity Points</Text>
          <Text style={styles.subtitle}>Management System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student Login</Text>

          {/* Register Number */}
          <Text style={styles.label}>Register Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your register number"
            placeholderTextColor="#9ca3af"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="characters"
            editable={!loading}
          />

          {/* Password */}
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
                  onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* First-time user toggle */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setIsFirstTimeUser(!isFirstTimeUser)}
            disabled={loading}>
            <View
              style={[styles.checkbox, isFirstTimeUser && styles.checkboxChecked]}>
              {isFirstTimeUser && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>First-time user (get OTP)</Text>
          </TouchableOpacity>

          {/* Forgot Password */}
          {!isFirstTimeUser && (
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
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

        {/* ── Tutor login link ── */}
        <TouchableOpacity
          style={styles.tutorLink}
          onPress={() => navigation.navigate('TutorLogin')}
          disabled={loading}>
          <MaterialCommunityIcons
            name="account-tie-outline"
            size={16}
            color="#2563eb"
          />
          <Text style={styles.tutorLinkText}>Login as Tutor</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Need help? Contact your institution's IT support
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#f0f4ff'},
  container: {flexGrow: 1, justifyContent: 'center', padding: 20},
  header: {alignItems: 'center', marginBottom: 28},
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e3a8a',
    letterSpacing: 0.5,
  },
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
  // ── tutor link ──
  tutorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },
  tutorLinkText: {color: '#2563eb', fontSize: 14, fontWeight: '600'},
  footerText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 20,
  },
});
