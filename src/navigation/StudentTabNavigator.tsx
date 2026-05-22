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
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../theme';
import DashboardScreen from '../screens/DashboardScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import UploadCertificateScreen from '../screens/UploadCertificateScreen';
import {useFcmToken} from '../utils/useFcmToken';
import {tabEmitter} from '../utils/tabEvents';

const TAB_COUNT = 3;
const TABS = [
  {name: 'Dashboard', icon: 'view-dashboard-outline', component: DashboardScreen},
  {name: 'Certificates', icon: 'certificate-outline', component: CertificatesScreen},
  {name: 'Upload', icon: 'upload-outline', component: UploadCertificateScreen},
];

const SPRING_CONFIG = {
  damping: 38,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: true,
};

export default function StudentTabNavigator() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  useFcmToken();

  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width,
  );

  const translateX = useSharedValue(0);
  const currentIndexSV = useSharedValue(0);
  const progress = useSharedValue(0);

  const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 65 + insets.bottom : 80;

  const syncProgress = useCallback((val: number) => {
    // no-op — only needed to satisfy runOnJS typing if needed
  }, []);

  const snapToIndex = useCallback(
    (index: number, width: number) => {
      'worklet';
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, index));
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

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      'worklet';
      const base = -currentIndexSV.value * containerWidth;
      let drag = event.translationX;
      const projected = base + drag;
      const minX = -(TAB_COUNT - 1) * containerWidth;
      if (projected > 0) drag = drag * 0.15;
      else if (projected < minX) drag = drag * 0.15;
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
    transform: [{translateX: translateX.value}],
  }));

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [{translateX: (progress.value * containerWidth) / TAB_COUNT}],
  }));

  return (
    <View
      style={styles.container}
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
              height: '100%',
              paddingBottom: TAB_BAR_HEIGHT,
              backgroundColor: colors.bg,
            },
            rowAnimStyle,
          ]}>
          {TABS.map(tab => {
            const Comp = tab.component;
            return (
              // In the TABS.map render, change the wrapper View:
<View
  key={tab.name}
  style={{
    width: containerWidth,
    overflow: 'hidden',
    height: '100%',
    backgroundColor: colors.bg,  // ← ADD THIS
  }}>
  <Comp />
</View>
            );
          })}
        </Animated.View>
      </GestureDetector>

      {/* Tab bar */}
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

        {/* Tab items */}
        {TABS.map((tab, i) => (
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

function AnimatedTabItem({
  tab,
  index,
  progress,
  colors,
  onPress,
}: {
  tab: (typeof TABS)[0];
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

      {/* Icon stack — active and inactive cross-fade */}
      <View style={styles.iconWrapper}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, activeIconStyle]}>
          <MaterialCommunityIcons name={tab.icon} size={24} color={colors.primary} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, inactiveIconStyle]}>
          <MaterialCommunityIcons name={tab.icon} size={24} color={colors.textMuted} />
        </Animated.View>
      </View>

      {/* Label stack — active and inactive cross-fade */}
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
  // Fixed-size box that holds the icon — both layers sit inside this
  iconWrapper: {
    width: 28,
    height: 28,
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed-size box that holds the label — both layers sit inside this
  labelWrapper: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
