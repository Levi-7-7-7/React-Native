import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';

interface Certificate {
  _id: string;
  student?: {name: string; registerNumber: string};
  category?: {name: string};
  subcategory?: string;
  level?: string;
  prizeType?: string;
  pointsAwarded?: number;
  fileUrl?: string;
  updatedAt?: string;
  status: string;
}

function getFileExtension(url = '') {
  return (url.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
}

function isPdf(url = '') {
  return (
    url.toLowerCase().includes('.pdf') ||
    url.toLowerCase().includes('application/pdf')
  );
}

export default function TutorApprovedScreen() {
  const {colors} = useTheme();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await tutorAxios.get('/tutors/certificates');
      const approved = (res.data.certificates || []).filter(
        (c: Certificate) => c.status === 'approved',
      );
      setCerts(approved);
    } catch (err) {
      console.error('Fetch approved error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filtered = certs.filter(c =>
    search
      ? c.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.student?.registerNumber?.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const handleRevert = async (certId: string) => {
    setRevertingId(certId);
    setConfirmId(null);
    try {
      await tutorAxios.post(`/tutors/certificates/${certId}/revert-to-pending`);
      setCerts(prev => prev.filter(c => c._id !== certId));
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.error || 'Failed to revert. Please try again.',
      );
    } finally {
      setRevertingId(null);
    }
  };

  // ── Download certificate ──
  const handleDownload = async (cert: Certificate) => {
    if (!cert.fileUrl) return;
    setDownloadingId(cert._id);
    try {
      // Request Android storage permission if needed
      if (Platform.OS === 'android') {
        const sdkInt = parseInt(Platform.Version as string, 10);
        if (sdkInt < 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'Needed to save the certificate to your device.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission denied', 'Cannot save file without storage permission.');
            return;
          }
        }
      }

      const ext = getFileExtension(cert.fileUrl);
      const safeName = (cert.student?.name || 'cert').replace(/[^a-zA-Z0-9]/g, '_');
      const safeSubcat = (cert.subcategory || '').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeName}_${safeSubcat}_${cert._id.slice(-6)}.${ext}`;

      const destDir =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}`
          : `${RNFS.DocumentDirectoryPath}`;
      const destPath = `${destDir}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: cert.fileUrl,
        toFile: destPath,
      }).promise;

      if (downloadResult.statusCode === 200) {
        Alert.alert(
          'Downloaded!',
          Platform.OS === 'android'
            ? `Saved to Downloads:\n${fileName}`
            : `Saved to Files:\n${fileName}`,
          [
            {text: 'OK'},
            ...(Platform.OS === 'ios'
              ? [
                  {
                    text: 'Open',
                    onPress: () => Linking.openURL(`file://${destPath}`),
                  },
                ]
              : []),
          ],
        );
      } else {
        throw new Error(`Download failed: status ${downloadResult.statusCode}`);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      // Fallback: open in browser
      Alert.alert(
        'Download Failed',
        'Could not save the file. Open it in your browser instead?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Open in Browser',
            onPress: () => cert.fileUrl && Linking.openURL(cert.fileUrl),
          },
        ],
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({item}: {item: Certificate}) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: '#22c55e',
        },
      ]}>
      <View style={styles.cardTop}>
        <View style={{flex: 1}}>
          <Text style={[styles.studentName, {color: colors.text}]}>
            {item.student?.name || '—'}
          </Text>
          <Text style={[styles.regNo, {color: colors.textMuted}]}>
            {item.student?.registerNumber}
          </Text>
          <Text style={[styles.categoryText, {color: colors.textSub}]}>
            <Text style={{fontWeight: '700'}}>{item.category?.name}</Text>
            {item.subcategory ? ` — ${item.subcategory}` : ''}
          </Text>
          {(item.level || item.prizeType) && (
            <View style={styles.levelRow}>
              <Icon name="trophy-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.levelText, {color: colors.textMuted}]}>
                {[item.level, item.prizeType].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rightCol}>
          {/* Points badge */}
          <View
            style={[styles.pointsBadge, {backgroundColor: colors.badgeApprovedBg}]}>
            <Text style={[styles.pointsText, {color: colors.badgeApprovedText}]}>
              +{item.pointsAwarded ?? 0} pts
            </Text>
          </View>

          {/* View file */}
          {item.fileUrl && (
            <TouchableOpacity
              style={[styles.actionBtn, {borderColor: '#bfdbfe'}]}
              onPress={() => Linking.openURL(item.fileUrl!)}>
              <Icon name="eye-outline" size={13} color="#2563eb" />
              <Text style={[styles.actionBtnText, {color: '#2563eb'}]}>View</Text>
            </TouchableOpacity>
          )}

          {/* Download button */}
          {item.fileUrl && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: '#bbf7d0',
                  backgroundColor:
                    downloadingId === item._id ? '#d1fae5' : '#f0fdf4',
                },
                downloadingId === item._id && styles.btnDisabled,
              ]}
              onPress={() => handleDownload(item)}
              disabled={downloadingId === item._id}>
              {downloadingId === item._id ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <Icon
                    name={isPdf(item.fileUrl) ? 'file-pdf-box' : 'download-outline'}
                    size={13}
                    color="#059669"
                  />
                  <Text style={[styles.actionBtnText, {color: '#059669'}]}>
                    Download
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Revert button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                borderColor: '#fcd34d',
                backgroundColor:
                  revertingId === item._id ? '#fef3c7' : '#fffbeb',
              },
              revertingId === item._id && styles.btnDisabled,
            ]}
            onPress={() => setConfirmId(item._id)}
            disabled={revertingId === item._id}>
            {revertingId === item._id ? (
              <ActivityIndicator size="small" color="#b45309" />
            ) : (
              <>
                <Icon name="rotate-left" size={13} color="#b45309" />
                <Text style={[styles.actionBtnText, {color: '#b45309'}]}>
                  Revert
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {item.updatedAt && (
        <Text style={[styles.approvedDate, {color: colors.textMuted}]}>
          Approved: {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textMuted}]}>
          Loading approved certificates…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      {/* Search */}
      <View
        style={[
          styles.searchWrapper,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <Icon
          name="magnify"
          size={20}
          color={colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, {color: colors.text}]}
          placeholder="Search by name or reg. number…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon
              name="certificate-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
              {search
                ? 'No matching certificates found.'
                : 'No approved certificates yet.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Confirm Revert Modal ── */}
      <Modal
        visible={!!confirmId}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, {backgroundColor: colors.card}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>
              Revert to Pending?
            </Text>
            <Text style={[styles.modalSub, {color: colors.textMuted}]}>
              This will remove the awarded points and move the certificate back
              to pending review.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, {borderColor: colors.border}]}
                onPress={() => setConfirmId(null)}>
                <Text style={[styles.modalCancelText, {color: colors.textSub}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, {backgroundColor: '#f59e0b'}]}
                onPress={() => confirmId && handleRevert(confirmId)}>
                <Text style={styles.modalConfirmText}>Yes, Revert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingText: {fontSize: 14},
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchIcon: {marginRight: 8},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 2},
  list: {paddingHorizontal: 12, paddingBottom: 20},
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 10,
    padding: 12,
  },
  cardTop: {flexDirection: 'row', gap: 12},
  studentName: {fontSize: 14, fontWeight: '700'},
  regNo: {fontSize: 12, marginTop: 2},
  categoryText: {fontSize: 13, marginTop: 4},
  levelRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3},
  levelText: {fontSize: 12},
  rightCol: {alignItems: 'flex-end', gap: 6},
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pointsText: {fontSize: 13, fontWeight: '700'},
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {fontSize: 12, fontWeight: '600'},
  approvedDate: {fontSize: 11, marginTop: 8},
  btnDisabled: {opacity: 0.6},
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {fontSize: 14},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {fontSize: 16, fontWeight: '700', marginBottom: 8},
  modalSub: {fontSize: 13, lineHeight: 20, marginBottom: 16},
  modalActions: {flexDirection: 'row', gap: 10},
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
  },
  modalCancelText: {fontWeight: '600', fontSize: 14},
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 11,
  },
  modalConfirmText: {color: '#fff', fontWeight: '700', fontSize: 14},
});
