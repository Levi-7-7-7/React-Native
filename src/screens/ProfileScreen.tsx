/**
 * ProfileScreen.tsx
 *
 * • Enlarged profile image modal added
 * • Tap student image -> enlarge image
 * • Long press / camera badge -> change image
 * • Tutor image can also be enlarged
 * • No logout button
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
  Dimensions,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';

import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';

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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function photoUrl(url: string | null | undefined): string | null {
  return url ?? null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const {user, setUser} = useAuth();
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [uploading, setUploading] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);

  const [viewerImages, setViewerImages] = useState<
    {uri: string}[]
  >([]);

  const [tutor, setTutor] = useState<{
    name: string;
    email: string;
    profilePhoto?: string;
    batch?: {name: string};
    branch?: {name: string};
  } | null>(null);

  const [tutorLoading, setTutorLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────

  const userName: string = user?.name ?? 'Student';

  const registerNumber: string =
    user?.registerNumber ?? '—';

  const email: string = user?.email ?? '—';

  const batchName: string =
    user?.batch?.name ?? '—';

  const branchName: string =
    user?.branch?.name ?? '—';

  const entryType: string = user?.isLateralEntry
    ? 'Lateral Entry'
    : 'Regular';

  const currentPhoto: string | null = photoUrl(
    user?.profilePhoto,
  );

  const initials = getInitials(userName);

  const HERO_HEIGHT = 200 + insets.top;

  // ─────────────────────────────────────────────────────────────
  // Fetch tutor
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    setTutorLoading(true);

    axiosInstance
      .get('/students/my-tutor')
      .then(res => {
        if (!cancelled) {
          setTutor(res.data.tutor ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTutor(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTutorLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Upload photo
  // ─────────────────────────────────────────────────────────────

  const uploadPhoto = useCallback(
    async (
      uri: string,
      fileName: string,
      type: string,
    ) => {
      setUploading(true);

      try {
        const resized =
          await ImageResizer.createResizedImage(
            uri,
            600,
            600,
            'JPEG',
            80,
            0,
          );

        const formData = new FormData();

        formData.append(
          'photo',
          {
            uri:
              Platform.OS === 'android'
                ? resized.uri
                : resized.uri.replace('file://', ''),
            name: fileName ?? 'profile.jpg',
            type: type ?? 'image/jpeg',
          } as any,
        );

        const res = await axiosInstance.patch(
          '/students/profile-photo',
          formData,
          {
            headers: {
              'Content-Type':
                'multipart/form-data',
            },
          },
        );

        setUser((prev: any) => ({
          ...prev,
          profilePhoto: res.data.profilePhoto,
        }));
      } catch (err: any) {
        Alert.alert(
          'Upload failed',
          err?.response?.data?.error ??
            'Could not upload photo. Please try again.',
        );
      } finally {
        setUploading(false);
      }
    },
    [setUser],
  );

  // ─────────────────────────────────────────────────────────────
  // Picker response
  // ─────────────────────────────────────────────────────────────

  const handlePickerResponse = useCallback(
    (response: ImagePickerResponse) => {
      if (
        response.didCancel ||
        response.errorCode
      ) {
        return;
      }

      const asset = response.assets?.[0];

      if (!asset?.uri) {
        return;
      }

      uploadPhoto(
        asset.uri,
        asset.fileName ?? 'profile.jpg',
        asset.type ?? 'image/jpeg',
      );
    },
    [uploadPhoto],
  );

  // ─────────────────────────────────────────────────────────────
  // Show picker
  // ─────────────────────────────────────────────────────────────

  const showPickerSheet = useCallback(() => {
    Alert.alert(
      'Change Profile Photo',
      'Choose a source',
      [
        {
          text: 'Camera',
          onPress: () =>
            launchCamera(
              {
                mediaType: 'photo',
                quality: 0.9,
                cameraType: 'front',
              },
              handlePickerResponse,
            ),
        },
        {
          text: 'Photo Library',
          onPress: () =>
            launchImageLibrary(
              {
                mediaType: 'photo',
                quality: 0.9,
                selectionLimit: 1,
              },
              handlePickerResponse,
            ),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  }, [handlePickerResponse]);

  const openImageViewer = useCallback((uri?: string | null) => {
    if (!uri) {
      return;
    }

    setViewerImages([{uri}]);
    setViewerVisible(true);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Colors
  // ─────────────────────────────────────────────────────────────

  const PRIMARY = colors.primary;

  const HERO_BG = isDark
    ? '#0f2041'
    : '#1e3a8a';

  const ACCENT = isDark
    ? '#2563eb'
    : '#2d52b0';

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.root,
        {backgroundColor: colors.bg},
      ]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View
          style={[
            styles.hero,
            {
              height: HERO_HEIGHT,
              backgroundColor: HERO_BG,
            },
          ]}>
          <View
            style={[
              styles.deco1,
              {backgroundColor: ACCENT},
            ]}
          />

          <View
            style={[
              styles.deco2,
              {backgroundColor: ACCENT},
            ]}
          />

          {/* Back */}
          <TouchableOpacity
            style={[
              styles.backBtn,
              {top: insets.top + 12},
            ]}
            onPress={() =>
              navigation.goBack()
            }>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Title */}
          <Text
            style={[
              styles.heroTitle,
              {top: insets.top + 14},
            ]}>
            Profile
          </Text>

          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            activeOpacity={0.9}
            disabled={uploading}
            onPress={() => {
              if (currentPhoto) {
                openImageViewer(currentPhoto);
              } else {
                showPickerSheet();
              }
            }}
            onLongPress={showPickerSheet}>
            {currentPhoto ? (
              <Image
                source={{uri: currentPhoto}}
                style={styles.avatarImage}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    backgroundColor: ACCENT,
                  },
                ]}>
                <Text style={styles.initialsText}>
                  {initials}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.avatarRing,
                {borderColor: colors.bg},
              ]}
            />

            {/* Camera badge */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={showPickerSheet}
              style={[
                styles.cameraBadge,
                {
                  backgroundColor:
                    PRIMARY,
                  borderColor: colors.bg,
                },
              ]}>
              {uploading ? (
                <ActivityIndicator
                  size={11}
                  color="#fff"
                />
              ) : (
                <MaterialCommunityIcons
                  name="camera"
                  size={13}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Name block */}
        <View
          style={[
            styles.nameBlock,
            {
              backgroundColor: colors.card,
            },
          ]}>
          <Text
            style={[
              styles.nameText,
              {color: colors.text},
            ]}>
            {userName}
          </Text>

          <View
            style={[
              styles.regPill,
              {
                backgroundColor:
                  colors.primaryMuted,
              },
            ]}>
            <MaterialCommunityIcons
              name="identifier"
              size={13}
              color={PRIMARY}
            />

            <Text
              style={[
                styles.regText,
                {color: PRIMARY},
              ]}>
              {registerNumber}
            </Text>
          </View>

          <View
            style={[
              styles.entryBadge,
              {
                backgroundColor:
                  user?.isLateralEntry
                    ? colors.cardWarn
                    : colors.cardSuccess,
              },
            ]}>
            <Text
              style={[
                styles.entryBadgeText,
                {
                  color:
                    user?.isLateralEntry
                      ? colors.warnText
                      : colors.successTitle,
                },
              ]}>
              {entryType}
            </Text>
          </View>
        </View>

        {/* Account Info */}
        <SectionLabel
          label="ACCOUNT INFO"
          colors={colors}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                colors.card,
            },
          ]}>
          <InfoRow
            icon="email-outline"
            label="Email"
            value={email}
            colors={colors}
            primary={PRIMARY}
          />

          <Divider
            color={colors.borderLight}
          />

          <InfoRow
            icon="source-branch"
            label="Branch"
            value={branchName}
            colors={colors}
            primary={PRIMARY}
          />

          <Divider
            color={colors.borderLight}
          />

          <InfoRow
            icon="calendar-month-outline"
            label="Batch"
            value={batchName}
            colors={colors}
            primary={PRIMARY}
          />
        </View>

        {/* Tutor */}
        <SectionLabel
          label="YOUR TUTOR"
          colors={colors}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                colors.card,
            },
          ]}>
          {tutorLoading ? (
            <View
              style={styles.tutorLoading}>
              <ActivityIndicator
                size="small"
                color={PRIMARY}
              />

              <Text
                style={[
                  styles.tutorLoadingText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}>
                Finding your tutor…
              </Text>
            </View>
          ) : tutor ? (
            <View style={styles.tutorRow}>
              {/* Tutor image */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (tutor.profilePhoto) {
                    openImageViewer(
                      tutor.profilePhoto,
                    );
                  }
                }}>
                {tutor.profilePhoto ? (
                  <Image
                    source={{
                      uri: tutor.profilePhoto,
                    }}
                    style={
                      styles.tutorAvatarImage
                    }
                  />
                ) : (
                  <View
                    style={[
                      styles.tutorAvatar,
                      {
                        backgroundColor:
                          PRIMARY,
                      },
                    ]}>
                    <Text
                      style={
                        styles.tutorInitials
                      }>
                      {getInitials(
                        tutor.name,
                      )}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.tutorInfo}>
                <Text
                  style={[
                    styles.tutorName,
                    {
                      color:
                        colors.text,
                    },
                  ]}>
                  {tutor.name}
                </Text>

                <View
                  style={
                    styles.tutorMeta
                  }>
                  {tutor.batch?.name ? (
                    <View
                      style={[
                        styles.metaChip,
                        {
                          backgroundColor:
                            colors.primaryMuted,
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name="account-group-outline"
                        size={11}
                        color={PRIMARY}
                      />

                      <Text
                        style={[
                          styles.metaChipText,
                          {
                            color:
                              PRIMARY,
                          },
                        ]}>
                        {
                          tutor.batch
                            .name
                        }
                      </Text>
                    </View>
                  ) : null}

                  {tutor.branch?.name ? (
                    <View
                      style={[
                        styles.metaChip,
                        {
                          backgroundColor:
                            colors.primaryMuted,
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name="source-branch"
                        size={11}
                        color={PRIMARY}
                      />

                      <Text
                        style={[
                          styles.metaChipText,
                          {
                            color:
                              PRIMARY,
                          },
                        ]}>
                        {
                          tutor.branch
                            .name
                        }
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.tutorEmail,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}>
                  {tutor.email}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={styles.tutorLoading}>
              <MaterialCommunityIcons
                name="account-question-outline"
                size={22}
                color={colors.textMuted}
              />

              <Text
                style={[
                  styles.tutorLoadingText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}>
                No tutor assigned to
                your batch yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ZOOMABLE PHOTO VIEWER */}
      <ImageViewing
        images={viewerImages}
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000"
        HeaderComponent={() => (
          <View style={viewerStyles.header}>
            <TouchableOpacity
              style={viewerStyles.closeBtn}
              onPress={() => setViewerVisible(false)}>
              <MaterialCommunityIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        FooterComponent={() => (
          <View style={viewerStyles.hintContainer}>
            <Text style={viewerStyles.hintText}>Pinch or double tap to zoom</Text>
          </View>
        )}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub Components
// ─────────────────────────────────────────────────────────────

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: any;
}) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        {color: colors.textMuted},
      ]}>
      {label}
    </Text>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  primary,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
  primary: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor:
              colors.primaryMuted,
          },
        ]}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={primary}
        />
      </View>

      <View style={styles.infoTexts}>
        <Text
          style={[
            styles.infoLabel,
            {
              color:
                colors.textMuted,
            },
          ]}>
          {label}
        </Text>

        <Text
          style={[
            styles.infoValue,
            {color: colors.text},
          ]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider({
  color,
}: {
  color: string;
}) {
  return (
    <View
      style={[
        styles.divider,
        {backgroundColor: color},
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const AVATAR_SIZE = 96;

const viewerStyles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 58 : 24,
    paddingHorizontal: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 42,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  root: {flex: 1},

  scroll: {flex: 1},

  scrollContent: {
    paddingHorizontal: 0,
  },

  hero: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom:
      AVATAR_SIZE / 2 + 8,
  },

  deco1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -60,
    opacity: 0.35,
  },

  deco2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: 10,
    left: -50,
    opacity: 0.25,
  },

  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor:
      'rgba(255,255,255,0.18)',
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

  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius:
      AVATAR_SIZE / 2,
  },

  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius:
      AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  initialsText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },

  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:
      AVATAR_SIZE / 2,
    borderWidth: 3,
  },

  cameraBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  nameBlock: {
    alignItems: 'center',
    paddingTop:
      AVATAR_SIZE / 2 + 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    gap: 8,
  },

  nameText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  regPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },

  regText: {
    fontSize: 13,
    fontWeight: '600',
  },

  entryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  entryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 20,
  },

  card: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },

  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoTexts: {flex: 1},

  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    marginLeft: 66,
  },

  tutorLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  tutorLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },

  tutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },

  tutorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  tutorAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  tutorInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  tutorInfo: {
    flex: 1,
    gap: 4,
  },

  tutorName: {
    fontSize: 16,
    fontWeight: '700',
  },

  tutorMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  tutorEmail: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
});