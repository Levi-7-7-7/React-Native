import React, {useEffect, useState, useCallback, useMemo, useRef} from 'react';
import RNFS from 'react-native-fs';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Alert,
  Platform,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {generatePDF} from 'react-native-html-to-pdf';
import {useNavigation} from '@react-navigation/native';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';

const logoPath = Image.resolveAssetSource(
  require('../assets/mti-logo.png'),
).uri;

const getLogoUri = (path: string) => {
  if (!path) {return '';}
  if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('data:')) {
    return path;
  }
  return `file:///android_res/drawable/${path}.png`;
};

const clearPdfCache = async () => {
  const pathsToClean = [
    RNFS.CachesDirectoryPath,
    Platform.OS === 'android' ? RNFS.TemporaryDirectoryPath : null,
  ].filter(Boolean) as string[];

  for (const dirPath of pathsToClean) {
    try {
      const exists = await RNFS.exists(dirPath);
      if (!exists) {continue;}
      const files = await RNFS.readDir(dirPath);
      for (const file of files) {
        if (file.isFile()) {
          const name = file.name.toLowerCase();
          if (name.endsWith('.pdf') || name.endsWith('.html') || name.includes('print') || name.includes('.tmp')) {
            await RNFS.unlink(file.path).catch(() => {});
          }
        }
      }
    } catch {}
  }
};

interface Student {
  _id: string;
  name: string;
  email?: string;
  registerNumber: string;
  batch: string | {_id: string; name: string};
  branch: string | {_id: string; name: string};
  totalPoints: number;
  isLateralEntry?: boolean;
  createdAt?: string;
  profilePhoto?: string | null;
}

interface Certificate {
  _id: string;
  student?: {_id: string; name: string};
  category?: {_id: string; name: string};
  subcategory?: string;
  eventName?: string;
  level?: string;
  prizeType?: string;
  pointsAwarded?: number;
  dateFrom?: string;
  fileUrl?: string;
  status: string;
}

type SortKey = 'registerNumber' | 'totalPoints' | 'batch' | 'branch' | 'recentlyAdded' | 'name';
type SortDir = 'asc' | 'desc';

interface SortOption {
  key: SortKey;
  label: string;
  icon: string;
}

const SORT_OPTIONS: SortOption[] = [
  {key: 'registerNumber', label: 'Register Number', icon: 'identifier'},
  {key: 'totalPoints',    label: 'Total Points',    icon: 'star-outline'},
  {key: 'batch',          label: 'Batch',           icon: 'calendar-outline'},
  {key: 'branch',         label: 'Branch',          icon: 'school-outline'},
  {key: 'recentlyAdded',  label: 'Recently Added',  icon: 'clock-outline'},
  {key: 'name',           label: 'Name',            icon: 'account-outline'},
];

function getBatchName(b: Student['batch']): string {
  return typeof b === 'object' ? b?.name ?? '' : b ?? '';
}
function getBranchName(b: Student['branch']): string {
  return typeof b === 'object' ? b?.name ?? '' : b ?? '';
}

function sortStudents(list: Student[], key: SortKey, dir: SortDir): Student[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (key) {
      case 'registerNumber': av = a.registerNumber?.toLowerCase() ?? ''; bv = b.registerNumber?.toLowerCase() ?? ''; break;
      case 'totalPoints':    av = a.totalPoints ?? 0; bv = b.totalPoints ?? 0; break;
      case 'batch':          av = getBatchName(a.batch).toLowerCase(); bv = getBatchName(b.batch).toLowerCase(); break;
      case 'branch':         av = getBranchName(a.branch).toLowerCase(); bv = getBranchName(b.branch).toLowerCase(); break;
      case 'recentlyAdded':  av = a.createdAt ? new Date(a.createdAt).getTime() : 0; bv = b.createdAt ? new Date(b.createdAt).getTime() : 0; break;
      default: av = a.name?.toLowerCase() ?? ''; bv = b.name?.toLowerCase() ?? ''; break;
    }
    if (typeof av === 'number' && typeof bv === 'number') {return (av - bv) * m;}
    return String(av).localeCompare(String(bv)) * m;
  });
}

function buildPdfHtml(
  students: Student[],
  certsByStudent: Record<string, Certificate[]>,
  tutorBranch?: string,
  tutorBatch?: string,
): string {
  const today = new Date().toLocaleDateString('en-IN', {day: '2-digit', month: 'long', year: 'numeric'});
  const deptName = tutorBranch ? `DEPARTMENT OF ${tutorBranch.toUpperCase()}` : 'DEPARTMENT';
  const batchLabel = tutorBatch ? ` — BATCH ${tutorBatch}` : '';

  const tableBodiesHtml = students.map((student, idx) => {
    const certs = certsByStudent[student._id] || [];
    const approved = certs.filter(c => c.status === 'approved');
    const computedTotal = calcCappedPoints(approved, [], student.isLateralEntry);
    const threshold = passThreshold(student.isLateralEntry);
    const isPassing = computedTotal >= threshold;
    const totalRowsCount = approved.length > 0 ? approved.length + 1 : 2;

    let rowGroupHtml = `
      <tr class="student-profile-row">
        <td rowspan="${totalRowsCount}" class="sl-cell">${idx + 1}</td>
        <td class="student-name-meta">
          <div class="name-text">${student.name || '—'}</div>
          <div class="reg-text">Reg No: <b>${student.registerNumber || '—'}</b> ${student.isLateralEntry ? '<span class="lat-label">(Lateral Entry)</span>' : ''}</div>
        </td>
        <td class="points-cell pt-blank"></td>
        <td rowspan="${totalRowsCount}" class="total-score-cell">${computedTotal}</td>
        <td rowspan="${totalRowsCount}" class="status-trophy-cell">
          ${isPassing ? '<div class="trophy-wrapper"><span class="material-icons">emoji_events</span></div>' : ''}
        </td>
      </tr>
    `;

    if (approved.length === 0) {
      rowGroupHtml += `<tr class="cert-item-row"><td class="cert-name-cell empty-certs-text">No approved activities logged</td><td class="points-cell">—</td></tr>`;
    } else {
      approved.forEach(cert => {
        rowGroupHtml += `<tr class="cert-item-row"><td class="cert-name-cell">${cert.eventName || cert.subcategory || '—'}</td><td class="points-cell">${cert.pointsAwarded ?? 0}</td></tr>`;
      });
    }

    return `<tbody class="student-ledger-group">${rowGroupHtml}</tbody>`;
  }).join('');

  const logoHtml = `<img src="${getLogoUri(logoPath)}" style="width: 80px; height: auto; display: block;" />`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
<style>
@page{margin:25px 20px 35px 20px;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;background-color:#ffffff;-webkit-print-color-adjust:exact;}
.header{display:table;width:100%;padding-bottom:12px;border-bottom:2px solid #0f2864;margin-bottom:10px;}
.header-logo-cell{display:table-cell;vertical-align:middle;width:90px;}
.header-text{display:table-cell;vertical-align:middle;text-align:center;}
.dept-name{font-size:15px;font-weight:800;color:#0f2864;letter-spacing:0.5px;margin-bottom:2px;}
.inst-name{font-size:11.5px;font-weight:700;color:#1e293b;}
.inst-sub{font-size:8px;color:#64748b;margin-top:1px;font-weight:500;}
.title-band{background:#0f2864;color:#ffffff;text-align:center;padding:8px 10px;font-size:12px;font-weight:700;border-radius:4px;margin:12px 0 20px 0;letter-spacing:0.75px;}
.ledger-table{width:100%;border-collapse:collapse;font-size:10px;background-color:#ffffff;}
.ledger-table th{background-color:#0f2864;color:#ffffff;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;padding:8px 10px;border:1px solid #0f2864;}
.student-ledger-group{page-break-inside:avoid;}
.student-profile-row{background-color:#f8fafc;}
.student-profile-row td{border:1px solid #cbd5e1;}
.sl-cell{text-align:center;font-weight:700;color:#475569;background-color:#f1f5f9;width:45px;}
.student-name-meta{padding:8px 10px;background-color:#f8fafc;}
.name-text{font-size:12.5px;font-weight:700;color:#0f2864;text-transform:uppercase;}
.reg-text{font-size:9px;color:#475569;margin-top:2px;}
.lat-label{color:#b45309;font-weight:700;font-size:8px;margin-left:4px;}
.cert-item-row td{border:1px solid #e2e8f0;padding:6px 12px;}
.cert-name-cell{color:#334155;font-size:9.5px;font-weight:500;padding-left:20px!important;}
.empty-certs-text{color:#94a3b8;font-style:italic;}
.points-cell{text-align:center;font-weight:600;color:#475569;width:65px;}
.pt-blank{background-color:#f8fafc;border-bottom:1px solid #cbd5e1!important;}
.total-score-cell{text-align:center;font-size:18px;font-weight:800;color:#0f2864;background-color:#fff;border:1px solid #cbd5e1!important;width:75px;}
.status-trophy-cell{text-align:center;background-color:#fff;border:1px solid #cbd5e1!important;width:70px;}
.trophy-wrapper{display:inline-flex;align-items:center;justify-content:center;}
.material-icons{font-family:'Material Icons';font-weight:normal;font-style:normal;font-size:36px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;direction:ltr;color:#d97706;-webkit-font-smoothing:antialiased;}
.divider{border:none;border-top:2px solid #e2e8f0;margin:24px 0 8px 0;}
.report-meta-footer{font-size:8.5px;color:#64748b;font-weight:500;}
</style></head><body><div class="page">
<div class="header">
  <div class="header-logo-cell">${logoHtml}</div>
  <div class="header-text">
    <div class="dept-name">${deptName}</div>
    <div class="inst-name">MAHARAJA&#39;S TECHNOLOGICAL INSTITUTE (MTI)</div>
    <div class="inst-sub">Chembukkavu, Thrissur, Kerala – 680020</div>
    <div class="inst-sub">Affiliated to SBTE Kerala | AICTE Approved | Estd. 1946</div>
    <div class="inst-sub">Phone: 0487-2333290 | E-Mail: mtithrsr@mtithrissur.ac.in</div>
  </div>
  <div class="header-logo-cell" style="width:20px;"></div>
</div>
<div class="title-band">STUDENT ACTIVITY POINTS REPORT${batchLabel}</div>
<table class="ledger-table">
  <thead><tr>
    <th style="width:45px;">SI:NO</th>
    <th style="text-align:left;">NAME / ACTIVITY SPECIFICATIONS</th>
    <th style="width:65px;">POINTS</th>
    <th style="width:75px;">TOTAL</th>
    <th style="width:70px;">STATUS</th>
  </tr></thead>
  ${tableBodiesHtml}
</table>
<hr class="divider"/>
<div class="report-meta-footer">Generated on <b>${today}</b> &nbsp;|&nbsp; Comprehensive Registry Size: <b>${students.length} Record${students.length !== 1 ? 's' : ''}</b></div>
</div></body></html>`;
}

// Memoized student card
const StudentCard = React.memo(({
  item,
  colors,
  onPress,
}: {
  item: Student;
  colors: any;
  onPress: () => void;
}) => {
  const batchName  = getBatchName(item.batch);
  const branchName = getBranchName(item.branch);
  const threshold  = passThreshold(item.isLateralEntry);
  const isPassing  = (item.totalPoints ?? 0) >= threshold;
  const initials   = item.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
      onPress={onPress}
      activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.avatarSmall}>
          {item.profilePhoto ? (
            <Image source={{uri: item.profilePhoto}} style={styles.avatarSmallImage} fadeDuration={0} />
          ) : (
            <Text style={styles.avatarSmallText}>{initials}</Text>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.studentName, {color: colors.text}]}>{item.name}</Text>
          <Text style={[styles.regNo, {color: colors.textMuted}]}>{item.registerNumber}</Text>
        </View>
        <View style={styles.pointsCol}>
          <View style={[styles.pointsBadge, {backgroundColor: colors.primaryMuted}]}>
            <Icon name="star-outline" size={11} color={colors.primary} />
            <Text style={[styles.pointsText, {color: colors.primary}]}>{item.totalPoints ?? 0} pts</Text>
          </View>
          {isPassing && (
            <View style={styles.trophyAppBadge}>
              <Icon name="trophy" size={13} color="#854d0e" />
              <Text style={styles.trophyAppText}>Pass</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.cardFooter, {borderTopColor: colors.borderLight}]}>
        <View style={styles.metaItem}>
          <Icon name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.metaText, {color: colors.textMuted}]}>{batchName || 'N/A'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="school-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.metaText, {color: colors.textMuted}]}>{branchName || 'N/A'}</Text>
        </View>
        {item.isLateralEntry && (
          <View style={styles.lateralBadge}>
            <Text style={styles.lateralText}>Lateral Entry</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function TutorStudentsScreen() {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('registerNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [filterBatch, setFilterBatch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const sortBadgeAnim = useRef(new Animated.Value(1)).current;

  const fetchStudents = useCallback(async () => {
    try {
      const res = await tutorAxios.get('/tutors/students');
      setStudents(res.data.students || res.data || []);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents();
  }, [fetchStudents]);

  const allBatches = useMemo(
    () => [...new Set(students.map(s => getBatchName(s.batch)).filter(Boolean))].sort(),
    [students],
  );
  const allBranches = useMemo(
    () => [...new Set(students.map(s => getBranchName(s.branch)).filter(Boolean))].sort(),
    [students],
  );

  const displayedStudents = useMemo(() => {
    let result = students;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        s => s.name?.toLowerCase().includes(q) || s.registerNumber?.toLowerCase().includes(q),
      );
    }
    if (filterBatch) {result = result.filter(s => getBatchName(s.batch) === filterBatch);}
    if (filterBranch) {result = result.filter(s => getBranchName(s.branch) === filterBranch);}
    return sortStudents(result, sortKey, sortDir);
  }, [students, search, filterBatch, filterBranch, sortKey, sortDir]);

  const activeFilterCount = (filterBatch ? 1 : 0) + (filterBranch ? 1 : 0);
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? 'Sort';

  const handleSortSelect = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'totalPoints' || key === 'recentlyAdded' ? 'desc' : 'asc');
    }
    Animated.sequence([
      Animated.timing(sortBadgeAnim, {toValue: 1.15, duration: 100, useNativeDriver: true}),
      Animated.timing(sortBadgeAnim, {toValue: 1, duration: 100, useNativeDriver: true}),
    ]).start();
    setSortModalVisible(false);
  }, [sortKey, sortBadgeAnim]);

  const clearFilters = useCallback(() => {
    setFilterBatch('');
    setFilterBranch('');
    setFilterModalVisible(false);
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (displayedStudents.length === 0) {
      Alert.alert('No Students', 'There are no students to export.');
      return;
    }
    setPdfLoading(true);
    let generatedFilePath = '';
    try {
      const certRes = await tutorAxios.get('/tutors/certificates');
      const allCerts: Certificate[] = certRes.data.certificates || [];
      const certsByStudent: Record<string, Certificate[]> = {};
      allCerts.forEach(cert => {
        const sid = (cert.student as any)?._id || cert.student;
        if (!sid) {return;}
        const key = sid.toString();
        if (!certsByStudent[key]) {certsByStudent[key] = [];}
        certsByStudent[key].push(cert);
      });

      const firstStudent = displayedStudents[0];
      const tutorBranch = getBranchName(firstStudent?.branch) || undefined;
      const tutorBatch = getBatchName(firstStudent?.batch) || undefined;
      const html = buildPdfHtml(displayedStudents, certsByStudent, tutorBranch, tutorBatch);

      const branchSlug = (tutorBranch || 'dept').replace(/\s+/g, '_').toLowerCase();
      const batchSlug = (tutorBatch || 'batch').replace(/\s+/g, '_').toLowerCase();
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}).replace(/ /g, '-');
      const formattedTime = now.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit', hour12: true}).replace(/:/g, '-').replace(/\s/g, '');
      const fileName = `${branchSlug}_${batchSlug}_${formattedDate}_${formattedTime}`;

      const pdf = await generatePDF({html, fileName, directory: 'Caches', width: 595, height: 842});
      if (!pdf.filePath) {throw new Error('PDF generation failed — no file path returned');}
      generatedFilePath = pdf.filePath;

      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
      if (await RNFS.exists(destPath)) {await RNFS.unlink(destPath);}
      await RNFS.copyFile(generatedFilePath, destPath);
      Alert.alert('PDF Saved to Downloads', `${fileName}.pdf has been saved to your Downloads folder.`);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not generate PDF');
    } finally {
      if (generatedFilePath) {
        try {
          if (await RNFS.exists(generatedFilePath)) {await RNFS.unlink(generatedFilePath);}
        } catch {}
      }
      await clearPdfCache();
      setPdfLoading(false);
    }
  }, [displayedStudents]);

  const renderItem = useCallback(({item}: {item: Student}) => (
    <StudentCard
      item={item}
      colors={colors}
      onPress={() => navigation.navigate('TutorStudentDetails', {student: item})}
    />
  ), [colors, navigation]);

  const keyExtractor = useCallback((item: Student) => item._id, []);

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textMuted}]}>Loading students…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      <View style={[styles.searchWrapper, {backgroundColor: colors.card, borderColor: colors.border}]}>
        <Icon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
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

      <View style={styles.toolbarRow}>
        <Animated.View style={{transform: [{scale: sortBadgeAnim}]}}>
          <TouchableOpacity
            style={[styles.toolbarBtn, {backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5}]}
            onPress={() => setSortModalVisible(true)}>
            <Icon name="sort-variant" size={15} color={colors.primary} />
            <Text style={[styles.toolbarBtnText, {color: colors.primary}]}>{currentSortLabel}</Text>
            <Icon name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[styles.toolbarBtn, {
            backgroundColor: activeFilterCount > 0 ? colors.primaryMuted : colors.card,
            borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
            borderWidth: 1.5,
          }]}
          onPress={() => setFilterModalVisible(true)}>
          <Icon name="filter-outline" size={15} color={activeFilterCount > 0 ? colors.primary : colors.textMuted} />
          <Text style={[styles.toolbarBtnText, {color: activeFilterCount > 0 ? colors.primary : colors.textMuted}]}>Filter</Text>
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, {backgroundColor: colors.primary}]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.countText, {color: colors.textMuted}]}>
          {displayedStudents.length}/{students.length}
        </Text>

        <TouchableOpacity
          style={[styles.pdfBtn, {backgroundColor: pdfLoading ? '#d1fae5' : '#059669', opacity: pdfLoading ? 0.7 : 1}]}
          onPress={handleExportPDF}
          disabled={pdfLoading}>
          {pdfLoading ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <>
              <Icon name="file-pdf-box" size={15} color="#fff" />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {pdfLoading && (
        <View style={[styles.pdfBanner, {backgroundColor: colors.primaryMuted, borderColor: colors.primary}]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.pdfBannerText, {color: colors.primary}]}>
            Generating Ledger PDF Report…
          </Text>
        </View>
      )}

      <FlatList
        data={displayedStudents}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // Performance: only render what's visible + a small buffer
        windowSize={5}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={12}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="account-search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
              {search || activeFilterCount > 0 ? 'No matching records found.' : 'No students registered.'}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={[styles.clearFiltersText, {color: colors.primary}]}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <Modal visible={sortModalVisible} transparent animationType="slide" onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.bottomSheet, {backgroundColor: colors.card}]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, {backgroundColor: colors.border}]} />
            <Text style={[styles.sheetTitle, {color: colors.text}]}>Sort Ledger Registry</Text>
            {SORT_OPTIONS.map(opt => {
              const isActive = opt.key === sortKey;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortRow, {backgroundColor: isActive ? colors.primaryMuted : 'transparent', borderRadius: 12}]}
                  onPress={() => handleSortSelect(opt.key)}>
                  <Icon name={opt.icon} size={20} color={isActive ? colors.primary : colors.textMuted} />
                  <Text style={[styles.sortRowText, {color: isActive ? colors.primary : colors.text}, isActive && {fontWeight: '700'}]}>
                    {opt.label}
                  </Text>
                  {isActive && (
                    <View style={styles.sortRowRight}>
                      <Icon name={sortDir === 'asc' ? 'arrow-up-bold' : 'arrow-down-bold'} size={16} color={colors.primary} />
                      <Text style={[styles.sortDirLabel, {color: colors.primary}]}>{sortDir === 'asc' ? 'A → Z' : 'Z → A'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.sheetCloseBtn, {backgroundColor: colors.primaryMuted}]} onPress={() => setSortModalVisible(false)}>
              <Text style={[styles.sheetCloseBtnText, {color: colors.primary}]}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.bottomSheet, {backgroundColor: colors.card}]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, {backgroundColor: colors.border}]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, {color: colors.text}]}>Filter Registry Rows</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={[styles.clearText, {color: '#dc2626'}]}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterLabel, {color: colors.textSub}]}>Batch Year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <View style={styles.chipGroup}>
                  <TouchableOpacity style={[styles.chip, {backgroundColor: filterBatch === '' ? colors.primary : colors.inputBg, borderColor: filterBatch === '' ? colors.primary : colors.border}]} onPress={() => setFilterBatch('')}>
                    <Text style={[styles.chipText, {color: filterBatch === '' ? '#fff' : colors.text}]}>All</Text>
                  </TouchableOpacity>
                  {allBatches.map(batch => (
                    <TouchableOpacity key={batch} style={[styles.chip, {backgroundColor: filterBatch === batch ? colors.primary : colors.inputBg, borderColor: filterBatch === batch ? colors.primary : colors.border}]} onPress={() => setFilterBatch(batch)}>
                      <Text style={[styles.chipText, {color: filterBatch === batch ? '#fff' : colors.text}]}>{batch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={[styles.filterLabel, {color: colors.textSub, marginTop: 20}]}>Academic Branch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <View style={styles.chipGroup}>
                  <TouchableOpacity style={[styles.chip, {backgroundColor: filterBranch === '' ? colors.primary : colors.inputBg, borderColor: filterBranch === '' ? colors.primary : colors.border}]} onPress={() => setFilterBranch('')}>
                    <Text style={[styles.chipText, {color: filterBranch === '' ? '#fff' : colors.text}]}>All</Text>
                  </TouchableOpacity>
                  {allBranches.map(branch => (
                    <TouchableOpacity key={branch} style={[styles.chip, {backgroundColor: filterBranch === branch ? colors.primary : colors.inputBg, borderColor: filterBranch === branch ? colors.primary : colors.border}]} onPress={() => setFilterBranch(branch)}>
                      <Text style={[styles.chipText, {color: filterBranch === branch ? '#fff' : colors.text}]}>{branch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
            <TouchableOpacity style={[styles.sheetCloseBtn, {backgroundColor: colors.primary, marginTop: 24}]} onPress={() => setFilterModalVisible(false)}>
              <Text style={[styles.sheetCloseBtnText, {color: '#fff'}]}>Apply Specifications</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 16, paddingTop: 12},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 10, fontSize: 14},
  searchWrapper: {flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 12},
  searchIcon: {marginRight: 8},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 0},
  toolbarRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8},
  toolbarBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4},
  toolbarBtnText: {fontSize: 13, fontWeight: '600'},
  filterBadge: {borderRadius: 9, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 2},
  filterBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
  countText: {fontSize: 13, flex: 1, textAlign: 'right', marginRight: 4},
  pdfBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4},
  pdfBtnText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  pdfBanner: {flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12, gap: 8},
  pdfBannerText: {fontSize: 12, fontWeight: '600', flex: 1},
  list: {paddingBottom: 24},
  card: {borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12},
  cardTop: {flexDirection: 'row', alignItems: 'center'},
  avatarSmall: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden'},
  avatarSmallImage: {width: 38, height: 38, borderRadius: 19},
  avatarSmallText: {fontSize: 13, fontWeight: '700', color: '#475569'},
  cardInfo: {flex: 1},
  studentName: {fontSize: 15, fontWeight: '700', marginBottom: 2},
  regNo: {fontSize: 12, fontWeight: '500'},
  pointsCol: {alignItems: 'flex-end', gap: 4},
  pointsBadge: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4},
  pointsText: {fontSize: 12, fontWeight: '700'},
  trophyAppBadge: {flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#fef9c3'},
  trophyAppText: {fontSize: 10, fontWeight: '700', color: '#854d0e'},
  cardFooter: {flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 12},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12},
  lateralBadge: {backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto'},
  lateralText: {color: '#0369a1', fontSize: 10, fontWeight: '700'},
  empty: {alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8},
  emptyText: {fontSize: 14, textAlign: 'center'},
  clearFiltersText: {fontSize: 14, fontWeight: '600', textDecorationLine: 'underline'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  bottomSheet: {borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, shadowColor: '#000', shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12, maxHeight: '75%'},
  sheetHandle: {width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16},
  sheetTitleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
  sheetTitle: {fontSize: 16, fontWeight: '700', marginBottom: 14},
  clearText: {fontSize: 13, fontWeight: '600'},
  sortRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 2},
  sortRowText: {flex: 1, fontSize: 14},
  sortRowRight: {flexDirection: 'row', alignItems: 'center', gap: 4},
  sortDirLabel: {fontSize: 12, fontWeight: '600'},
  sheetCloseBtn: {alignItems: 'center', borderRadius: 12, paddingVertical: 12},
  sheetCloseBtnText: {fontSize: 14, fontWeight: '700'},
  filterLabel: {fontSize: 14, fontWeight: '600', marginBottom: 8},
  chipRow: {flexDirection: 'row'},
  chipGroup: {flexDirection: 'row', gap: 8, paddingBottom: 4},
  chip: {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1},
  chipText: {fontSize: 13, fontWeight: '600'},
});
