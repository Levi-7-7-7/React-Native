/**
 * TutorTabNavigator
 *
 * Mirrors the web TutorDashboard layout:
 *   - Header with avatar, greeting, logout
 *   - Swipeable content area
 *   - Bottom tab bar
 *   - react-native-image-viewing for profile image zoom (same as ProfileScreen)
 */

import React, {useCallback, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Alert,
  Image,
  Modal,
  Animated as RNAnimated,
} from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import ImageViewing from 'react-native-image-viewing';

import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../theme';
import {useAuth} from '../context/AuthContext';

import TutorStudentsScreen from '../screens/TutorStudentsScreen';
import TutorUploadCSVScreen from '../screens/TutorUploadCSVScreen';
import TutorPendingScreen from '../screens/TutorPendingScreen';
import TutorApprovedScreen from '../screens/TutorApprovedScreen';

import {useTutorFcmToken} from '../utils/useTutorFcmToken';
import tutorAxios from '../api/tutorAxios';

const TAB_COUNT = 4;

const TABS = [
  {
    name: 'Students',
    icon: 'account-group-outline',
    component: TutorStudentsScreen,
  },
  {
    name: 'Upload CSV',
    icon: 'file-upload-outline',
    component: TutorUploadCSVScreen,
  },
  {
    name: 'Pending',
    icon: 'clipboard-list-outline',
    component: TutorPendingScreen,
  },
  {
    name: 'Approved',
    icon: 'check-decagram-outline',
    component: TutorApprovedScreen,
  },
];

const SPRING_CONFIG = {
  damping: 38,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: true,
};

export default function TutorTabNavigator() {
  const {colors} = useTheme();
  const {logout} = useAuth();

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [tutorName, setTutorName] = useState('Tutor');
  const [tutorPhoto, setTutorPhoto] = useState<string | null>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{uri: string}[]>([]);

  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width,
  );

  const [menuVisible, setMenuVisible] = useState(false);

  const menuAnim = useRef(new RNAnimated.Value(0)).current;

  const [pendingBadge, setPendingBadge] = useState(0);

  useTutorFcmToken(() => {
    setPendingBadge(prev => prev + 1);
  });

  const translateX = useSharedValue(0);
  const currentIndexSV = useSharedValue(0);
  const progress = useSharedValue(0);

  const TAB_BAR_HEIGHT =
    Platform.OS === 'android'
      ? 65 + insets.bottom
      : 80;

  const fetchProfile = useCallback(async () => {
    try {
      const res = await tutorAxios.get('/tutors/me');

      const data = res.data;

      if (data?.name) {
        setTutorName(data.name);

        await AsyncStorage.setItem(
          'tutorName',
          data.name,
        );
      }

      setTutorPhoto(data?.profilePhoto ?? null);
    } catch {
      const n = await AsyncStorage.getItem('tutorName');

      if (n) {
        setTutorName(n);
      }
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const avatarInitials = tutorName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showMenu = () => {
    setMenuVisible(true);

    RNAnimated.spring(menuAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();
  };

  const hideMenu = () => {
    RNAnimated.timing(menuAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const handleLogout = () => {
    hideMenu();

    setTimeout(() => {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: () => logout(),
          },
        ],
      );
    }, 200);
  };

  const handleViewProfile = () => {
    hideMenu();

    setTimeout(() => {
      navigation.navigate('TutorProfile');
    }, 200);
  };

  const openImageViewer = useCallback((uri: string) => {
    setViewerImages([{uri}]);
    setViewerVisible(true);
  }, []);

  const snapToIndex = useCallback(
    (index: number, width: number) => {
      'worklet';

      const clamped = Math.max(
        0,
        Math.min(TAB_COUNT - 1, index),
      );

      currentIndexSV.value = clamped;

      progress.value = withSpring(
        clamped,
        SPRING_CONFIG,
      );

      translateX.value = withSpring(
        -clamped * width,
        SPRING_CONFIG,
      );
    },
    [translateX, currentIndexSV, progress],
  );

  const goToTab = useCallback(
    (index: number) => {
      const width = Dimensions.get('window').width;

      snapToIndex(index, width);
    },
    [snapToIndex],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      'worklet';

      const base = -currentIndexSV.value * containerWidth;

      let drag = event.translationX;

      const projected = base + drag;

      const minX = -(TAB_COUNT - 1) * containerWidth;

      if (projected > 0) {
        drag = drag * 0.15;
      } else if (projected < minX) {
        drag = drag * 0.15;
      }

      translateX.value = base + drag;

      progress.value = -translateX.value / containerWidth;
    })
    .onEnd(event => {
      'worklet';

      const {translationX: tx, velocityX: vx} = event;

      let targetIndex = currentIndexSV.value;

      if (vx < -500 || tx < -containerWidth * 0.3) {
        targetIndex = currentIndexSV.value + 1;
      } else if (vx > 500 || tx > containerWidth * 0.3) {
        targetIndex = currentIndexSV.value - 1;
      }

      snapToIndex(targetIndex, containerWidth);
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: translateX.value,
      },
    ],
  }));

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (progress.value * containerWidth) / TAB_COUNT,
      },
    ],
  }));

  const HEADER_HEIGHT = 72 + insets.top;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
        },
      ]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 12,
            height: HEADER_HEIGHT,
          },
        ]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.8}
            onPress={() => {
              if (tutorPhoto) {
                openImageViewer(tutorPhoto);
              } else {
                navigation.navigate('TutorProfile');
              }
            }}>
            {tutorPhoto ? (
              <Image
                source={{uri: tutorPhoto}}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {avatarInitials}
              </Text>
            )}
          </TouchableOpacity>

          <View>
            <Text
              style={[
                styles.welcomeText,
                {color: colors.primary},
              ]}>
              Welcome, {tutorName}!
            </Text>

            <Text
              style={[
                styles.welcomeSub,
                {color: colors.textMuted},
              ]}>
              Manage students & certificates
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={showMenu}
          activeOpacity={0.7}>
          <Icon
            name="dots-vertical"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* ── Dropdown Menu ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={hideMenu}>
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={hideMenu}>
          <RNAnimated.View
            style={[
              styles.menuDropdown,
              {
                backgroundColor: colors.card,
                shadowColor: '#000',
                opacity: menuAnim,
                transform: [
                  {
                    scale: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                  {
                    translateY: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
            onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={[
                styles.menuItem,
                {borderBottomColor: colors.border},
              ]}
              onPress={handleViewProfile}>
              <Icon
                name="account-circle-outline"
                size={20}
                color={colors.primary}
              />

              <Text
                style={[
                  styles.menuItemText,
                  {color: colors.text},
                ]}>
                View Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}>
              <Icon
                name="logout"
                size={20}
                color="#ef4444"
              />

              <Text
                style={[
                  styles.menuItemText,
                  {color: '#ef4444'},
                ]}>
                Logout
              </Text>
            </TouchableOpacity>
          </RNAnimated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Content ── */}
      <View
        style={[
          styles.content,
          {marginTop: HEADER_HEIGHT},
        ]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;

          setContainerWidth(w);

          translateX.value = -currentIndexSV.value * w;
        }}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.row,
              {
                width: containerWidth * TAB_COUNT,
                paddingBottom: TAB_BAR_HEIGHT,
                backgroundColor: colors.bg,
              },
              rowAnimStyle,
            ]}>
            {TABS.map(tab => {
              const Comp = tab.component;

              return (
                <View
                  key={tab.name}
                  style={{
                    width: containerWidth,
                    overflow: 'hidden',
                    height: '100%',
                    backgroundColor: colors.bg,
                  }}>
                  <Comp />
                </View>
              );
            })}
          </Animated.View>
        </GestureDetector>

        {/* ── Tab Bar ── */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              height: TAB_BAR_HEIGHT,
              paddingBottom: insets.bottom,
            },
          ]}>
          <View style={styles.indicatorTrack}>
            <Animated.View
              style={[
                styles.indicator,
                {
                  width: containerWidth / TAB_COUNT,
                  backgroundColor: colors.primary,
                },
                indicatorAnimStyle,
              ]}
            />
          </View>

          {TABS.map((tab, i) => (
            <AnimatedTabItem
              key={tab.name}
              tab={tab}
              index={i}
              progress={progress}
              colors={colors}
              badge={tab.name === 'Pending' ? pendingBadge : 0}
              onPress={() => {
                if (tab.name === 'Pending') {
                  setPendingBadge(0);
                }

                goToTab(i);
              }}
            />
          ))}
        </View>
      </View>

      {/* ── Zoomable Photo Viewer (react-native-image-viewing) ── */}
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
              <Icon name="close" size={22} color="#fff" />
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
// Animated Tab Item
// ─────────────────────────────────────────────────────────────

function AnimatedTabItem({
  tab,
  index,
  progress,
  colors,
  badge,
  onPress,
}: any) {
  const activeStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);

    return {
      opacity: interpolate(d, [0, 0.5], [1, 0], 'clamp'),
    };
  });

  const inactiveStyle = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);

    return {
      opacity: interpolate(d, [0, 0.5], [0, 1], 'clamp'),
    };
  });

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.iconWrapper}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.iconCenter,
            activeStyle,
          ]}>
          <Icon name={tab.icon} size={22} color={colors.primary} />
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.iconCenter,
            inactiveStyle,
          ]}>
          <Icon name={tab.icon} size={22} color={colors.textMuted} />
        </Animated.View>

        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.labelWrapper}>
        <Animated.Text
          style={[
            styles.tabLabel,
            {color: colors.primary, position: 'absolute'},
            activeStyle,
          ]}>
          {tab.name}
        </Animated.Text>

        <Animated.Text
          style={[
            styles.tabLabel,
            {color: colors.textMuted, position: 'absolute'},
            inactiveStyle,
          ]}>
          {tab.name}
        </Animated.Text>
      </View>
    </TouchableOpacity>
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
  root: {
    flex: 1,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 16,
    paddingBottom: 12,

    borderBottomWidth: 1,

    zIndex: 10,

    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 4,

    elevation: 4,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: '#2563eb',

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',
  },

  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  welcomeText: {
    fontSize: 15,
    fontWeight: '700',
  },

  welcomeSub: {
    fontSize: 11,
    marginTop: 1,
  },

  menuBtn: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 19,
  },

  menuBackdrop: {
    flex: 1,
  },

  menuDropdown: {
    position: 'absolute',
    top: 68,
    right: 12,

    borderRadius: 12,

    minWidth: 180,

    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,

    elevation: 8,

    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 12,

    paddingHorizontal: 16,
    paddingVertical: 14,

    borderBottomWidth: 1,
  },

  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },

  content: {
    flex: 1,
    overflow: 'hidden',
  },

  row: {
    position: 'absolute',
    top: 0,
    left: 0,

    flexDirection: 'row',

    height: '100%',
  },

  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,

    flexDirection: 'row',

    borderTopWidth: 1,

    elevation: 8,

    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },

  indicatorTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,

    height: 3,
  },

  indicator: {
    height: 3,
    borderRadius: 2,
  },

  tabItem: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingTop: 8,
    paddingBottom: 4,

    gap: 3,
  },

  iconWrapper: {
    width: 26,
    height: 26,
  },

  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -6,

    minWidth: 16,
    height: 16,

    borderRadius: 8,

    backgroundColor: '#ef4444',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 3,
  },

  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  labelWrapper: {
    height: 13,

    alignItems: 'center',
    justifyContent: 'center',

    minWidth: 50,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});