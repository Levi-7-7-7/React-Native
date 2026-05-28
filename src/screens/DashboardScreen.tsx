import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  Animated as RNAnimated,
  StatusBar,
  Platform,
} from 'react-native';

import {ScrollView} from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ImageViewing from 'react-native-image-viewing';

import axiosInstance from '../api/axiosInstance';
import {useAuth} from '../context/AuthContext';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';
import {useTheme} from '../theme';
import {tabEmitter} from '../utils/tabEvents';

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
// Memoized Activity Row
// ─────────────────────────────────────────────────────────────

const ActivityRow = React.memo(
  ({
    cert,
    isLast,
    colors,
    getActivityStatusStyle,
  }: {
    cert: any;
    isLast: boolean;
    colors: any;
    getActivityStatusStyle: (
      s: string,
    ) => {color: string};
  }) => (
    <View
      style={[
        styles.activityRow,
        {
          borderBottomColor:
            colors.borderLight,
        },
        isLast && {
          borderBottomWidth: 0,
        },
      ]}>
      <View style={styles.activityLeft}>
        <View
          style={[
            styles.activityDot,
            {
              backgroundColor:
                colors.primary,
            },
          ]}
        />

        <View style={{flex: 1}}>
          <Text
            numberOfLines={1}
            style={[
              styles.activityName,
              {color: colors.text},
            ]}>
            {cert.subcategory ||
              cert.eventName ||
              'Certificate'}
          </Text>

          <View style={styles.dateRow}>
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={14}
              color={colors.textMuted}
            />

            <Text
              style={[
                styles.activityDate,
                {
                  color:
                    colors.textMuted,
                },
              ]}>
              {cert.createdAt
                ? new Date(
                    cert.createdAt,
                  ).toLocaleDateString()
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      <Text
        style={[
          styles.activityStatus,
          getActivityStatusStyle(
            cert.status,
          ),
        ]}>
        {cert.status?.toLowerCase() ===
        'approved'
          ? `+${
              cert.pointsAwarded ??
              0
            } pts`
          : cert.status}
      </Text>
    </View>
  ),
);

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const {user, setUser, logout} =
    useAuth();

  const {colors, isDark} =
    useTheme();

  const navigation =
    useNavigation<any>();

  const insets =
    useSafeAreaInsets();

  const [certificates, setCertificates] =
    useState<any[]>([]);

  const [categories, setCategories] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [photoExpanded, setPhotoExpanded] =
    useState(false);

  // ─────────────────────────────────────────────────────────────
  // Universal 3-dot menu
  // ─────────────────────────────────────────────────────────────

  const [menuVisible, setMenuVisible] =
    useState(false);

  const menuAnim = useRef(
    new RNAnimated.Value(0),
  ).current;

  const menuBtnRef =
    useRef<TouchableOpacity>(null);

  const [menuPos, setMenuPos] =
    useState({
      top: 0,
      right: 0,
    });

  // ─────────────────────────────────────────────────────────────
  // Fetch data
  // ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async () => {
      try {
        const [
          userRes,
          certRes,
          catRes,
        ] = await Promise.all([
          axiosInstance.get(
            '/students/me',
          ),
          axiosInstance.get(
            '/certificates/my',
          ),
          axiosInstance.get(
            '/categories',
          ),
        ]);

        setUser(userRes.data);

        setCertificates(
          certRes.data.certificates ||
            [],
        );

        setCategories(
          catRes.data.categories ||
            [],
        );
      } catch (err: any) {
        if (
          err.response?.status === 401
        ) {
          await logout();
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [logout, setUser],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────────────────────────────────────────────────────
  // Refresh
  // ─────────────────────────────────────────────────────────────

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ─────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────

  const cappedTotal = useMemo(() => {
    if (
      !certificates.length ||
      !categories.length
    ) {
      return 0;
    }

    const approved =
      certificates.filter(
        c =>
          c.status?.toLowerCase() ===
          'approved',
      );

    return calcCappedPoints(
      approved,
      categories,
      user?.isLateralEntry ??
        false,
    );
  }, [
    certificates,
    categories,
    user?.isLateralEntry,
  ]);

  const PASS_POINTS = passThreshold(
    user?.isLateralEntry,
  );

  const hasPassed =
    cappedTotal >= PASS_POINTS;

  const progressPct = Math.min(
    cappedTotal / PASS_POINTS,
    1,
  );

  const userName =
    user?.name || 'Student';

  const initials = useMemo(
    () => getInitials(userName),
    [userName],
  );

  const currentPhoto = useMemo(
    () =>
      photoUrl(user?.profilePhoto),
    [user?.profilePhoto],
  );

  const recentActivities =
    useMemo(
      () => certificates.slice(0, 5),
      [certificates],
    );

  // ─────────────────────────────────────────────────────────────
  // Activity status colors
  // ─────────────────────────────────────────────────────────────

  const getActivityStatusStyle =
    useCallback(
      (status: string) => {
        switch (
          status?.toLowerCase()
        ) {
          case 'approved':
            return {
              color:
                colors.badgeApprovedText,
            };

          case 'pending':
            return {
              color:
                colors.badgePendingText,
            };

          case 'rejected':
            return {
              color:
                colors.badgeRejectedText,
            };

          default:
            return {
              color:
                colors.textMuted,
            };
        }
      },
      [colors],
    );

  // ─────────────────────────────────────────────────────────────
  // Menu handlers
  // ─────────────────────────────────────────────────────────────

  const openMenu = useCallback(() => {
    menuBtnRef.current?.measure(
      (
        _fx,
        _fy,
        _w,
        _h,
        px,
        py,
      ) => {
        setMenuPos({
          top: py + _h + 6,
          right: 16,
        });
      },
    );

    setMenuVisible(true);

    RNAnimated.spring(menuAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 240,
      friction: 18,
    }).start();
  }, [menuAnim]);

  const closeMenu = useCallback(
    (cb?: () => void) => {
      RNAnimated.timing(menuAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start(() => {
        setMenuVisible(false);
        cb?.();
      });
    },
    [menuAnim],
  );

  const goToProfile =
    useCallback(() => {
      closeMenu(() =>
        navigation.navigate(
          'Profile',
        ),
      );
    }, [closeMenu, navigation]);

  const handleLogout =
    useCallback(() => {
      closeMenu(() => logout());
    }, [closeMenu, logout]);

  const menuScale =
    menuAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.86, 1],
    });

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.bg,
        },
      ]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
      />

      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor:
              colors.bg,
          },
        ]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              insets.top + 10,
            paddingBottom:
              insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={
              colors.card
            }
          />
        }>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarGroup}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (
                  currentPhoto
                ) {
                  setPhotoExpanded(
                    true,
                  );
                } else {
                  navigation.navigate(
                    'Profile',
                  );
                }
              }}>
              {currentPhoto ? (
                <Image
                  source={{
                    uri: currentPhoto,
                  }}
                  style={[
                    styles.avatar,
                    styles.avatarImage,
                  ]}
                  fadeDuration={0}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        colors.primary,
                    },
                  ]}>
                  <Text
                    style={
                      styles.avatarText
                    }>
                    {initials}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View>
              <Text
                style={[
                  styles.helloText,
                  {
                    color:
                      colors.text,
                  },
                ]}>
                Hello, {userName}
              </Text>

              <Text
                style={[
                  styles.welcomeText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}>
                Welcome back!
              </Text>
            </View>
          </View>

          {/* Universal 3 dots */}
          <TouchableOpacity
            ref={menuBtnRef}
            style={[
              styles.menuBtn,
              {
                backgroundColor:
                  colors.card,
              },
            ]}
            onPress={openMenu}
            activeOpacity={0.75}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}>
            <MaterialCommunityIcons
              name="dots-vertical"
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Points card */}
        <View
          style={[
            styles.pointsCard,
            {
              backgroundColor:
                colors.cardBlue,
            },
          ]}>
          <View>
            <Text
              style={[
                styles.pointsLabel,
                {
                  color:
                    colors.pointsLabel,
                },
              ]}>
              Activity Points
            </Text>

            {loading ? (
              <ActivityIndicator
                color="#ffffff"
                style={{
                  marginTop: 10,
                }}
              />
            ) : (
              <Text
                style={
                  styles.pointsValue
                }>
                {cappedTotal}
              </Text>
            )}

            <Text
              style={[
                styles.pointsOf,
                {
                  color:
                    colors.pointsOf,
                },
              ]}>
              of {PASS_POINTS}{' '}
              required
            </Text>
          </View>

          <MaterialCommunityIcons
            name="trophy-outline"
            size={50}
            color={colors.trophyIcon}
          />
        </View>

        {/* Progress */}
        <View
          style={[
            styles.progressBg,
            {
              backgroundColor:
                colors.border,
            },
          ]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  progressPct *
                  100
                }%`,
                backgroundColor:
                  hasPassed
                    ? '#22c55e'
                    : colors.primary,
              },
            ]}
          />
        </View>

        {/* Passed banner */}
        {hasPassed && (
          <View
            style={[
              styles.passBanner,
              {
                backgroundColor:
                  colors.cardSuccess,
              },
            ]}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={42}
              color={
                colors.success ||
                '#22c55e'
              }
            />

            <View
              style={
                styles.passBannerText
              }>
              <Text
                style={[
                  styles.passBannerTitle,
                  {
                    color:
                      colors.badgeApprovedText,
                  },
                ]}>
                Activity Points
                Completed!
              </Text>

              <Text
                style={[
                  styles.passBannerSub,
                  {
                    color: isDark
                      ? '#86efac'
                      : '#15803d',
                  },
                ]}>
                You have
                successfully met
                the required
                activity points.
              </Text>
            </View>

            <View
              style={
                styles.passBadge
              }>
              <Text
                style={
                  styles.passBadgeText
                }>
                PASSED
              </Text>
            </View>
          </View>
        )}

        {/* Recent activities */}
        <Text
          style={[
            styles.sectionTitle,
            {color: colors.text},
          ]}>
          Recent Activities
        </Text>

        <View
          style={[
            styles.activitiesCard,
            {
              backgroundColor:
                colors.card,
            },
          ]}>
          {loading ? (
            [1, 2, 3].map(n => (
              <View
                key={n}
                style={
                  styles.skeletonRow
                }>
                <View
                  style={[
                    styles.skeletonCircle,
                    {
                      backgroundColor:
                        colors.skeleton,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.skeletonLine,
                    {
                      backgroundColor:
                        colors.skeleton,
                    },
                  ]}
                />
              </View>
            ))
          ) : recentActivities.length ===
            0 ? (
            <Text
              style={[
                styles.noData,
                {
                  color:
                    colors.textMuted,
                },
              ]}>
              No activity yet.
              Upload your first
              certificate!
            </Text>
          ) : (
            recentActivities.map(
              (cert, idx) => (
                <ActivityRow
                  key={cert._id}
                  cert={cert}
                  isLast={
                    idx ===
                    recentActivities.length -
                      1
                  }
                  colors={colors}
                  getActivityStatusStyle={
                    getActivityStatusStyle
                  }
                />
              ),
            )
          )}

          {!loading &&
            certificates.length >
              5 && (
              <TouchableOpacity
                activeOpacity={
                  0.8
                }
                style={
                  styles.viewAllBtn
                }
                onPress={() =>
                  tabEmitter.emit(
                    'switchTab',
                    1,
                  )
                }>
                <Text
                  style={[
                    styles.viewAllText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}>
                  View All
                  Certificates →
                </Text>
              </TouchableOpacity>
            )}
        </View>
      </ScrollView>

      {/* Dropdown menu */}
      {menuVisible && (
        <Modal
          transparent
          animationType="none"
          onRequestClose={() =>
            closeMenu()
          }>
          <TouchableOpacity
            style={
              StyleSheet.absoluteFill
            }
            activeOpacity={1}
            onPress={() =>
              closeMenu()
            }
          />

          <RNAnimated.View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor:
                  colors.card,
                top: menuPos.top,
                right:
                  menuPos.right,
                opacity: menuAnim,
                transform: [
                  {
                    scale:
                      menuScale,
                  },
                ],
                shadowColor:
                  '#000',
                shadowOffset: {
                  width: 0,
                  height: 4,
                },
                shadowOpacity:
                  isDark
                    ? 0.4
                    : 0.15,
                shadowRadius: 12,
                elevation: 12,
              },
            ]}>
            <TouchableOpacity
              style={[
                styles.menuItem,
                {
                  borderBottomColor:
                    colors.borderLight,
                },
              ]}
              onPress={
                goToProfile
              }
              activeOpacity={
                0.75
              }>
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={20}
                color={
                  colors.primary
                }
              />

              <Text
                style={[
                  styles.menuItemText,
                  {
                    color:
                      colors.text,
                  },
                ]}>
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.menuItem
              }
              onPress={
                handleLogout
              }
              activeOpacity={
                0.75
              }>
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color={
                  colors.dangerText
                }
              />

              <Text
                style={[
                  styles.menuItemText,
                  {
                    color:
                      colors.dangerText,
                  },
                ]}>
                Log Out
              </Text>
            </TouchableOpacity>
          </RNAnimated.View>
        </Modal>
      )}

      {/* ZOOMABLE PHOTO VIEWER */}
      <ImageViewing
        images={
          currentPhoto
            ? [{uri: currentPhoto}]
            : []
        }
        imageIndex={0}
        visible={photoExpanded}
        onRequestClose={() =>
          setPhotoExpanded(false)
        }
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000"
        HeaderComponent={() => (
          <View style={viewerStyles.header}>
            <TouchableOpacity
              style={viewerStyles.closeBtn}
              onPress={() => setPhotoExpanded(false)}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        )}
        FooterComponent={() => (
          <View style={viewerStyles.hintContainer}>
            <Text style={viewerStyles.hintText}>
              Pinch or double tap to zoom
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

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
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarImage: {},

  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },

  helloText: {
    fontSize: 18,
    fontWeight: '700',
  },

  welcomeText: {
    fontSize: 13,
    marginTop: 1,
  },

  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropdownMenu: {
    position: 'absolute',
    borderRadius: 16,
    minWidth: 180,
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },

  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },

  pointsCard: {
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  pointsLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },

  pointsValue: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
  },

  pointsOf: {
    fontSize: 13,
    marginTop: 2,
  },

  progressBg: {
    height: 6,
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },

  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  passBanner: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  passBannerText: {
    flex: 1,
  },

  passBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },

  passBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  passBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  passBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },

  activitiesCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },

  skeletonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  skeletonLine: {
    flex: 1,
    height: 14,
    borderRadius: 7,
  },

  activityRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  activityName: {
    fontSize: 14,
    fontWeight: '600',
  },

  activityDate: {
    fontSize: 12,
  },

  activityStatus: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 10,
  },

  noData: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },

  viewAllBtn: {
    marginTop: 16,
    alignItems: 'center',
  },

  viewAllText: {
    fontWeight: '600',
    fontSize: 14,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});
