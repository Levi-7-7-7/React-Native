import React, {useCallback, useState, useEffect} from 'react';
import {
  Platform,
  Dimensions,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../theme';
import DashboardScreen from '../screens/DashboardScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import UploadCertificateScreen from '../screens/UploadCertificateScreen';
import ProfileScreen from '../screens/ProfileScreen';
import {useFcmToken} from '../utils/useFcmToken';
import {tabEmitter} from '../utils/tabEvents';

// ── tab definitions ───────────────────────────────────────────────────────────
// Only the first 3 appear in the tab bar. Profile (index 3) is hidden.

const VISIBLE_TABS = [
  {name: 'Dashboard',    icon: 'view-dashboard-outline', component: DashboardScreen},
  {name: 'Certificates', icon: 'certificate-outline',    component: CertificatesScreen},
  {name: 'Upload',       icon: 'upload-outline',         component: UploadCertificateScreen},
];

// All panels rendered in the swipe row (Profile is panel 3 but invisible in bar)
const ALL_PANELS = [
  ...VISIBLE_TABS,
  {name: 'Profile', icon: '', component: ProfileScreen},
];

const PANEL_COUNT  = ALL_PANELS.length; // 4
const TAB_COUNT    = VISIBLE_TABS.length; // 3 (only these show in bar)

const SPRING_CONFIG = {
  damping: 38,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: true,
};

// ── navigator ─────────────────────────────────────────────────────────────────

export default function StudentTabNavigator() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  useFcmToken();

  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width,
  );

  const translateX       = useSharedValue(0);
  const currentIndexSV   = useSharedValue(0);
  const progress         = useSharedValue(0);

  const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 65 + insets.bottom : 80;

  const snapToIndex = useCallback(
    (index: number, width: number) => {
      'worklet';
      const clamped = Math.max(0, Math.min(PANEL_COUNT - 1, index));
      currentIndexSV.value = clamped;
      progress.value = withSpring(clamped, {
        damping: 38,
        stiffness: 280,
        mass: 0.8,
        overshootClamping: true,
      });
      translateX.value = withSpring(-clamped * width, SPRING_CONFIG);
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

  useEffect(() => {
    const handler = (index: number) => goToTab(index);
    tabEmitter.on('switchTab', handler);
    return () => tabEmitter.off('switchTab', handler);
  }, [goToTab]);

  // Swipe gesture — only allow swiping between visible tabs (0-2).
  // Profile panel (3) is only reachable via the menu, not by swiping.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      'worklet';
      const base = -currentIndexSV.value * containerWidth;
      let drag = event.translationX;
      const projected = base + drag;
      const minX = -(TAB_COUNT - 1) * containerWidth; // clamp at Upload (index 2)
      if (projected > 0) {drag = drag * 0.15;}
      else if (projected < minX) {drag = drag * 0.15;}
      translateX.value = base + drag;
      progress.value = -translateX.value / containerWidth;
    })
    .onEnd(event => {
      'worklet';
      const {translationX: tx, velocityX: vx} = event;
      let targetIndex = currentIndexSV.value;
      // Only snap within visible tabs
      if (currentIndexSV.value < TAB_COUNT) {
        if (vx < -500 || tx < -containerWidth * 0.3) {
          targetIndex = Math.min(currentIndexSV.value + 1, TAB_COUNT - 1);
        } else if (vx > 500 || tx > containerWidth * 0.3) {
          targetIndex = Math.max(currentIndexSV.value - 1, 0);
        }
      }
      snapToIndex(targetIndex, containerWidth);
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    // Only track position within the 3 visible tabs
    transform: [{translateX: (Math.min(progress.value, TAB_COUNT - 1) * containerWidth) / TAB_COUNT}],
  }));

  return (
    <View
      style={[styles.container, {backgroundColor: colors.bg, marginTop: insets.top}]}
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
              width: containerWidth * PANEL_COUNT,
              height: '100%',
              paddingBottom: TAB_BAR_HEIGHT,
              backgroundColor: colors.bg,
            },
            rowAnimStyle,
          ]}>
          {ALL_PANELS.map(panel => {
            const Comp = panel.component;
            return (
              <View
                key={panel.name}
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

      {/* Tab bar — only renders the 3 visible tabs */}
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

        {/* Sliding top indicator */}
        <View style={styles.indicatorTrack}>
          <Animated.View
            style={[
              styles.indicator,
              {width: containerWidth / TAB_COUNT, backgroundColor: colors.primary},
              indicatorAnimStyle,
            ]}
          />
        </View>

        {/* Visible tab items only */}
        {VISIBLE_TABS.map((tab, i) => (
          <AnimatedTabItem
            key={tab.name}
            tab={tab}
            index={i}
            progress={progress}
            colors={colors}
            onPress={() => goToTab(i)}
          />
        ))}
      </View>
    </View>
  );
}

// ── animated tab item ─────────────────────────────────────────────────────────

function AnimatedTabItem({
  tab,
  index,
  progress,
  colors,
  onPress,
}: {
  tab: (typeof VISIBLE_TABS)[0];
  index: number;
  progress: Animated.SharedValue<number>;
  colors: any;
  onPress: () => void;
}) {
  const activeIconStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {opacity: interpolate(distance, [0, 0.5], [1, 0], 'clamp')};
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {opacity: interpolate(distance, [0, 0.5], [0, 1], 'clamp')};
  });

  const activeLabelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {opacity: interpolate(distance, [0, 0.5], [1, 0], 'clamp')};
  });

  const inactiveLabelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {opacity: interpolate(distance, [0, 0.5], [0, 1], 'clamp')};
  });

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}>

      <View style={styles.iconWrapper}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, activeIconStyle]}>
          <MaterialCommunityIcons name={tab.icon} size={24} color={colors.primary} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, inactiveIconStyle]}>
          <MaterialCommunityIcons name={tab.icon} size={24} color={colors.textMuted} />
        </Animated.View>
      </View>

      <View style={styles.labelWrapper}>
        <Animated.Text
          style={[styles.tabLabel, {color: colors.primary, position: 'absolute'}, activeLabelStyle]}>
          {tab.name}
        </Animated.Text>
        <Animated.Text
          style={[styles.tabLabel, {color: colors.textMuted, position: 'absolute'}, inactiveLabelStyle]}>
          {tab.name}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, overflow: 'hidden'},
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
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
  iconWrapper: {width: 28, height: 28},
  iconCenter: {alignItems: 'center', justifyContent: 'center'},
  labelWrapper: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
