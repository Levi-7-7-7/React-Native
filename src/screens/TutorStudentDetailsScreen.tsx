/**
 * TutorStudentDetailsScreen
 *
 * Full-screen detail page for a single student — mirrors the web StudentDetails.jsx:
 *   • Profile hero: avatar (photo or initials), name, reg, email, lateral badge
 *   • Stats: Raw Total | Capped Total | Pass / Fail status
 *   • Certificate list with status filter pills (all / pending / approved / rejected)
 *   • Tap any certificate → full-screen image/PDF viewer modal
 *
 * Route params:  { student: Student }   (passed from TutorStudentsScreen)
 */

import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  _id: string;
  name: string;
  email?: string;
  registerNumber: string;
  batch: string | {_id: string; name: string};
  branch: string | {_id: string; name: string};
  totalPoints: number;
  isLateralEntry?: boolean;
  profilePhoto?: string | null;
}

interface Certificate {
  _id: string;
  student?: {_id: string; name: string; registerNumber?: string};
  category?: {_id: string; name: string; subcategories?: any[]; maxPoints?: number};
  subcategory?: string;
  eventName?: string;
  level?: string;
  prizeType?: string;
  pointsAwarded?: number;
  dateFrom?: string;
  dateTo?: string;
  fileUrl?: string;
  status: string;
  rejectionReason?: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPdf(url = '') {
  return url.toLowerCase().includes('.pdf');
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'approved': return {bg: '#dcfce7', text: '#16a34a', border: '#86efac'};
    case 'rejected': return {bg: '#fee2e2', text: '#dc2626', border: '#fca5a5'};
    default:         return {bg: '#fef9c3', text: '#a16207', border: '#fde047'};
  }
}

function getStatusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case 'approved': return 'check-circle';
    case 'rejected': return 'close-circle';
    default:         return 'clock-outline';
  }
}

// ─── Certificate Viewer Modal ─────────────────────────────────────────────────

function CertViewerModal({
  cert,
  studentName,
  onClose,
}: {
  cert: Certificate;
  studentName: string;
  onClose: () => void;
}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);

  const url = cert.fileUrl || '';
  const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `${studentName}_${cert.subcategory || 'cert'}.${ext}`;

  const handleOpenExternal = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.viewerRoot, {backgroundColor: '#0f172a', paddingTop: insets.top}]}>
        {/* Toolbar */}
        <View style={styles.viewerToolbar}>
          <TouchableOpacity onPress={onClose} style={styles.viewerClose} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.viewerFilename} numberOfLines={1}>{fileName}</Text>
          <TouchableOpacity onPress={handleOpenExternal} style={styles.viewerOpenBtn} activeOpacity={0.7}>
            <Icon name="open-in-new" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {!url ? (
          // No file attached
          <View style={styles.viewerCenter}>
            <Icon name="file-alert-outline" size={52} color="#64748b" />
            <Text style={styles.viewerNoFile}>No file attached</Text>
          </View>
        ) : isPdf(url) ? (
          // PDF — open externally (no WebView dependency)
          <View style={styles.viewerCenter}>
            <View style={styles.pdfCard}>
              <Icon name="file-pdf-box" size={64} color="#ef4444" />
              <Text style={styles.pdfTitle}>PDF Certificate</Text>
              <Text style={styles.pdfSub} numberOfLines={2}>{fileName}</Text>
              <TouchableOpacity
                style={styles.pdfOpenBtn}
                onPress={handleOpenExternal}
                activeOpacity={0.8}>
                <Icon name="open-in-new" size={18} color="#fff" />
                <Text style={styles.pdfOpenText}>Open in Browser / PDF Viewer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Image — show inline with scroll/zoom
          <ScrollView
            contentContainerStyle={styles.viewerImgContainer}
            maximumZoomScale={4}
            minimumZoomScale={1}>
            <Image
              source={{uri: url}}
              style={styles.viewerImage}
              resizeMode="contain"
              onLoad={() => setLoaded(true)}
            />
            {!loaded && (
              <View style={StyleSheet.absoluteFillObject}>
                <View style={styles.viewerCenter}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={{color: '#94a3b8', marginTop: 10}}>Loading image…</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TutorStudentDetailsScreen() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const student: Student = route.params?.student;

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [viewingCert, setViewingCert] = useState<Certificate | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [certRes, catRes] = await Promise.all([
        tutorAxios.get('/tutors/certificates'),
        tutorAxios.get('/categories'),
      ]);

      const allCerts: Certificate[] = certRes.data.certificates || [];
      const studentCerts = allCerts.filter(
        c => (c.student?._id || c.student) === student._id,
      );
      setCertificates(studentCerts);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      console.error('Failed to fetch student details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Points summary ──────────────────────────────────────────────────────────
  const isLateralEntry = student.isLateralEntry ?? false;
  const requiredPoints = passThreshold(isLateralEntry);

  const {rawTotal, cappedTotal} = useMemo(() => {
    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    const raw = approved.reduce((s, c) => s + (c.pointsAwarded || 0), 0);
    const capped = calcCappedPoints(approved, categories, isLateralEntry);
    return {rawTotal: raw, cappedTotal: capped};
  }, [certificates, categories, isLateralEntry]);

  const hasPassed = cappedTotal >= requiredPoints;
  const ptsLeft = requiredPoints - cappedTotal;

  // ── Filtered certs ──────────────────────────────────────────────────────────
  const filteredCerts = useMemo(() => {
    if (filter === 'all') return certificates;
    return certificates.filter(c => c.status?.toLowerCase() === filter);
  }, [certificates, filter]);

  // ── Student info ────────────────────────────────────────────────────────────
  const studentName = student.name || '—';
  const initials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const studentReg = student.registerNumber || '';
  const studentEmail = student.email || '';

  const getBatchName = (b: any) => (typeof b === 'object' ? b?.name ?? '' : b ?? '');
  const getBranchName = (b: any) => (typeof b === 'object' ? b?.name ?? '' : b ?? '');

  // ── Points display for a cert ───────────────────────────────────────────────
  const displayPoints = (cert: Certificate): number => {
    if (cert.status?.toLowerCase() === 'approved') return cert.pointsAwarded ?? 0;
    const sub = cert.category?.subcategories?.find(
      s => s.name?.toLowerCase() === cert.subcategory?.toLowerCase(),
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

  // ── Render a certificate card ───────────────────────────────────────────────
  const renderCert = ({item}: {item: Certificate}) => {
    const sc = getStatusColor(item.status);
    const si = getStatusIcon(item.status);
    const pts = displayPoints(item);

    return (
      <View style={[styles.certCard, {backgroundColor: colors.card, borderColor: sc.border}]}>
        {/* Top row: status pill + category */}
        <View style={styles.certTop}>
          <View style={[styles.statusPill, {backgroundColor: sc.bg, borderColor: sc.border}]}>
            <Icon name={si} size={12} color={sc.text} />
            <Text style={[styles.statusPillText, {color: sc.text}]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
          <Text style={[styles.certCategory, {color: colors.text}]} numberOfLines={1}>
            {item.category?.name || '—'}
          </Text>
        </View>

        {/* Body */}
        <Text style={[styles.certSubcat, {color: colors.textMuted}]}>
          {item.subcategory || item.eventName || '—'}
        </Text>
        {(item.level || item.prizeType) ? (
          <Text style={[styles.certMeta, {color: colors.textMuted}]}>
            {[item.level, item.prizeType].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {/* Rejection reason */}
        {item.status?.toLowerCase() === 'rejected' && item.rejectionReason ? (
          <View style={[styles.rejectRow, {backgroundColor: '#fee2e2', borderColor: '#fca5a5'}]}>
            <Icon name="close-circle-outline" size={13} color="#dc2626" />
            <Text style={styles.rejectText} numberOfLines={3}>
              <Text style={{fontWeight: '700'}}>Rejected: </Text>
              {item.rejectionReason}
            </Text>
          </View>
        ) : null}

        {/* Footer: points + view button */}
        <View style={styles.certFooter}>
          <View style={[styles.ptsBadge, {backgroundColor: colors.primaryMuted}]}>
            <Icon name="star-outline" size={12} color={colors.primary} />
            <Text style={[styles.ptsBadgeText, {color: colors.primary}]}>{pts} pts</Text>
          </View>
          {item.fileUrl ? (
            <TouchableOpacity
              style={[styles.viewBtn, {backgroundColor: colors.primary}]}
              onPress={() => setViewingCert(item)}
              activeOpacity={0.8}>
              <Icon name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.viewBtn, {backgroundColor: colors.border}]}>
              <Icon name="file-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.viewBtnText, {color: colors.textMuted}]}>No file</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ─── Filter pill counts ──────────────────────────────────────────────────────
  const countFor = (s: FilterStatus) =>
    s === 'all' ? certificates.length : certificates.filter(c => c.status?.toLowerCase() === s).length;

  const FILTERS: FilterStatus[] = ['all', 'pending', 'approved', 'rejected'];

  // ─── Header (profile card + stats + filter pills) ────────────────────────────
  const ListHeader = () => (
    <View>
      {/* ── Profile hero ── */}
      <View style={[styles.profileCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
        <View style={styles.profileMain}>
          <View style={styles.avatarWrap}>
            {student.profilePhoto ? (
              <Image source={{uri: student.profilePhoto}} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarFallback, {backgroundColor: colors.primary}]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            {hasPassed && (
              <View style={styles.trophyBadge}>
                <Icon name="trophy" size={13} color="#854d0e" />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, {color: colors.text}]}>{studentName}</Text>
            <Text style={[styles.profileReg, {color: colors.textMuted}]}>{studentReg}</Text>
            {studentEmail ? (
              <Text style={[styles.profileEmail, {color: colors.textMuted}]}>{studentEmail}</Text>
            ) : null}
            <View style={styles.profileTagsRow}>
              {isLateralEntry && (
                <View style={styles.lateralBadge}>
                  <Text style={styles.lateralText}>Lateral Entry</Text>
                </View>
              )}
              <Text style={[styles.profileMeta, {color: colors.textMuted}]}>
                {getBatchName(student.batch)} · {getBranchName(student.branch)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats row ── */}
        <View style={[styles.statsRow, {borderColor: colors.border}]}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, {color: colors.textMuted}]}>{rawTotal}</Text>
            <Text style={[styles.statLabel, {color: colors.textMuted}]}>Raw Total</Text>
          </View>
          <View style={[styles.statDivider, {backgroundColor: colors.border}]} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, {color: colors.primary}]}>{cappedTotal}</Text>
            <Text style={[styles.statLabel, {color: colors.textMuted}]}>Capped Total</Text>
          </View>
          <View style={[styles.statDivider, {backgroundColor: colors.border}]} />
          <View style={styles.statBox}>
            {hasPassed ? (
              <>
                <View style={styles.passRow}>
                  <Icon name="check-circle" size={18} color="#16a34a" />
                  <Text style={[styles.statVal, {color: '#16a34a'}]}>Pass</Text>
                </View>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>
                  {requiredPoints} pts req.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.passRow}>
                  <Icon name="close-circle" size={18} color="#dc2626" />
                  <Text style={[styles.statVal, {color: '#dc2626'}]}>{ptsLeft} left</Text>
                </View>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>
                  {requiredPoints} pts req.
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Certificates header + filter pills ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>
          Certificates ({filteredCerts.length})
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}>
              <Text style={[styles.filterPillText, {color: active ? '#fff' : colors.textMuted}]}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({countFor(f)})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ─── Empty state ─────────────────────────────────────────────────────────────
  const ListEmpty = () =>
    loading ? null : (
      <View style={styles.empty}>
        <Icon name="certificate-outline" size={52} color={colors.textMuted} />
        <Text style={[styles.emptyText, {color: colors.textMuted}]}>
          {filter !== 'all' ? `No ${filter} certificates.` : 'No certificates uploaded yet.'}
        </Text>
      </View>
    );

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      {/* ── Back header ── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8,
          },
        ]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]} numberOfLines={1}>
          {studentName}
        </Text>
        <View style={{width: 38}} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, {color: colors.textMuted}]}>
            Loading student records…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCerts}
          keyExtractor={item => item._id}
          renderItem={renderCert}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* ── Certificate viewer ── */}
      {viewingCert && (
        <CertViewerModal
          cert={viewingCert}
          studentName={studentName}
          onClose={() => setViewingCert(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backBtn: {width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {marginTop: 10, fontSize: 14},
  listContent: {padding: 16, paddingBottom: 40},

  // Profile card
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  profileMain: {flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16},
  avatarWrap: {position: 'relative'},
  avatarImg: {width: 72, height: 72, borderRadius: 36},
  avatarFallback: {width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center'},
  avatarInitials: {color: '#fff', fontSize: 26, fontWeight: '800'},
  trophyBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fef9c3', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  profileInfo: {flex: 1, gap: 3},
  profileName: {fontSize: 18, fontWeight: '800'},
  profileReg: {fontSize: 13, fontWeight: '600'},
  profileEmail: {fontSize: 12},
  profileTagsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4},
  lateralBadge: {backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6},
  lateralText: {color: '#0369a1', fontSize: 11, fontWeight: '700'},
  profileMeta: {fontSize: 12, alignSelf: 'center'},

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  statBox: {flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4},
  statDivider: {width: 1},
  statVal: {fontSize: 20, fontWeight: '800'},
  statLabel: {fontSize: 11, fontWeight: '500', textAlign: 'center'},
  passRow: {flexDirection: 'row', alignItems: 'center', gap: 4},

  // Section header + filter pills
  sectionHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  sectionTitle: {fontSize: 16, fontWeight: '700'},
  filterRow: {gap: 8, paddingBottom: 14},
  filterPill: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5},
  filterPillText: {fontSize: 13, fontWeight: '600'},

  // Cert card
  certCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  certTop: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  statusPillText: {fontSize: 11, fontWeight: '700'},
  certCategory: {fontSize: 14, fontWeight: '700', flex: 1},
  certSubcat: {fontSize: 13, marginBottom: 2},
  certMeta: {fontSize: 12, marginBottom: 4},
  rejectRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    padding: 8, borderRadius: 8, borderWidth: 1, marginVertical: 6,
  },
  rejectText: {fontSize: 12, color: '#dc2626', flex: 1},
  certFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10},
  ptsBadge: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8},
  ptsBadgeText: {fontSize: 12, fontWeight: '700'},
  viewBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10},
  viewBtnText: {color: '#fff', fontSize: 13, fontWeight: '600'},

  // Empty
  empty: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyText: {fontSize: 14, textAlign: 'center'},

  // Cert viewer modal
  viewerRoot: {flex: 1},
  viewerToolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#1e293b',
  },
  viewerClose: {padding: 6},
  viewerFilename: {flex: 1, color: '#f1f5f9', fontSize: 13, fontWeight: '600', marginHorizontal: 10},
  viewerOpenBtn: {padding: 6},
  viewerCenter: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  viewerNoFile: {color: '#64748b', marginTop: 10, fontSize: 14},
  viewerImgContainer: {flexGrow: 1, alignItems: 'center', justifyContent: 'center'},
  viewerImage: {width: '100%', height: 480},
  pdfCard: {
    alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 20, padding: 32, marginHorizontal: 32, gap: 12,
  },
  pdfTitle: {color: '#f1f5f9', fontSize: 18, fontWeight: '700'},
  pdfSub: {color: '#94a3b8', fontSize: 13, textAlign: 'center'},
  pdfOpenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 8,
  },
  pdfOpenText: {color: '#fff', fontSize: 14, fontWeight: '700'},
});
