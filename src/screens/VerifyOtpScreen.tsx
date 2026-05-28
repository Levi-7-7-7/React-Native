import React, {useState, useEffect} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axiosInstance, {invalidateStudentTokenCache} from '../api/axiosInstance';
import {useAuth} from '../context/AuthContext';

export default function VerifyOtpScreen({route}: any) {
  const {registerNumber} = route.params;
  const {setUser, setRole} = useAuth();

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLateralEntry, setIsLateralEntry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  useEffect(() => {
    axiosInstance
      .get('/students/dropdown-data')
      .then(res => {
        setBatches(res.data.batches || []);
        setBranches(res.data.branches || []);
      })
      .catch(() => Alert.alert('Error', 'Failed to load batch/branch data'));
  }, []);

  const handleSubmit = async () => {
    if (!otp || !password || !confirmPassword || !batchId || !branchId) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/verify-otp', {
        registerNumber,
        otp,
        password,
        batch: batchId,
        branch: branchId,
        isLateralEntry,
      });
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('role', 'student');
      invalidateStudentTokenCache(); // flush cache so next request picks up the new token
      setRole('student');
      const me = await axiosInstance.get('/students/me');
      setUser(me.data);
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        err.response?.data?.error || err.response?.data?.message || 'OTP verification failed',
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedBatch = batches.find(b => b._id === batchId);
  const selectedBranch = branches.find(b => b._id === branchId);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}>

        <View style={styles.header}>
          <Text style={styles.emoji}>📧</Text>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>Check your registered email for the OTP code</Text>
          <Text style={styles.regNo}>{registerNumber}</Text>
        </View>

        <View style={styles.card}>
          {/* OTP */}
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit OTP"
            placeholderTextColor="#9ca3af"
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
            maxLength={6}
            editable={!loading}
          />

          {/* Password */}
          <Text style={styles.label}>Set Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter the password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}>
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[
            styles.inputRow,
            passwordsMatch && styles.inputRowSuccess,
            passwordsMismatch && styles.inputRowError,
          ]}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Re-enter your password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword(v => !v)}>
              <Icon
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
            {passwordsMatch && (
              <Icon name="check-circle" size={20} color="#16a34a" style={styles.statusIcon} />
            )}
            {passwordsMismatch && (
              <Icon name="close-circle" size={20} color="#dc2626" style={styles.statusIcon} />
            )}
          </View>
          {passwordsMismatch && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          {/* Batch selector */}
          <Text style={styles.label}>Batch</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => {setBatchOpen(v => !v); setBranchOpen(false);}}>
            <Text style={selectedBatch ? styles.selectorText : styles.selectorPlaceholder}>
              {selectedBatch ? selectedBatch.name : 'Select Batch'}
            </Text>
            <Icon name={batchOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
          </TouchableOpacity>
          {batchOpen && (
            <View style={styles.dropdown}>
              <ScrollView
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                style={styles.dropdownScroll}>
                {batches.map(b => (
                  <TouchableOpacity
                    key={b._id}
                    style={[styles.dropdownItem, batchId === b._id && styles.dropdownItemActive]}
                    onPress={() => {setBatchId(b._id); setBatchOpen(false);}}>
                    <Text style={[styles.dropdownText, batchId === b._id && styles.dropdownTextActive]}>
                      {b.name}
                    </Text>
                    {batchId === b._id && (
                      <Icon name="check" size={16} color="#1e3a8a" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Branch selector */}
          <Text style={styles.label}>Branch</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => {setBranchOpen(v => !v); setBatchOpen(false);}}>
            <Text style={selectedBranch ? styles.selectorText : styles.selectorPlaceholder}>
              {selectedBranch ? selectedBranch.name : 'Select Branch'}
            </Text>
            <Icon name={branchOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
          </TouchableOpacity>
          {branchOpen && (
            <View style={styles.dropdown}>
              <ScrollView
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                style={styles.dropdownScroll}>
                {branches.map(b => (
                  <TouchableOpacity
                    key={b._id}
                    style={[styles.dropdownItem, branchId === b._id && styles.dropdownItemActive]}
                    onPress={() => {setBranchId(b._id); setBranchOpen(false);}}>
                    <Text style={[styles.dropdownText, branchId === b._id && styles.dropdownTextActive]}>
                      {b.name}
                    </Text>
                    {branchId === b._id && (
                      <Icon name="check" size={16} color="#1e3a8a" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Lateral Entry */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setIsLateralEntry(!isLateralEntry)}
            disabled={loading}>
            <View style={[styles.checkbox, isLateralEntry && styles.checkboxChecked]}>
              {isLateralEntry && <Icon name="check" size={13} color="#fff" />}
            </View>
            <Text style={styles.checkLabel}>
              I am a <Text style={{fontWeight: '700'}}>Lateral Entry</Text> student{' '}
              <Text style={{color: '#6b7280', fontSize: 12}}>(requires 40 pts)</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, (loading || passwordsMismatch) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading || passwordsMismatch}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Verify & Complete Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#f0f4ff'},
  container: {flexGrow: 1, padding: 20, paddingTop: 40, paddingBottom: 40},
  header: {alignItems: 'center', marginBottom: 24},
  emoji: {fontSize: 48, marginBottom: 8},
  title: {fontSize: 24, fontWeight: '800', color: '#1e3a8a'},
  subtitle: {fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center'},
  regNo: {
    marginTop: 8, backgroundColor: '#e0e7ff', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 20, color: '#1e3a8a', fontWeight: '600', fontSize: 13,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#1e3a8a', shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  label: {fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12},
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  inputRow: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputRowSuccess: {borderColor: '#16a34a'},
  inputRowError: {borderColor: '#dc2626'},
  inputFlex: {flex: 1, paddingVertical: 12, fontSize: 15, color: '#111827'},
  eyeBtn: {padding: 4},
  statusIcon: {marginLeft: 4},
  errorText: {color: '#dc2626', fontSize: 12, marginTop: 4, marginLeft: 2},
  selector: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectorText: {fontSize: 15, color: '#111827'},
  selectorPlaceholder: {fontSize: 15, color: '#9ca3af'},
  dropdown: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    marginTop: 4, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 4,
  },
  dropdownScroll: {maxHeight: 180},
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  dropdownItemActive: {backgroundColor: '#eff6ff'},
  dropdownText: {fontSize: 15, color: '#374151'},
  dropdownTextActive: {color: '#1e3a8a', fontWeight: '600'},
  checkRow: {flexDirection: 'row', alignItems: 'center', marginTop: 16},
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: '#9ca3af',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  checkboxChecked: {backgroundColor: '#1e3a8a', borderColor: '#1e3a8a'},
  checkLabel: {flex: 1, fontSize: 14, color: '#374151'},
  btnPrimary: {
    backgroundColor: '#1e3a8a', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  btnDisabled: {opacity: 0.5},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
