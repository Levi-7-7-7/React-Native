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
} from 'react-native';
import RNShare from 'react-native-share';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { generatePDF } from 'react-native-html-to-pdf';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';


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
  status: string;
}

type SortKey =
  | 'registerNumber'
  | 'totalPoints'
  | 'batch'
  | 'branch'
  | 'recentlyAdded'
  | 'name';

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
      case 'registerNumber':
        av = a.registerNumber?.toLowerCase() ?? '';
        bv = b.registerNumber?.toLowerCase() ?? '';
        break;
      case 'totalPoints':
        av = a.totalPoints ?? 0;
        bv = b.totalPoints ?? 0;
        break;
      case 'batch':
        av = getBatchName(a.batch).toLowerCase();
        bv = getBatchName(b.batch).toLowerCase();
        break;
      case 'branch':
        av = getBranchName(a.branch).toLowerCase();
        bv = getBranchName(b.branch).toLowerCase();
        break;
      case 'recentlyAdded':
        av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      case 'name':
      default:
        av = a.name?.toLowerCase() ?? '';
        bv = b.name?.toLowerCase() ?? '';
        break;
    }
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * m;
    return String(av).localeCompare(String(bv)) * m;
  });
}

// ── PDF HTML Generator ────────────────────────────────────────────────────────

function buildPdfHtml(
  
  students: Student[],
  certsByStudent: Record<string, Certificate[]>,
  tutorBranch?: string,
  tutorBatch?: string,
  logoBase64?: string,   // ← add this
): string {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const deptName = tutorBranch
    ? `DEPARTMENT OF ${tutorBranch.toUpperCase()}`
    : 'DEPARTMENT';

  const batchLabel = tutorBatch ? ` — BATCH ${tutorBatch}` : '';

  const studentRows = students
    .map((student, idx) => {
      const certs = certsByStudent[student._id] || [];
      const approved = certs.filter(c => c.status === 'approved');
      const computedTotal = calcCappedPoints(approved, [], student.isLateralEntry);
      const threshold = passThreshold(student.isLateralEntry);
      const isPassing = computedTotal >= threshold;
      const passColor = isPassing ? '#15803d' : '#b91c1c';
      const passBg    = isPassing ? '#dcfce7'  : '#fee2e2';
      const passLabel = isPassing ? 'PASS' : 'FAIL';
      const batchName  = getBatchName(student.batch);
      const branchName = getBranchName(student.branch);

      



      const certTableRows =
        approved.length === 0
          ? `<tr><td colspan="7" style="text-align:center;color:#9ca3af;font-style:italic;padding:10px">No approved certificates</td></tr>`
          : approved
              .map(
                (cert, ci) => `
              <tr style="background:${ci % 2 === 0 ? '#f5f9ff' : '#fff'}">
                <td style="text-align:center">${ci + 1}</td>
                <td>${cert.eventName || cert.subcategory || '—'}</td>
                <td>${cert.category?.name || '—'}</td>
                <td>${cert.subcategory || '—'}</td>
                <td style="text-align:center">${cert.level || '—'}</td>
                <td style="text-align:center">${cert.prizeType || '—'}</td>
                <td style="text-align:center;font-weight:700;color:#1e3a8a">${cert.pointsAwarded ?? 0}</td>
              </tr>`,
              )
              .join('');

      return `
      <div class="student-block">
        <div class="student-header">
          <div class="student-num">${idx + 1}</div>
          <div class="student-info">
            <div class="student-name">${student.name || '—'}</div>
            <div class="student-meta">Reg No: <b>${student.registerNumber || '—'}</b> &nbsp;|&nbsp; Branch: ${branchName || '—'} &nbsp;|&nbsp; Batch: ${batchName || '—'}</div>
            ${student.email ? `<div class="student-meta">Email: ${student.email}</div>` : ''}
            ${student.isLateralEntry ? '<div class="lateral-badge">Lateral Entry</div>' : ''}
          </div>
          <div class="points-col">
            <div class="points-value" style="color:${passColor}">${computedTotal}</div>
            <div class="points-label">POINTS</div>
            <div class="pass-badge" style="background:${passBg};color:${passColor}">${passLabel}</div>
          </div>
        </div>
        <table class="cert-table">
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Certificate / Event</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th style="width:60px">Level</th>
              <th style="width:60px">Prize</th>
              <th style="width:50px">Pts</th>
            </tr>
          </thead>
          <tbody>${certTableRows}</tbody>
        </table>
      </div>`;
    })
    .join('');
  const logoHtml = logoBase64
      ? `<img src="data:image/png;base64,${logoBase64}" 
          style="width:56px;height:56px;border-radius:6px;object-fit:contain;margin-right:12px;" />`
      : `<div class="header-logo">MTI</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
  .page { padding: 20px 18px 30px; }

  /* Header */
  .header { display: flex; align-items: center; padding-bottom: 10px; border-bottom: 2px solid #0f2864; margin-bottom: 6px; }
  .header-logo { width: 56px; height: 56px; background: #1e3a8a; border-radius: 6px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; font-weight:700; flex-shrink:0; margin-right:12px; }
  .header-text { flex: 1; text-align: center; }
  .dept-name { font-size: 15px; font-weight: 700; color: #0f2864; letter-spacing: 0.5px; }
  .inst-name { font-size: 11px; font-weight: 700; margin-top: 3px; }
  .inst-sub  { font-size: 8px; color: #555; margin-top: 2px; }

  /* Title band */
  .title-band { background: #0f2864; color: #fff; text-align: center; padding: 7px; font-size: 11px; font-weight: 700; border-radius: 3px; margin: 8px 0 14px; letter-spacing: 0.5px; }

  /* Student block */
  .student-block { margin-bottom: 16px; page-break-inside: avoid; }
  .student-header { display: flex; align-items: flex-start; background: #f2f6ff; border: 1px solid #b9cdf5; border-radius: 5px; padding: 10px 12px; margin-bottom: 4px; }
  .student-num { width: 28px; height: 28px; border-radius: 50%; background: #1e3a8a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-right: 12px; margin-top: 2px; }
  .student-info { flex: 1; }
  .student-name { font-size: 13px; font-weight: 700; color: #0a1e5a; }
  .student-meta { font-size: 9px; color: #555; margin-top: 3px; }
  .lateral-badge { display: inline-block; background: #fef9c3; color: #854d0e; font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-top: 4px; }
  .points-col { text-align: right; flex-shrink: 0; margin-left: 12px; }
  .points-value { font-size: 26px; font-weight: 700; line-height: 1; }
  .points-label { font-size: 7px; color: #888; text-align: center; margin-top: 2px; }
  .pass-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-top: 5px; }

  /* Certificate table */
  .cert-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .cert-table th { background: #1e3a8a; color: #fff; padding: 5px 6px; text-align: left; font-weight: 700; }
  .cert-table td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }

  /* Footer */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 8px; color: #aaa; border-top: 1px solid #e5e7eb; padding: 5px 18px; }

  /* Divider */
  .divider { border: none; border-top: 1px solid #d2dcf5; margin: 12px 0; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoHtml}

    <div class="header-text"> 
      <div class="dept-name">${deptName}</div>
      <div class="inst-name">MAHARAJA'S TECHNOLOGICAL INSTITUTE (MTI)</div>
      <div class="inst-sub">Chembukkavu, Thrissur, Kerala – 680020</div>
      <div class="inst-sub">Affiliated to SBTE Kerala | AICTE Approved | Est. 1946</div>
      <div class="inst-sub">Phone: 0487-2333290 | E-Mail: mtithrsr@mtithrissur.ac.in</div>
    </div>
  </div>

  <div class="title-band">STUDENT ACTIVITY POINTS REPORT${batchLabel}</div>

  ${studentRows}

  <hr class="divider"/>
  <div style="font-size:8px;color:#aaa;margin-top:4px">
    Generated on ${today} &nbsp;|&nbsp; ${students.length} student${students.length !== 1 ? 's' : ''}
  </div>
</div>
</body>
</html>`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TutorStudentsScreen() {
  const {colors} = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('recentlyAdded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Filtering
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

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

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
        s =>
          s.name?.toLowerCase().includes(q) ||
          s.registerNumber?.toLowerCase().includes(q),
      );
    }
    if (filterBatch) result = result.filter(s => getBatchName(s.batch) === filterBatch);
    if (filterBranch) result = result.filter(s => getBranchName(s.branch) === filterBranch);
    return sortStudents(result, sortKey, sortDir);
  }, [students, search, filterBatch, filterBranch, sortKey, sortDir]);

  const activeFilterCount = (filterBatch ? 1 : 0) + (filterBranch ? 1 : 0);
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? 'Sort';

  const handleSortSelect = (key: SortKey) => {
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
  };

  const clearFilters = () => {
    setFilterBatch('');
    setFilterBranch('');
    setFilterModalVisible(false);
  };

  // ── PDF Export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (displayedStudents.length === 0) {
      Alert.alert('No Students', 'There are no students to export.');
      return;
    }

    setPdfLoading(true);

    let generatedFilePath = '';

    try {
      // ─────────────────────────────────────────────
      // Fetch certificates
      // ─────────────────────────────────────────────
      const certRes = await tutorAxios.get('/tutors/certificates');

      const allCerts: Certificate[] =
        certRes.data.certificates || [];

      const certsByStudent: Record<string, Certificate[]> = {};

      allCerts.forEach(cert => {
        const sid = (cert.student as any)?._id || cert.student;

        if (!sid) return;

        const key = sid.toString();

        if (!certsByStudent[key]) {
          certsByStudent[key] = [];
        }

        certsByStudent[key].push(cert);
      });

      // ─────────────────────────────────────────────
      // Labels
      // ─────────────────────────────────────────────
      const firstStudent = displayedStudents[0];

      const tutorBranch =
        getBranchName(firstStudent?.branch) || undefined;

      const tutorBatch =
        getBatchName(firstStudent?.batch) || undefined;

      // ─────────────────────────────────────────────
      // Load logo
      // ─────────────────────────────────────────────
      let logoBase64 = '';

      try {
        if (Platform.OS === 'android') {
          logoBase64 = await RNFS.readFileAssets(
            'mti_logo.png',
            'base64',
          );
        } else {
          const logoPath =
            `${RNFS.MainBundlePath}/mti_logo.png`;

          logoBase64 = await RNFS.readFile(
            logoPath,
            'base64',
          );
        }
      } catch (e) {
        console.log('Logo load failed:', e);
      }

      // ─────────────────────────────────────────────
      // Build HTML
      // ─────────────────────────────────────────────
      const html = buildPdfHtml(
        displayedStudents,
        certsByStudent,
        tutorBranch,
        tutorBatch,
        logoBase64,
      );

      // ─────────────────────────────────────────────
      // File name
      // ─────────────────────────────────────────────
      const branchSlug = (tutorBranch || 'dept')
        .replace(/\s+/g, '_')
        .toLowerCase();

      const dateSlug = new Date()
        .toISOString()
        .slice(0, 10);

      const fileName =
        `activity_points_${branchSlug}_${dateSlug}`;

      // ─────────────────────────────────────────────
      // Generate PDF
      // IMPORTANT:
      // Use "Caches" instead of "Documents"
      // ─────────────────────────────────────────────
      const pdf = await generatePDF({
        html,
        fileName,
        directory: 'Caches',
        width: 595,
        height: 842,
      });

      if (!pdf.filePath) {
        throw new Error('PDF generation failed');
      }
      
      console.log('PDF RESULT:', pdf);

      generatedFilePath = pdf.filePath;
      
      // ─────────────────────────────────────────────
      // Share PDF
      // ─────────────────────────────────────────────
    console.log('PDF PATH:', generatedFilePath);

    const sharePath = generatedFilePath.startsWith('file://')
  ? generatedFilePath
  : `file://${generatedFilePath}`;

    console.log('SHARE PATH:', sharePath);

    await RNShare.open({
      url: sharePath,
      type: 'application/pdf',
      filename: `${fileName}.pdf`,
      title: 'Share PDF',
      failOnCancel: false,
    });

      // ─────────────────────────────────────────────
      // DELETE PDF AFTER SHARING
      // ─────────────────────────────────────────────
      try {
        const exists = await RNFS.exists(
          generatedFilePath,
        );

        if (exists) {
          await RNFS.unlink(generatedFilePath);

          console.log('Temporary PDF deleted');
        }
      } catch (deleteError) {
        console.log(
          'Could not delete temp PDF:',
          deleteError,
        );
      }
    } catch (err: any) {
      console.error('PDF Export Error:', err);

      Alert.alert(
        'Export Failed',
        err?.message || 'Could not generate PDF',
      );
    } finally {
      // Extra cleanup safety
      try {
        if (generatedFilePath) {
          const exists = await RNFS.exists(
            generatedFilePath,
          );

          if (exists) {
            await RNFS.unlink(generatedFilePath);
          }
        }
      } catch {}

      setPdfLoading(false);
    }
  };

  const renderItem = ({item}: {item: Student}) => {
    const batchName  = getBatchName(item.batch);
    const branchName = getBranchName(item.branch);
    const threshold  = passThreshold(item.isLateralEntry);
    const isPassing  = (item.totalPoints ?? 0) >= threshold;

    return (
      <View
        style={[
          styles.card,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <View style={styles.cardTop}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {item.name
                ?.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '?'}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.studentName, {color: colors.text}]}>
              {item.name}
            </Text>
            <Text style={[styles.regNo, {color: colors.textMuted}]}>
              {item.registerNumber}
            </Text>
          </View>
          <View style={styles.pointsCol}>
            <View
              style={[
                styles.pointsBadge,
                {backgroundColor: colors.primaryMuted},
              ]}>
              <Icon name="star-outline" size={11} color={colors.primary} />
              <Text style={[styles.pointsText, {color: colors.primary}]}>
                {item.totalPoints ?? 0} pts
              </Text>
            </View>
            <View
              style={[
                styles.passBadge,
                {
                  backgroundColor: isPassing ? '#dcfce7' : '#fee2e2',
                },
              ]}>
              <Text
                style={[
                  styles.passBadgeText,
                  {color: isPassing ? '#15803d' : '#b91c1c'},
                ]}>
                {isPassing ? 'PASS' : 'FAIL'}
              </Text>
            </View>
          </View>
        </View>
        <View
          style={[styles.cardFooter, {borderTopColor: colors.borderLight}]}>
          <View style={styles.metaItem}>
            <Icon name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, {color: colors.textMuted}]}>
              {batchName || 'N/A'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="school-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, {color: colors.textMuted}]}>
              {branchName || 'N/A'}
            </Text>
          </View>
          {item.isLateralEntry && (
            <View style={styles.lateralBadge}>
              <Text style={styles.lateralText}>Lateral Entry</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textMuted}]}>
          Loading students…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      {/* ── Search bar ── */}
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

      {/* ── Toolbar ── */}
      <View style={styles.toolbarRow}>
        {/* Sort pill */}
        <Animated.View style={{transform: [{scale: sortBadgeAnim}]}}>
          <TouchableOpacity
            style={[
              styles.toolbarBtn,
              {backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5},
            ]}
            onPress={() => setSortModalVisible(true)}>
            <Icon name="sort-variant" size={15} color={colors.primary} />
            <Text style={[styles.toolbarBtnText, {color: colors.primary}]}>
              {currentSortLabel}
            </Text>
            <Icon
              name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={13}
              color={colors.primary}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Filter pill */}
        <TouchableOpacity
          style={[
            styles.toolbarBtn,
            {
              backgroundColor: activeFilterCount > 0 ? colors.primaryMuted : colors.card,
              borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
              borderWidth: 1.5,
            },
          ]}
          onPress={() => setFilterModalVisible(true)}>
          <Icon
            name="filter-outline"
            size={15}
            color={activeFilterCount > 0 ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.toolbarBtnText,
              {color: activeFilterCount > 0 ? colors.primary : colors.textMuted},
            ]}>
            Filter
          </Text>
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, {backgroundColor: colors.primary}]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Count */}
        <Text style={[styles.countText, {color: colors.textMuted}]}>
          {displayedStudents.length}/{students.length}
        </Text>

        {/* PDF Export button */}
        <TouchableOpacity
          style={[
            styles.pdfBtn,
            {
              backgroundColor: pdfLoading ? '#d1fae5' : '#059669',
              opacity: pdfLoading ? 0.7 : 1,
            },
          ]}
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

      {/* PDF loading overlay hint */}
      {pdfLoading && (
        <View style={[styles.pdfBanner, {backgroundColor: colors.primaryMuted, borderColor: colors.primary}]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.pdfBannerText, {color: colors.primary}]}>
            Generating PDF report… fetching certificates
          </Text>
        </View>
      )}

      <FlatList
        data={displayedStudents}
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
            <Icon name="account-search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
              {search || activeFilterCount > 0
                ? 'No matching students found.'
                : 'No students yet.'}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={[styles.clearFiltersText, {color: colors.primary}]}>
                  Clear filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Sort Modal ── */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}>
          <View
            style={[styles.bottomSheet, {backgroundColor: colors.card}]}
            onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, {backgroundColor: colors.border}]} />
            <Text style={[styles.sheetTitle, {color: colors.text}]}>
              Sort Students
            </Text>
            {SORT_OPTIONS.map(opt => {
              const isActive = opt.key === sortKey;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sortRow,
                    {backgroundColor: isActive ? colors.primaryMuted : 'transparent', borderRadius: 12},
                  ]}
                  onPress={() => handleSortSelect(opt.key)}>
                  <Icon
                    name={opt.icon}
                    size={20}
                    color={isActive ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.sortRowText,
                      {color: isActive ? colors.primary : colors.text},
                      isActive && {fontWeight: '700'},
                    ]}>
                    {opt.label}
                  </Text>
                  {isActive && (
                    <View style={styles.sortRowRight}>
                      <Icon
                        name={sortDir === 'asc' ? 'arrow-up-bold' : 'arrow-down-bold'}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={[styles.sortDirLabel, {color: colors.primary}]}>
                        {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.sheetCloseBtn, {backgroundColor: colors.primaryMuted}]}
              onPress={() => setSortModalVisible(false)}>
              <Text style={[styles.sheetCloseBtnText, {color: colors.primary}]}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Filter Modal ── */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}>
          <View
            style={[styles.bottomSheet, {backgroundColor: colors.card}]}
            onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, {backgroundColor: colors.border}]} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, {color: colors.text}]}>
                Filter Students
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={[styles.clearText, {color: '#dc2626'}]}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterLabel, {color: colors.textSub}]}>Batch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <View style={styles.chipGroup}>
                  <TouchableOpacity
                    style={[styles.chip, {
                      backgroundColor: filterBatch === '' ? colors.primary : colors.inputBg,
                      borderColor: filterBatch === '' ? colors.primary : colors.border,
                    }]}
                    onPress={() => setFilterBatch('')}>
                    <Text style={[styles.chipText, {color: filterBatch === '' ? '#fff' : colors.text}]}>All</Text>
                  </TouchableOpacity>
                  {allBatches.map(batch => (
                    <TouchableOpacity
                      key={batch}
                      style={[styles.chip, {
                        backgroundColor: filterBatch === batch ? colors.primary : colors.inputBg,
                        borderColor: filterBatch === batch ? colors.primary : colors.border,
                      }]}
                      onPress={() => setFilterBatch(filterBatch === batch ? '' : batch)}>
                      <Text style={[styles.chipText, {color: filterBatch === batch ? '#fff' : colors.text}]}>
                        {batch}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[styles.filterLabel, {color: colors.textSub, marginTop: 16}]}>Branch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                <View style={styles.chipGroup}>
                  <TouchableOpacity
                    style={[styles.chip, {
                      backgroundColor: filterBranch === '' ? colors.primary : colors.inputBg,
                      borderColor: filterBranch === '' ? colors.primary : colors.border,
                    }]}
                    onPress={() => setFilterBranch('')}>
                    <Text style={[styles.chipText, {color: filterBranch === '' ? '#fff' : colors.text}]}>All</Text>
                  </TouchableOpacity>
                  {allBranches.map(branch => (
                    <TouchableOpacity
                      key={branch}
                      style={[styles.chip, {
                        backgroundColor: filterBranch === branch ? colors.primary : colors.inputBg,
                        borderColor: filterBranch === branch ? colors.primary : colors.border,
                      }]}
                      onPress={() => setFilterBranch(filterBranch === branch ? '' : branch)}>
                      <Text style={[styles.chipText, {color: filterBranch === branch ? '#fff' : colors.text}]}>
                        {branch}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
            <TouchableOpacity
              style={[styles.sheetCloseBtn, {backgroundColor: colors.primary}]}
              onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.sheetCloseBtnApplyText}>
                Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchIcon: {marginRight: 8},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 2},
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toolbarBtnText: {fontSize: 12, fontWeight: '700'},
  filterBadge: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
  countText: {fontSize: 12, fontWeight: '600'},
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  pdfBtnText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  pdfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pdfBannerText: {fontSize: 12, fontWeight: '600', flex: 1},
  list: {paddingHorizontal: 12, paddingBottom: 16},
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10},
  avatarSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarSmallText: {color: '#fff', fontWeight: '700', fontSize: 13},
  cardInfo: {flex: 1},
  studentName: {fontSize: 14, fontWeight: '700'},
  regNo: {fontSize: 12, marginTop: 2},
  pointsCol: {alignItems: 'flex-end', gap: 5},
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  pointsText: {fontSize: 12, fontWeight: '700'},
  passBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  passBadgeText: {fontSize: 10, fontWeight: '700'},
  cardFooter: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, gap: 12,
  },
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12},
  lateralBadge: {
    backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  lateralText: {fontSize: 10, fontWeight: '600', color: '#854d0e'},
  empty: {alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12},
  emptyText: {fontSize: 14},
  clearFiltersText: {fontSize: 13, fontWeight: '600', textDecorationLine: 'underline'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  bottomSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
    maxHeight: '75%',
  },
  sheetHandle: {width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16},
  sheetTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sheetTitle: {fontSize: 16, fontWeight: '700', marginBottom: 14},
  clearText: {fontSize: 13, fontWeight: '600'},
  sortRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10, marginBottom: 2,
  },
  sortRowText: {flex: 1, fontSize: 14},
  sortRowRight: {flexDirection: 'row', alignItems: 'center', gap: 4},
  sortDirLabel: {fontSize: 12, fontWeight: '600'},
  sheetCloseBtn: {alignItems: 'center', borderRadius: 12, paddingVertical: 13, marginTop: 16},
  sheetCloseBtnText: {fontSize: 15, fontWeight: '700'},
  sheetCloseBtnApplyText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  filterLabel: {fontSize: 13, fontWeight: '600', marginBottom: 8},
  chipRow: {marginBottom: 4},
  chipGroup: {flexDirection: 'row', gap: 8, paddingBottom: 4},
  chip: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5},
  chipText: {fontSize: 13, fontWeight: '600'},
});
