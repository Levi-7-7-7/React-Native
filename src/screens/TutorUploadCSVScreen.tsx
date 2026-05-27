import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {pick, types, isErrorWithCode} from '@react-native-documents/picker';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';

export default function TutorUploadCSVScreen() {
  const {colors} = useTheme();
  const [file, setFile] = useState<{name: string; uri: string; type: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);

 const pickFile = async () => {
    try {
      const [res] = await pick({
        type: [types.csv],
      });

      setFile({
        name: res.name || 'file.csv',
        uri: res.uri,
        type: res.type || 'text/csv',
      });

      setResult(null);
    } catch (err: any) {
      if (!isErrorWithCode(err)) {
        Alert.alert('Error', 'Could not pick file. Please try again.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Alert.alert('No File', 'Please select a CSV file first.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
        name: file.name,
        type: file.type,
      } as any);

      const res = await tutorAxios.post('/tutors/students/upload', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setResult({success: true, message: res.data.message || 'Upload successful!'});
      setFile(null);
    } catch (err: any) {
      setResult({
        success: false,
        message:
          err.response?.data?.error || 'Upload failed. Check your CSV format.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: colors.bg}]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Info header */}
      <View style={[styles.card, {backgroundColor: colors.card}]}>
        <View style={styles.cardHeader}>
          <Icon name="file-upload-outline" size={26} color={colors.primary} />
          <View style={{flex: 1}}>
            <Text style={[styles.cardTitle, {color: colors.text}]}>
              Upload Students via CSV
            </Text>
            <Text style={[styles.cardSub, {color: colors.textMuted}]}>
              Bulk-add students to the system. They will be assigned to your batch &amp; branch automatically.
            </Text>
          </View>
        </View>
      </View>

      {/* Format guide */}
      <View style={[styles.card, {backgroundColor: colors.cardAlt}]}>
        <Text style={[styles.sectionTitle, {color: colors.primary}]}>
          Required CSV Format
        </Text>
        <View style={[styles.formatRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
          {['name', 'registerNumber', 'email'].map(col => (
            <View key={col} style={[styles.colChip, {backgroundColor: colors.primaryMuted}]}>
              <Text style={[styles.colText, {color: colors.primary}]}>{col}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.exampleRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <Text style={[styles.exampleText, {color: colors.textMuted}]}>John Doe</Text>
          <Text style={[styles.exampleText, {color: colors.textMuted}]}>2301131001</Text>
          <Text style={[styles.exampleText, {color: colors.textMuted}]}>john@example.com</Text>
        </View>
        <View style={styles.notesList}>
          {[
            'First row must be the header exactly as shown',
            'Register number must be unique per student',
            'Email must be a valid address',
          ].map((note, i) => (
            <View key={i} style={styles.noteRow}>
              <Text style={[styles.noteBullet, {color: colors.primary}]}>•</Text>
              <Text style={[styles.noteText, {color: colors.textSub}]}>{note}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* File picker */}
      <TouchableOpacity
        style={[
          styles.pickerBtn,
          {
            borderColor: file ? colors.primary : colors.border,
            backgroundColor: file ? colors.primaryMuted : colors.card,
          },
        ]}
        onPress={pickFile}
        activeOpacity={0.8}>
        <Icon
          name={file ? 'file-check-outline' : 'file-plus-outline'}
          size={28}
          color={file ? colors.primary : colors.textMuted}
        />
        <Text
          style={[
            styles.pickerText,
            {color: file ? colors.primary : colors.textMuted},
          ]}>
          {file ? file.name : 'Tap to select CSV file'}
        </Text>
        {file && (
          <TouchableOpacity
            onPress={() => {
              setFile(null);
              setResult(null);
            }}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Result */}
      {result && (
        <View
          style={[
            styles.resultBox,
            {
              backgroundColor: result.success ? colors.cardSuccess : colors.cardDanger,
              borderColor: result.success ? '#16a34a' : '#dc2626',
            },
          ]}>
          <Icon
            name={result.success ? 'check-circle-outline' : 'alert-circle-outline'}
            size={20}
            color={result.success ? '#16a34a' : '#dc2626'}
          />
          <Text
            style={[
              styles.resultText,
              {color: result.success ? colors.successTitle : colors.dangerText},
            ]}>
            {result.message}
          </Text>
        </View>
      )}

      {/* Upload button */}
      <TouchableOpacity
        style={[
          styles.uploadBtn,
          {backgroundColor: colors.primaryBtn},
          (!file || loading) && styles.btnDisabled,
        ]}
        onPress={handleUpload}
        disabled={!file || loading}
        activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload CSV</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 14, gap: 14},
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
  cardTitle: {fontSize: 15, fontWeight: '700', marginBottom: 4},
  cardSub: {fontSize: 13, lineHeight: 18},
  sectionTitle: {fontSize: 13, fontWeight: '700', marginBottom: 10},
  formatRow: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  colChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 6,
  },
  colText: {fontSize: 11, fontWeight: '700'},
  exampleRow: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  exampleText: {flex: 1, fontSize: 11, textAlign: 'center'},
  notesList: {gap: 5},
  noteRow: {flexDirection: 'row', gap: 6},
  noteBullet: {fontSize: 13, fontWeight: '700'},
  noteText: {fontSize: 12, flex: 1, lineHeight: 18},
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 18,
  },
  pickerText: {flex: 1, fontSize: 14, fontWeight: '500'},
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  resultText: {flex: 1, fontSize: 13, fontWeight: '500'},
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
    marginBottom: 20,
  },
  uploadBtnText: {color: '#fff', fontWeight: '700', fontSize: 16},
  btnDisabled: {opacity: 0.5},
});
