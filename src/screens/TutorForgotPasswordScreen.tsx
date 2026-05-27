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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';

export default function TutorForgotPasswordScreen({navigation}: any) {
  const {colors} = useTheme();

  // Step 1: enter email — Step 2: enter OTP + new password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Step 1 — send OTP
  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setMaskedEmail(res.data.maskedEmail || '');
      setStep(2);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Could not send OTP. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + reset password
  const handleReset = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      Alert.alert(
        'Success',
        res.data.message || 'Password reset successfully!',
        [{text: 'Login', onPress: () => navigation.navigate('TutorLogin')}],
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message ||
          'Reset failed. Check your OTP and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await tutorAxios.post('/tutors/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setMaskedEmail(res.data.maskedEmail || maskedEmail);
      setOtp('');
      Alert.alert('Sent', 'A new OTP has been sent to your email.');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Could not resend OTP.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, {backgroundColor: colors.bg}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Icon
            name={step === 1 ? 'lock-reset' : 'shield-key-outline'}
            size={52}
            color="#1e3a8a"
          />
          <Text style={[styles.title, {color: colors.text}]}>
            {step === 1 ? 'Forgot Password' : 'Reset Password'}
          </Text>
          <Text style={[styles.subtitle, {color: colors.textMuted}]}>
            {step === 1
              ? 'Enter your registered email to receive an OTP'
              : `OTP sent to ${maskedEmail}`}
          </Text>
        </View>

        <View style={[styles.card, {backgroundColor: colors.card}]}>
          {/* ── STEP 1: Email ── */}
          {step === 1 && (
            <>
              <Text style={[styles.label, {color: colors.textSub}]}>
                Email Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. tutor@college.edu"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                onSubmitEditing={handleSendOtp}
                returnKeyType="send"
              />

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  (!email.trim() || loading) && styles.btnDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={!email.trim() || loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
                disabled={loading}>
                <Icon name="arrow-left" size={16} color="#2563eb" />
                <Text style={styles.backText}> Back to Login</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2: OTP + new password ── */}
          {step === 2 && (
            <>
              <Text style={[styles.label, {color: colors.textSub}]}>
                OTP Code
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={colors.textMuted}
                value={otp}
                onChangeText={t => setOtp(t.replace(/\D/g, ''))}
                keyboardType="numeric"
                maxLength={6}
                editable={!loading}
              />

              <Text
                style={[styles.label, {color: colors.textSub, marginTop: 14}]}>
                New Password
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}>
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <Text
                style={[styles.label, {color: colors.textSub, marginTop: 14}]}>
                Confirm Password
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: passwordsMatch
                        ? '#16a34a'
                        : passwordsMismatch
                        ? '#dc2626'
                        : colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(!showConfirm)}>
                  <Icon
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {passwordsMismatch && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
              {passwordsMatch && (
                <Text style={styles.successText}>✓ Passwords match</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  (!otp || !newPassword || passwordsMismatch || loading) &&
                    styles.btnDisabled,
                ]}
                onPress={handleReset}
                disabled={!otp || !newPassword || passwordsMismatch || loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <View style={styles.stepTwoActions}>
                <TouchableOpacity
                  onPress={() => {
                    setStep(1);
                    setOtp('');
                  }}
                  disabled={loading}>
                  <Text style={styles.linkText}>← Change Email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flexGrow: 1, justifyContent: 'center', padding: 20},
  header: {alignItems: 'center', marginBottom: 24},
  title: {fontSize: 24, fontWeight: '800', color: '#1e3a8a', marginTop: 10},
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
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
  label: {fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6},
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
  errorText: {color: '#dc2626', fontSize: 12, marginTop: 4},
  successText: {color: '#16a34a', fontSize: 12, marginTop: 4},
  btnPrimary: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {opacity: 0.5},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 16},
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backText: {color: '#2563eb', fontSize: 14, fontWeight: '500'},
  stepTwoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  linkText: {color: '#2563eb', fontSize: 13, fontWeight: '500'},
});
