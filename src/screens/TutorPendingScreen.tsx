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
  ScrollView,
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
  category?: {_id: string; name: string; subcategories?: any[]};
  subcategory?: string;
  level?: string;
  prizeType?: string;
  eventName?: string;
  dateFrom?: string;
  dateTo?: string;
  fileUrl?: string;
  pointsAwarded?: number;
  status: string;
}

const PRIZE_LEVELS = ['Participation', 'First', 'Second', 'Third'];

export default function TutorPendingScreen() {
  const {colors} = useTheme();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Reject modal
  const [rejectCert, setRejectCert] = useState<Certificate | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Edit modal
  const [editCert, setEditCert] = useState<Certificate | null>(null);
  const [editCatId, setEditCatId] = useState('');
  const [editSubcat, setEditSubcat] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editPrize, setEditPrize] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [certRes, catRes] = await Promise.all([
        tutorAxios.get('/tutors/certificates/pending'),
        tutorAxios.get('/categories'),
      ]);
      setCerts(certRes.data || []);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      console.error('Fetch pending error:', err);
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

  const getPotentialPoints = (cert: Certificate) => {
    if (!cert?.category) return 0;
    const sub = cert.category.subcategories?.find(
      s => s.name.toLowerCase() === cert.subcategory?.toLowerCase(),
    );
    if (!sub) return 0;
    if (sub.fixedPoints != null) return sub.fixedPoints;
    if (sub.levels && cert.level && cert.prizeType) {
      const lvl = sub.levels.find((l: any) => l.name === cert.level);
      const prize = lvl?.prizes.find((p: any) => p.type === cert.prizeType);
      return prize?.points ?? 0;
    }
    return 0;
  };

  // ── Approve ──
  const handleApprove = async (certId: string) => {
    Alert.alert('Approve', 'Approve this certificate?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Approve',
        onPress: async () => {
          setProcessingId(certId);
          try {
            await tutorAxios.post(`/tutors/certificates/${certId}/approve`);
            await fetchData();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to approve.');
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  // ── Reject ──
  const submitReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection.');
      return;
    }
    if (!rejectCert) return;
    const id = rejectCert._id;
    setProcessingId(id);
    setRejectCert(null);
    setRejectReason('');
    try {
      await tutorAxios.post(`/tutors/certificates/${id}/reject`, {
        reason: rejectReason.trim(),
      });
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to reject.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Edit ──
  const openEdit = (cert: Certificate) => {
    setEditCert(cert);
    setEditCatId(cert.category?._id || '');
    setEditSubcat(cert.subcategory || '');
    setEditLevel(cert.level || '');
    setEditPrize(cert.prizeType || '');
    setEditSaving(false);
  };

  const editCategory = categories.find(c => c._id === editCatId);
  const editSubcats = editCategory?.subcategories || [];
  const editCurrentSub = editSubcats.find((s: any) => s.name === editSubcat);
  const editHasLevels = editCurrentSub?.levels?.length > 0;

  const getEditPoints = () => {
    if (!editCurrentSub) return null;
    if (editCurrentSub.fixedPoints != null) return editCurrentSub.fixedPoints;
    if (editHasLevels && editLevel && editPrize) {
      const lvl = editCurrentSub.levels.find((l: any) => l.name === editLevel);
      const prize = lvl?.prizes.find((p: any) => p.type === editPrize);
      return prize?.points ?? null;
    }
    return null;
  };

  const submitEdit = async () => {
    if (!editCatId || !editSubcat) {
      Alert.alert('Error', 'Please select category and subcategory');
      return;
    }
    if (!editCert) return;
    setEditSaving(true);
    try {
      await tutorAxios.patch(`/tutors/certificates/${editCert._id}/reassign`, {
        categoryId: editCatId,
        subcategoryName: editSubcat,
        level: editLevel || '',
        prizeType: editPrize || '',
      });
      setEditCert(null);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Download certificate ──
  const handleDownload = async (cert: Certificate) => {
    if (!cert.fileUrl) return;
    setDownloadingId(cert._id);
    try {
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
      const ext = (cert.fileUrl.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
      const safeName = (cert.student?.name || 'cert').replace(/[^a-zA-Z0-9]/g, '_');
      const safeSubcat = (cert.subcategory || '').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeName}_${safeSubcat}_${cert._id.slice(-6)}.${ext}`;
      const destDir =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}`
          : `${RNFS.DocumentDirectoryPath}`;
      const destPath = `${destDir}/${fileName}`;
      const result = await RNFS.downloadFile({fromUrl: cert.fileUrl, toFile: destPath}).promise;
      if (result.statusCode === 200) {
        Alert.alert(
          'Downloaded!',
          Platform.OS === 'android'
            ? `Saved to Downloads:\n${fileName}`
            : `Saved to Files:\n${fileName}`,
          [
            {text: 'OK'},
            ...(Platform.OS === 'ios'
              ? [{text: 'Open', onPress: () => Linking.openURL(`file://${destPath}`)}]
              : []),
          ],
        );
      } else {
        throw new Error(`Status ${result.statusCode}`);
      }
    } catch {
      Alert.alert('Download Failed', 'Open in browser instead?', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open', onPress: () => cert.fileUrl && Linking.openURL(cert.fileUrl)},
      ]);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textMuted}]}>
          Loading pending certificates…
        </Text>
      </View>
    );
  }

  const renderItem = ({item}: {item: Certificate}) => {
    const isProcessing = processingId === item._id;
    const points = getPotentialPoints(item);

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderLeftColor: colors.cardWarn === '#422006' ? '#f59e0b' : '#f59e0b',
          },
        ]}>
        {/* Student info */}
        <View style={styles.cardTop}>
          <View>
            <Text style={[styles.studentName, {color: colors.text}]}>
              {item.student?.name || 'N/A'}
            </Text>
            <Text style={[styles.regNo, {color: colors.textMuted}]}>
              {item.student?.registerNumber}
            </Text>
          </View>
          {points > 0 && (
            <View style={[styles.pointsBadge, {backgroundColor: colors.primaryMuted}]}>
              <Icon name="star-outline" size={12} color={colors.primary} />
              <Text style={[styles.pointsText, {color: colors.primary}]}>
                {points} pts
              </Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.details}>
          <DetailRow
            label="Category"
            value={item.category?.name || 'N/A'}
            colors={colors}
          />
          <DetailRow
            label="Subcategory"
            value={item.subcategory || 'N/A'}
            colors={colors}
          />
          {item.eventName && (
            <DetailRow label="Event" value={item.eventName} colors={colors} />
          )}
          {(item.level || item.prizeType) && (
            <DetailRow
              label="Level / Prize"
              value={[item.level, item.prizeType].filter(Boolean).join(' · ')}
              colors={colors}
            />
          )}
          {(item.dateFrom || item.dateTo) && (
            <DetailRow
              label="Duration"
              value={[
                item.dateFrom
                  ? new Date(item.dateFrom).toLocaleDateString('en-IN')
                  : '—',
                item.dateTo && item.dateTo !== item.dateFrom
                  ? new Date(item.dateTo).toLocaleDateString('en-IN')
                  : null,
              ]
                .filter(Boolean)
                .join(' → ')}
              colors={colors}
            />
          )}
        </View>

        {/* File + edit links */}
        <View style={styles.linkRow}>
          {item.fileUrl && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(item.fileUrl!)}>
              <Icon name="eye-outline" size={14} color={colors.primary} />
              <Text style={[styles.linkText, {color: colors.primary}]}>
                View
              </Text>
            </TouchableOpacity>
          )}
          {item.fileUrl && (
            <TouchableOpacity
              style={[
                styles.linkBtn,
                downloadingId === item._id && {opacity: 0.5},
              ]}
              onPress={() => handleDownload(item)}
              disabled={downloadingId === item._id}>
              {downloadingId === item._id ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <Icon name="download-outline" size={14} color="#059669" />
                  <Text style={[styles.linkText, {color: '#059669'}]}>
                    Download
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => openEdit(item)}>
            <Icon name="pencil-outline" size={14} color="#2563eb" />
            <Text style={[styles.linkText, {color: '#2563eb'}]}>
              Edit Assignment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnApprove, isProcessing && styles.btnDisabled]}
            onPress={() => handleApprove(item._id)}
            disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="check-circle-outline" size={16} color="#fff" />
                <Text style={styles.btnApproveText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnReject, isProcessing && styles.btnDisabled]}
            onPress={() => {
              setRejectCert(item);
              setRejectReason('');
            }}
            disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color="#dc2626" size="small" />
            ) : (
              <>
                <Icon name="close-circle-outline" size={16} color="#dc2626" />
                <Text style={styles.btnRejectText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      <FlatList
        data={certs}
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
            <Icon name="check-decagram-outline" size={52} color="#22c55e" />
            <Text style={[styles.emptyTitle, {color: '#15803d'}]}>
              All caught up!
            </Text>
            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
              No pending certificates.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Reject Modal ── */}
      <Modal
        visible={!!rejectCert}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectCert(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, {backgroundColor: colors.card}]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={[styles.modalTitle, {color: colors.text}]}>
                  Reject Certificate
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRejectCert(null)}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, {color: colors.textMuted}]}>
              <Text style={{fontWeight: '700', color: colors.text}}>
                {rejectCert?.student?.name}
              </Text>{' '}
              — {rejectCert?.category?.name} / {rejectCert?.subcategory}
            </Text>
            <Text style={[styles.rejectLabel, {color: colors.textSub}]}>
              Reason for rejection{' '}
              <Text style={{color: '#dc2626'}}>*</Text>
            </Text>
            <Text style={[styles.rejectHint, {color: colors.textMuted}]}>
              The student will see this message.
            </Text>
            <TextInput
              style={[
                styles.rejectInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Certificate image is blurry. Please re-upload a clear scan."
              placeholderTextColor={colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, {borderColor: colors.border}]}
                onPress={() => setRejectCert(null)}>
                <Text style={[styles.modalCancelText, {color: colors.textSub}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  {backgroundColor: '#dc2626'},
                  !rejectReason.trim() && styles.btnDisabled,
                ]}
                onPress={submitReject}
                disabled={!rejectReason.trim()}>
                <Text style={styles.modalConfirmText}>Reject Certificate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit/Reassign Modal ── */}
      <Modal
        visible={!!editCert}
        transparent
        animationType="fade"
        onRequestClose={() => setEditCert(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, {backgroundColor: colors.card}]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="pencil-outline" size={20} color="#2563eb" />
                <Text style={[styles.modalTitle, {color: colors.text}]}>
                  Reassign Certificate
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditCert(null)}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSub, {color: colors.textMuted}]}>
                <Text style={{fontWeight: '700', color: colors.text}}>
                  {editCert?.student?.name}
                </Text>{' '}
                — change category / subcategory / level
              </Text>

              <PickerField
                label="Category"
                value={editCatId}
                options={categories.map(c => ({value: c._id, label: c.name}))}
                onSelect={v => {
                  setEditCatId(v);
                  setEditSubcat('');
                  setEditLevel('');
                  setEditPrize('');
                }}
                colors={colors}
              />

              {editSubcats.length > 0 && (
                <PickerField
                  label="Subcategory"
                  value={editSubcat}
                  options={editSubcats.map((s: any) => ({
                    value: s.name,
                    label: s.name,
                  }))}
                  onSelect={v => {
                    setEditSubcat(v);
                    setEditLevel('');
                    setEditPrize('');
                  }}
                  colors={colors}
                />
              )}

              {editHasLevels && (
                <>
                  <PickerField
                    label="Level"
                    value={editLevel}
                    options={editCurrentSub.levels.map((l: any) => ({
                      value: l.name,
                      label: l.name,
                    }))}
                    onSelect={v => {
                      setEditLevel(v);
                      setEditPrize('');
                    }}
                    colors={colors}
                  />
                  <PickerField
                    label="Prize Type"
                    value={editPrize}
                    options={PRIZE_LEVELS.map(p => ({value: p, label: p}))}
                    onSelect={setEditPrize}
                    colors={colors}
                  />
                </>
              )}

              {getEditPoints() !== null && (
                <View
                  style={[
                    styles.pointsPreview,
                    {backgroundColor: colors.primaryMuted},
                  ]}>
                  <Icon name="star-outline" size={14} color={colors.primary} />
                  <Text style={[styles.pointsPreviewText, {color: colors.primary}]}>
                    Points after reassign: {getEditPoints()}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, {borderColor: colors.border}]}
                onPress={() => setEditCert(null)}>
                <Text style={[styles.modalCancelText, {color: colors.textSub}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  {backgroundColor: '#2563eb'},
                  (!editCatId || !editSubcat || editSaving) && styles.btnDisabled,
                ]}
                onPress={submitEdit}
                disabled={!editCatId || !editSubcat || editSaving}>
                {editSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, {color: colors.textMuted}]}>{label}:</Text>
      <Text style={[styles.detailValue, {color: colors.text}]}>{value}</Text>
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  onSelect,
  colors,
}: {
  label: string;
  value: string;
  options: {value: string; label: string}[];
  onSelect: (v: string) => void;
  colors: any;
}) {
  return (
    <View style={{marginTop: 12}}>
      <Text style={[styles.rejectLabel, {color: colors.textSub}]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 6}}>
        <View style={{flexDirection: 'row', gap: 8}}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    value === opt.value ? colors.primary : colors.inputBg,
                  borderColor:
                    value === opt.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(opt.value)}>
              <Text
                style={[
                  styles.chipText,
                  {color: value === opt.value ? '#fff' : colors.text},
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingText: {fontSize: 14},
  list: {padding: 12, paddingBottom: 20},
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    paddingBottom: 6,
  },
  studentName: {fontSize: 15, fontWeight: '700'},
  regNo: {fontSize: 12, marginTop: 2},
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pointsText: {fontSize: 12, fontWeight: '700'},
  details: {paddingHorizontal: 12, paddingBottom: 8},
  detailRow: {flexDirection: 'row', marginTop: 3, flexWrap: 'wrap'},
  detailLabel: {fontSize: 12, fontWeight: '600', marginRight: 4},
  detailValue: {fontSize: 12, flex: 1},
  linkRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  linkBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  linkText: {fontSize: 12, fontWeight: '600'},
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    paddingTop: 8,
  },
  btnApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnApproveText: {color: '#fff', fontWeight: '700', fontSize: 14},
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnRejectText: {color: '#dc2626', fontWeight: '700', fontSize: 14},
  btnDisabled: {opacity: 0.5},
  empty: {alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8},
  emptyTitle: {fontSize: 16, fontWeight: '700'},
  emptyText: {fontSize: 13},
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  modalTitle: {fontSize: 16, fontWeight: '700'},
  modalSub: {fontSize: 13, marginBottom: 12, lineHeight: 18},
  rejectLabel: {fontSize: 13, fontWeight: '600'},
  rejectHint: {fontSize: 11, marginBottom: 6},
  rejectInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 90,
    marginTop: 4,
  },
  modalActions: {flexDirection: 'row', gap: 10, marginTop: 14},
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
  },
  modalCancelText: {fontWeight: '600', fontSize: 14},
  modalConfirmBtn: {
    flex: 1.4,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 11,
  },
  modalConfirmText: {color: '#fff', fontWeight: '700', fontSize: 14},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {fontSize: 13, fontWeight: '600'},
  pointsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  pointsPreviewText: {fontSize: 13, fontWeight: '600'},
});
