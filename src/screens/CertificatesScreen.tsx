import React, {useState, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import axiosInstance from '../api/axiosInstance';
import {useAuth} from '../context/AuthContext';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';
import {useTheme} from '../theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// In DashboardScreen, CertificatesScreen, UploadCertificateScreen
import { ScrollView } from 'react-native-gesture-handler'; // ← use this, not react-native!

const FILTERS = ['all', 'approved', 'pending', 'rejected'];

// /** Opens a certificate URL in the device's browser / Drive / built-in viewer */
// const openFile = (url: string) => {
//   Linking.canOpenURL(url).then(supported => {
//     if (supported) {
//       Linking.openURL(url);
//     } else {
//       Alert.alert('Error', 'Cannot open this file on your device.');
//     }
//   });
// };

const openFile = async (url: string) => {
  try {
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert('Error', 'Cannot open this file.');
      return;
    }

    await Linking.openURL(url);
  } catch (error) {
    Alert.alert(
      'Open Failed',
      'No compatible app found to open this file.',
    );
  }
};

export default function CertificatesScreen() {
  const {user} = useAuth();
  const {colors} = useTheme();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [certRes, catRes] = await Promise.all([
        axiosInstance.get('/certificates/my'),
        axiosInstance.get('/categories'),
      ]);
      setCertificates(certRes.data.certificates || []);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load certificates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalPoints = useMemo(() => {
    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    return calcCappedPoints(approved, categories, user?.isLateralEntry ?? false);
  }, [certificates, categories, user]);

  const PASS_POINTS = passThreshold(user?.isLateralEntry);

  const filteredCertificates =
    activeFilter === 'all'
      ? certificates
      : certificates.filter(c => c.status?.toLowerCase() === activeFilter);

  const displayPoints = (cert: any) => {
    if (cert.status?.toLowerCase() === 'approved') return cert.pointsAwarded ?? 0;
    return cert.potentialPoints ?? 0;
  };

  const getStatusColors = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return {bg: colors.badgeApprovedBg, text: colors.badgeApprovedText};
      case 'pending':  return {bg: colors.badgePendingBg,  text: colors.badgePendingText};
      case 'rejected': return {bg: colors.badgeRejectedBg, text: colors.badgeRejectedText};
      default:         return {bg: colors.border,          text: colors.textMuted};
    }
  };

// const handleViewCert = (cert: any) => {
//   if (!cert.fileUrl) {
//     Alert.alert('No file', 'No file attached to this certificate.');
//     return;
//   }

//   openFile(cert.fileUrl);
// };

  // /** Download = open in browser; system handles saving */
  // const handleDownloadOne = (cert: any) => {
  //   if (!cert.fileUrl) { Alert.alert('No file', 'No file attached to this certificate.'); return; }
  //   openFile(cert.fileUrl);
  // };

  const handleCancelCert = (cert: any) => {
    Alert.alert(
      'Cancel Certificate',
      `Cancel and delete "${cert.eventName || cert.subcategory || 'this certificate'}"? This cannot be undone.`,
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(cert._id);
            try {
              await axiosInstance.delete(`/certificates/${cert._id}`);
              setCertificates(prev => prev.filter(c => c._id !== cert._id));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to cancel.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.bg}]}>
      <ScrollView
        style={[styles.container, {backgroundColor: colors.bg}]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {setRefreshing(true); fetchData();}}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>

        {/* Title */}
        <Text style={[styles.pageTitle, {color: colors.primary}]}>My Certificates</Text>

        {/* Summary card */}
        <View style={[styles.summaryCard, {backgroundColor: colors.cardBlue}]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryPoints}>{totalPoints}</Text>
            <Text style={[styles.summaryLabel, {color: colors.pointsLabel}]}>Total Points (Capped)</Text>
            <Text style={[styles.summaryOf, {color: colors.pointsOf}]}>of {PASS_POINTS} required</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryCount}>{certificates.length}</Text>
            <Text style={[styles.summaryCountLabel, {color: colors.pointsLabel}]}>
              {certificates.length === 1 ? 'certificate' : 'certificates'} submitted
            </Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map(f => {
            const count = f === 'all' ? null : certificates.filter(c => c.status?.toLowerCase() === f).length;
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, {backgroundColor: isActive ? colors.primary : colors.filterInactive, borderColor: isActive ? colors.primary : colors.border}]}
                onPress={() => setActiveFilter(f)}>
                <Text style={[styles.filterText, {color: isActive ? '#fff' : colors.filterText}]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}{count !== null ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {loading ? (
          [1,2,3].map(n => (
            <View key={n} style={[styles.skeletonCard, {backgroundColor: colors.card}]}>
              <View style={[styles.skeletonLine, {backgroundColor: colors.skeleton}]} />
              <View style={[styles.skeletonLine, {width: '60%', marginTop: 8, backgroundColor: colors.skeleton}]} />
            </View>
          ))
        ) : filteredCertificates.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={54}
            color={colors.textMuted}
          />

          <Text style={[styles.emptyTitle, {color: colors.textSub}]}>
            No certificates found
          </Text>

          <Text style={[styles.emptySub, {color: colors.textMuted}]}>
            {activeFilter === 'all'
              ? "You haven't submitted any certificates yet."
              : `No ${activeFilter} certificates.`}
          </Text>
        </View>
        ) : (
          filteredCertificates.map(cert => {
            const {bg: badgeBg, text: badgeText} = getStatusColors(cert.status);
            const isDeleting = deletingId === cert._id;
            return (
              <View key={cert._id} style={[styles.certCard, {backgroundColor: colors.card}]}>
                <View style={styles.certHeader}>
                  <Text style={[styles.certName, {color: colors.text}]} numberOfLines={2}>
                    {cert.eventName || cert.subcategory || 'Certificate'}
                  </Text>
                  <MaterialCommunityIcons
                    name={cert.status?.toLowerCase() === 'approved' ? 'check-circle-outline' : cert.status?.toLowerCase() === 'pending' ? 'clock-outline' : 'close-circle-outline'}
                    size={22} color="#555"
                  />
                </View>

                {cert.category?.name && (
                  <View style={[styles.catBadge, {backgroundColor: colors.primaryMuted}]}>
                    <Text style={[styles.catBadgeText, {color: colors.primary}]}>{cert.category.name}</Text>
                  </View>
                )}

                {(cert.level || cert.prizeType) && (
                 <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 6}}>
                  <MaterialCommunityIcons
                    name="medal-outline"
                    size={16}
                    color={colors.textSub}
                    style={{marginRight: 4}}
                  />

                  <Text style={[styles.levelText, {color: colors.textSub}]}>
                    {cert.level}
                    {cert.level && cert.prizeType ? ' — ' : ''}
                    {cert.prizeType}
                  </Text>
                </View>
                )}

                <View style={[styles.statusBadge, {backgroundColor: badgeBg}]}>
                  <Text style={[styles.statusBadgeText, {color: badgeText}]}>{cert.status}</Text>
                </View>

                <View style={[styles.certFooter, {borderTopColor: colors.borderLight}]}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={15}
                      color={colors.textMuted}
                    />
                    <Text style={[styles.certDate, {color: colors.textMuted}]}>
                      {cert.createdAt
                        ? new Date(cert.createdAt).toLocaleDateString()
                        : '—'}
                    </Text>

                  </View>
                  <Text style={[styles.certPoints, {color: colors.badgeApprovedText}]}>
                    +{displayPoints(cert)} pts
                  </Text>
                </View>

                {cert.status?.toLowerCase() === 'rejected' && (
                  <View style={[styles.rejectedBox, {backgroundColor: colors.cardDanger}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                      <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.dangerText} />
                      <Text style={[styles.rejectedTitle, {color: colors.dangerText}]}>Certificate Rejected</Text>
                    </View>
                    <Text style={[styles.rejectedReason, {color: colors.dangerSub}]}>
                      {cert.rejectionReason || 'No reason provided. Please contact your tutor.'}
                    </Text>
                    <Text style={[styles.rejectedHint, {color: colors.dangerHint}]}>
                      You can re-upload a corrected certificate.
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  {/* {cert.fileUrl && (
                    <TouchableOpacity
                      style={[styles.actionBtn, {backgroundColor: colors.primaryMuted}]}
                      onPress={() => handleViewCert(cert)}>
                      <MaterialCommunityIcons name="eye-outline" size={16} color={colors.primary} />
                      <Text style={[styles.actionBtnText, {color: colors.primary}]}>View</Text>
                    </TouchableOpacity>
                  )} */}
                  {cert.fileUrl && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {backgroundColor: colors.primaryMuted},
                      ]}
                      onPress={() => openFile(cert.fileUrl)}>
                      <MaterialCommunityIcons
                        name="open-in-new"
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          {color: colors.primary},
                        ]}>
                        Open File
                      </Text>
                    </TouchableOpacity>
                  )}
                  {cert.status?.toLowerCase() === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, {backgroundColor: colors.cardDanger}, isDeleting && styles.btnDisabled]}
                      onPress={() => handleCancelCert(cert)}
                      disabled={isDeleting}>
                      {isDeleting
                        ? <ActivityIndicator size="small" color={colors.dangerText} />
                        : <>
                            <MaterialCommunityIcons name="delete-outline" size={16} color={colors.dangerText} />
                            <Text style={[styles.actionBtnText, {color: colors.dangerText}]}>Cancel</Text>
                          </>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1},
  content: {padding: 16, paddingBottom: 24},
  pageTitle: {fontSize: 22, fontWeight: '800', marginBottom: 12},
  summaryCard: {borderRadius: 16, padding: 16, flexDirection: 'row', marginBottom: 14, shadowColor: '#1e3a8a', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6},
  summaryLeft: {flex: 1},
  summaryPoints: {fontSize: 32, fontWeight: '800', color: '#fff'},
  summaryLabel: {fontSize: 12},
  summaryOf: {fontSize: 11, marginTop: 2},
  summaryRight: {alignItems: 'flex-end', justifyContent: 'center'},
  summaryCount: {fontSize: 22, fontWeight: '700', color: '#fff'},
  summaryCountLabel: {fontSize: 12, textAlign: 'right'},
  filterRow: {marginBottom: 12},
  filterBtn: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1.5},
  filterText: {fontSize: 13, fontWeight: '600'},
  certCard: {borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3},
  certHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  certName: {flex: 1, fontSize: 15, fontWeight: '700', marginRight: 8},
  catBadge: {borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6},
  catBadgeText: {fontSize: 12, fontWeight: '600'},
  levelText: {fontSize: 13, marginTop: 6},
  statusBadge: {alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8},
  statusBadgeText: {fontSize: 12, fontWeight: '700'},
  certFooter: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1},
  certDate: {fontSize: 13},
  certPoints: {fontSize: 14, fontWeight: '700'},
  rejectedBox: {borderRadius: 10, padding: 10, marginTop: 10},
  rejectedTitle: {fontWeight: '700', fontSize: 13},
  rejectedReason: {fontSize: 13, marginTop: 4},
  rejectedHint: {fontSize: 12, marginTop: 4, fontStyle: 'italic'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap'},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, flex: 1, justifyContent: 'center', minHeight: 40, minWidth: 70},
  actionBtnText: {fontWeight: '600', fontSize: 13},
  btnDisabled: {opacity: 0.5},
  skeletonCard: {borderRadius: 14, padding: 14, marginBottom: 12},
  skeletonLine: {height: 16, borderRadius: 8, width: '80%'},
  emptyState: {alignItems: 'center', paddingVertical: 40},
  emptyEmoji: {fontSize: 48, marginBottom: 12},
  emptyTitle: {fontSize: 18, fontWeight: '700'},
  emptySub: {fontSize: 14, marginTop: 6, textAlign: 'center'},
});
