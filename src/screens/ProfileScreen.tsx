/**
 * ProfileScreen.tsx
 *
 * WhatsApp-style student profile screen.
 * - Tap the avatar to pick a photo from gallery or camera
 * - Photo is uploaded to /api/students/profile-photo (multipart/form-data)
 * - Student info (name, register number, batch, branch) shown as read-only cards
 *
 * Dependencies already in the project:
 *   react-native-image-picker   ✓ (in package.json)
 *   react-native-image-resizer  ✓ (in package.json)
 *   @react-native-async-storage/async-storage ✓
 *   react-native-vector-icons   ✓
 */

import React, {useState, useCallback} from 'react';
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
} from 'react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAuth} from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import {useTheme} from '../theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * ImageKit returns a full https:// URL, so we use it directly.
 * Returns null when there is no photo yet (triggers the initials fallback).
 */
function photoUrl(url: string | null | undefined): string | null {
  return url ?? null;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const {user, setUser, logout} = useAuth();
  const {colors, isDark} = useTheme();

  const [uploading, setUploading] = useState(false);

  // Derive display values
  const userName: string = user?.name ?? 'Student';
  const registerNumber: string = user?.registerNumber ?? '—';
  const email: string = user?.email ?? '—';
  const batchName: string = user?.batch?.name ?? '—';
  const branchName: string = user?.branch?.name ?? '—';
  const entryType: string = user?.isLateralEntry ? 'Lateral Entry' : 'Regular';
  const currentPhoto: string | null = photoUrl(user?.profilePhoto);

  // Initials fallback (same logic as DashboardScreen)
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ── upload handler ───────────────────────────────────────────────────────

  const uploadPhoto = useCallback(
    async (uri: string, fileName: string, type: string) => {
      setUploading(true);
      try {
        // Resize to max 600×600 to keep payload small
        const resized = await ImageResizer.createResizedImage(
          uri,
          600,
          600,
          'JPEG',
          80,
          0,
        );

        const formData = new FormData();
        formData.append('photo', {
          uri: Platform.OS === 'android' ? resized.uri : resized.uri.replace('file://', ''),
          name: fileName ?? 'profile.jpg',
          type: type ?? 'image/jpeg',
        } as any);

        const res = await axiosInstance.patch('/students/profile-photo', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });

        // Update user in auth context so avatar refreshes everywhere
        setUser((prev: any) => ({...prev, profilePhoto: res.data.profilePhoto}));
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

  // ── image picker ─────────────────────────────────────────────────────────

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

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: colors.bg}]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Profile header (WhatsApp-style) ── */}
      <View style={[styles.headerCard, {backgroundColor: colors.card}]}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={showPickerSheet}
          activeOpacity={0.8}
          disabled={uploading}>
          {currentPhoto ? (
            <Image source={{uri: currentPhoto}} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, {backgroundColor: colors.primary}]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}

          {/* Camera badge — mimics WhatsApp */}
          <View style={[styles.cameraBadge, {backgroundColor: colors.primary}]}>
            {uploading ? (
              <ActivityIndicator size={12} color="#fff" />
            ) : (
              <MaterialCommunityIcons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        {/* Name + register number */}
        <Text style={[styles.nameText, {color: colors.text}]}>{userName}</Text>
        <Text style={[styles.regText, {color: colors.textMuted}]}>{registerNumber}</Text>
      </View>

      {/* ── Info section ── */}
      <Text style={[styles.sectionLabel, {color: colors.textMuted}]}>ACCOUNT INFO</Text>

      <View style={[styles.infoCard, {backgroundColor: colors.card}]}>
        <InfoRow icon="email-outline" label="Email" value={email} colors={colors} />
        <Divider color={colors.borderLight} />
        <InfoRow icon="school-outline" label="Branch" value={branchName} colors={colors} />
        <Divider color={colors.borderLight} />
        <InfoRow icon="calendar-outline" label="Batch" value={batchName} colors={colors} />
        <Divider color={colors.borderLight} />
        <InfoRow icon="account-switch-outline" label="Entry Type" value={entryType} colors={colors} />
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity
        style={[styles.logoutRow, {backgroundColor: colors.cardDanger}]}
        activeOpacity={0.8}
        onPress={() => logout()}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.dangerText} />
        <Text style={[styles.logoutText, {color: colors.dangerText}]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} style={styles.infoIcon} />
      <View style={styles.infoTexts}>
        <Text style={[styles.infoLabel, {color: colors.textMuted}]}>{label}</Text>
        <Text style={[styles.infoValue, {color: colors.text}]}>{value}</Text>
      </View>
    </View>
  );
}

function Divider({color}: {color: string}) {
  return <View style={[styles.divider, {backgroundColor: color}]} />;
}

// ─── styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 100;

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 20, paddingBottom: 100},

  /* Header card */
  headerCard: {
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  /* Avatar */
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: 14,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  nameText: {fontSize: 22, fontWeight: '800', marginBottom: 4},
  regText: {fontSize: 14, fontWeight: '500'},

  /* Section label */
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Info card */
  infoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoIcon: {marginRight: 14},
  infoTexts: {flex: 1},
  infoLabel: {fontSize: 11, fontWeight: '600', marginBottom: 2},
  infoValue: {fontSize: 15, fontWeight: '500'},
  divider: {height: 1, marginLeft: 50},

  /* Logout */
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logoutText: {fontSize: 16, fontWeight: '700'},
});
