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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tutorAxios, {invalidateTutorTokenCache} from '../api/tutorAxios';
import {useAuth} from '../context/AuthContext';

export default function TutorLoginScreen({navigation}: any) {
  const {setRole} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      if (!res?.data?.token) throw new Error('No token returned');
      await AsyncStorage.setItem('tutorToken', res.data.token);
      await AsyncStorage.setItem('tutorName', res.data.tutor?.name || 'Tutor');
      await AsyncStorage.setItem('role', 'tutor');
      invalidateTutorTokenCache(); // flush cache so next request picks up the new token
      setRole('tutor');
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.response?.data?.error || err.message || 'Please check your credentials.',
      );
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
          <Icon name="account-tie-outline" size={52} color="#1e3a8a" />
          <Text style={styles.title}>Activity Points</Text>
          <Text style={styles.subtitle}>Tutor Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tutor Login</Text>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          {/* Password */}
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
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('TutorForgotPassword')}
            disabled={loading}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.btnPrimary,
              (!email || !password || loading) && styles.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={!email || !password || loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

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
    marginTop: 10,
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
  forgotText: {
    color: '#2563eb',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 4,
  },
  btnPrimary: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {opacity: 0.5},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 16},
  footerText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
  },
});
