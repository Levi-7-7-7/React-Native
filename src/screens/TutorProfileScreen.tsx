/**
 * TutorProfileScreen.tsx
 *
 * Full-screen profile for tutors:
 *   • Hero banner respects status bar via useSafeAreaInsets
 *   • Avatar tap → camera / library picker → upload to /tutors/profile-photo
 *   • Fetches /tutors/me for live profile data (name, email, batch, branch)
 *   • Fetches /tutors/students for student count
 *   • No logout button (stays in the main header)
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {useAuth} from '../context/AuthContext';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── types ────────────────────────────────────────────────────────────────────

interface TutorProfile {
  name: string;
  email: string;
  batch:  {_id: string; name: string} | null;
  branch: {_id: string; name: string} | null;
  profilePhoto?: string | null;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function TutorProfileScreen() {
  const {user, setUser} = useAuth();
  const {colors, isDark} = useTheme();
  const insets            = useSafeAreaInsets();
  const navigation        = useNavigation<any>();

  const [profile,       setProfile]       = useState<TutorProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [studentCount,  setStudentCount]  = useState<number | null>(null);
  const [uploading,     setUploading]     = useState(false);

  // Optimistic photo state (updates instantly after upload)
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  // ── fetch tutor profile ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setProfileLoading(true);
      try {
        const [meRes, studentsRes] = await Promise.all([
          tutorAxios.get('/tutors/me'),
          tutorAxios.get('/tutors/students'),
        ]);
        if (!cancelled) {
          setProfile(meRes.data);
          setLocalPhoto(meRes.data.profilePhoto ?? null);
          // /tutors/students returns array
          const students = Array.isArray(studentsRes.data)
            ? studentsRes.data
            : studentsRes.data?.students ?? [];
          setStudentCount(students.length);
          // Also update the tutorName in AsyncStorage so the header stays in sync
          if (meRes.data.name) {
            await AsyncStorage.setItem('tutorName', meRes.data.name);
          }
        }
      } catch (_) {
        // Fallback to whatever is in auth context
        if (!cancelled && user?.name) {
          setProfile({
            name:  user.name,
            email: '',
            batch:  null,
            branch: null,
            profilePhoto: null,
          });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── upload handler ───────────────────────────────────────────────────────
  const uploadPhoto = useCallback(
    async (uri: string, fileName: string, type: string) => {
      setUploading(true);
      try {
        const resized = await ImageResizer.createResizedImage(
          uri, 600, 600, 'JPEG', 80, 0,
        );
        const formData = new FormData();
        formData.append('photo', {
          uri:  Platform.OS === 'android' ? resized.uri : resized.uri.replace('file://', ''),
          name: fileName ?? 'profile.jpg',
          type: type     ?? 'image/jpeg',
        } as any);
        const res = await tutorAxios.patch('/tutors/profile-photo', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setLocalPhoto(res.data.profilePhoto);
        setProfile(prev => prev ? {...prev, profilePhoto: res.data.profilePhoto} : prev);
        // Keep auth context in sync if it holds profile photo
        if (setUser) {
          setUser((prev: any) => ({...prev, profilePhoto: res.data.profilePhoto}));
        }
      } catch (err: any) {
        Alert.alert(
          'Upload failed',
          err?.response?.data?.error ?? 'Could not upload photo. Please try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [setUser],
  );

  const handlePickerResponse = useCallback(
    (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {return;}
      const asset = response.assets?.[0];
      if (!asset?.uri) {return;}
      uploadPhoto(asset.uri, asset.fileName ?? 'profile.jpg', asset.type ?? 'image/jpeg');
    },
    [uploadPhoto],
  );

  const showPickerSheet = useCallback(() => {
    Alert.alert('Change Profile Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera(
            {mediaType: 'photo', quality: 0.9, cameraType: 'front'},
            handlePickerResponse,
          ),
      },
      {
        text: 'Photo Library',
        onPress: () =>
          launchImageLibrary(
            {mediaType: 'photo', quality: 0.9, selectionLimit: 1},
            handlePickerResponse,
          ),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  }, [handlePickerResponse]);

  // ── derived values ───────────────────────────────────────────────────────
  const tutorName  = profile?.name  ?? user?.name ?? 'Tutor';
  const tutorEmail = profile?.email ?? '—';
  const batchName  = profile?.batch?.name  ?? '—';
  const branchName = profile?.branch?.name ?? '—';
  const initials   = getInitials(tutorName);
  const hasPhoto   = Boolean(localPhoto);

  const HERO_HEIGHT = 200 + insets.top;
  const PRIMARY     = colors.primary;
  const HERO_BG     = isDark ? '#0f2041' : '#1e3a8a';
  const ACCENT      = isDark ? '#2563eb' : '#2d52b0';

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 40}]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero banner ── */}
        <View style={[styles.hero, {height: HERO_HEIGHT, backgroundColor: HERO_BG}]}>
          <View style={[styles.deco1, {backgroundColor: ACCENT}]} />
          <View style={[styles.deco2, {backgroundColor: ACCENT}]} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, {top: insets.top + 12}]}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Page title */}
          <Text style={[styles.heroTitle, {top: insets.top + 14}]}>Profile</Text>

          {/* Role badge */}
          <View style={[styles.roleBadge, {top: insets.top + 10, backgroundColor: 'rgba(255,255,255,0.18)'}]}>
            <MaterialCommunityIcons name="shield-account-outline" size={13} color="#fff" />
            <Text style={styles.roleBadgeText}>Tutor</Text>
          </View>

          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={showPickerSheet}
            activeOpacity={0.85}
            disabled={uploading}>
            {hasPhoto ? (
              <Image source={{uri: localPhoto!}} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, {backgroundColor: ACCENT}]}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarRing, {borderColor: colors.bg}]} />
            <View style={[styles.cameraBadge, {backgroundColor: PRIMARY, borderColor: colors.bg}]}>
              {uploading
                ? <ActivityIndicator size={11} color="#fff" />
                : <MaterialCommunityIcons name="camera" size={13} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Name block (floats below hero) ── */}
        {profileLoading ? (
          <View style={[styles.nameBlock, {backgroundColor: colors.card, paddingTop: AVATAR_SIZE / 2 + 20}]}>
            <ActivityIndicator size="small" color={PRIMARY} />
          </View>
        ) : (
          <View style={[styles.nameBlock, {backgroundColor: colors.card}]}>
            <Text style={[styles.nameText, {color: colors.text}]}>{tutorName}</Text>
            <View style={[styles.emailPill, {backgroundColor: colors.primaryMuted}]}>
              <MaterialCommunityIcons name="email-outline" size={13} color={PRIMARY} />
              <Text style={[styles.emailPillText, {color: PRIMARY}]} numberOfLines={1}>
                {tutorEmail}
              </Text>
            </View>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="account-group-outline"
            value={studentCount !== null ? String(studentCount) : '—'}
            label="Students"
            colors={colors}
            primary={PRIMARY}
          />
          <StatCard
            icon="calendar-month-outline"
            value={batchName}
            label="Batch"
            colors={colors}
            primary={PRIMARY}
          />
          <StatCard
            icon="source-branch"
            value={branchName}
            label="Branch"
            colors={colors}
            primary={PRIMARY}
          />
        </View>

        {/* ── Account info ── */}
        <SectionLabel label="ACCOUNT INFO" colors={colors} />
        <View style={[styles.card, {backgroundColor: colors.card}]}>
          <InfoRow icon="email-outline"          label="Email"   value={tutorEmail}  colors={colors} primary={PRIMARY} />
          <Divider color={colors.borderLight} />
          <InfoRow icon="source-branch"          label="Branch"  value={branchName}  colors={colors} primary={PRIMARY} />
          <Divider color={colors.borderLight} />
          <InfoRow icon="calendar-month-outline" label="Batch"   value={batchName}   colors={colors} primary={PRIMARY} />
        </View>

        {/* ── Role info ── */}
        <SectionLabel label="ROLE" colors={colors} />
        <View style={[styles.card, {backgroundColor: colors.card}]}>
          <InfoRow
            icon="shield-account-outline"
            label="Role"
            value="Class Tutor"
            colors={colors}
            primary={PRIMARY}
          />
          <Divider color={colors.borderLight} />
          <InfoRow
            icon="account-check-outline"
            label="Access"
            value="Certificate Review · Student Management"
            colors={colors}
            primary={PRIMARY}
          />
        </View>

      </ScrollView>
    </View>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({label, colors}: {label: string; colors: any}) {
  return (
    <Text style={[styles.sectionLabel, {color: colors.textMuted}]}>{label}</Text>
  );
}

function InfoRow({
  icon, label, value, colors, primary,
}: {
  icon: string; label: string; value: string; colors: any; primary: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconBubble, {backgroundColor: colors.primaryMuted}]}>
        <MaterialCommunityIcons name={icon} size={18} color={primary} />
      </View>
      <View style={styles.infoTexts}>
        <Text style={[styles.infoLabel, {color: colors.textMuted}]}>{label}</Text>
        <Text style={[styles.infoValue, {color: colors.text}]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function Divider({color}: {color: string}) {
  return <View style={[styles.divider, {backgroundColor: color}]} />;
}

function StatCard({
  icon, value, label, colors, primary,
}: {
  icon: string; value: string; label: string; colors: any; primary: string;
}) {
  return (
    <View style={[styles.statCard, {backgroundColor: colors.card}]}>
      <View style={[styles.statIconBg, {backgroundColor: colors.primaryMuted}]}>
        <MaterialCommunityIcons name={icon} size={20} color={primary} />
      </View>
      <Text style={[styles.statValue, {color: colors.text}]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, {color: colors.textMuted}]}>{label}</Text>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  root:          {flex: 1},
  scroll:        {flex: 1},
  scrollContent: {paddingHorizontal: 0},

  /* ── Hero ── */
  hero: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: AVATAR_SIZE / 2 + 8,
  },
  deco1: {
    position: 'absolute',
    width: 260, height: 260,
    borderRadius: 130,
    top: -80, right: -60,
    opacity: 0.35,
  },
  deco2: {
    position: 'absolute',
    width: 180, height: 180,
    borderRadius: 90,
    bottom: 10, left: -50,
    opacity: 0.25,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  roleBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {color: '#fff', fontSize: 12, fontWeight: '700'},

  /* ── Avatar ── */
  avatarWrapper: {width: AVATAR_SIZE, height: AVATAR_SIZE},
  avatarImage:   {width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2},
  avatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  initialsText: {color: '#fff', fontSize: 32, fontWeight: '800'},
  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 1, right: 1,
    width: 26, height: 26,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },

  /* ── Name block ── */
  nameBlock: {
    alignItems: 'center',
    paddingTop: AVATAR_SIZE / 2 + 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    gap: 8,
  },
  nameText:  {fontSize: 22, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center'},
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: '90%',
  },
  emailPillText: {fontSize: 13, fontWeight: '600'},

  /* ── Stats row ── */
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  statIconBg: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {fontSize: 15, fontWeight: '800', textAlign: 'center'},
  statLabel: {fontSize: 11, fontWeight: '600', textAlign: 'center'},

  /* ── Section label ── */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 20,
  },

  /* ── Generic card ── */
  card: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  /* ── Info rows ── */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  iconBubble: {
    width: 36, height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTexts: {flex: 1},
  infoLabel: {fontSize: 11, fontWeight: '600', marginBottom: 2},
  infoValue:  {fontSize: 15, fontWeight: '500'},
  divider:   {height: 1, marginLeft: 66},
});
