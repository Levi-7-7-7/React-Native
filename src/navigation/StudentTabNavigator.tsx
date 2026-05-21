import React, {useCallback, useState, useEffect} from 'react';
import {
  Platform,
  Dimensions,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  runOnUI,
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

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const TAB_COUNT = 3;
const TABS = [
  {name: 'Dashboard', icon: 'view-dashboard-outline', component: DashboardScreen},
  {name: 'Certificates', icon: 'certificate-outline', component: CertificatesScreen},
  {name: 'Upload', icon: 'upload-outline', component: UploadCertificateScreen},
];

// Slower, no bounce spring
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

  const [activeTab, setActiveTab] = useState(0);
  const translateX = useSharedValue(0);
  const currentIndexSV = useSharedValue(0);

  const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 65 + insets.bottom : 80;

  const syncActiveTab = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  const snapTo = useCallback(
    (index: number) => {
      'worklet';
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, index));
      currentIndexSV.value = clamped;
      translateX.value = withSpring(-clamped * SCREEN_WIDTH, SPRING_CONFIG);
      runOnJS(syncActiveTab)(clamped);
    },
    [translateX, currentIndexSV, syncActiveTab],
  );

  // Listen for tab switch events from screens (e.g. "View All" button)
  useEffect(() => {
    const handler = (index: number) => {
      runOnUI(snapTo)(index);
    };
    tabEmitter.on('switchTab', handler);
    return () => {
      tabEmitter.off('switchTab', handler);
    };
  }, [snapTo]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      'worklet';
      const base = -currentIndexSV.value * SCREEN_WIDTH;
      let drag = event.translationX;
      const projected = base + drag;
      const minX = -(TAB_COUNT - 1) * SCREEN_WIDTH;
      if (projected > 0) {
        drag = drag * 0.15;
      } else if (projected < minX) {
        drag = drag * 0.15;
      }
      translateX.value = base + drag;
    })
    .onEnd(event => {
      'worklet';
      const {translationX: tx, velocityX: vx} = event;
      let targetIndex = currentIndexSV.value;
      if (vx < -500 || tx < -SCREEN_WIDTH * 0.3) {
        targetIndex = currentIndexSV.value + 1;
      } else if (vx > 500 || tx > SCREEN_WIDTH * 0.3) {
        targetIndex = currentIndexSV.value - 1;
      }
      snapTo(targetIndex);
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(
          (currentIndexSV.value * SCREEN_WIDTH) / TAB_COUNT,
          {damping: 30, stiffness: 200, overshootClamping: true},
        ),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.row,
            {
              width: SCREEN_WIDTH * TAB_COUNT,
              height: '100%',
              paddingBottom: TAB_BAR_HEIGHT,
            },
            rowAnimStyle,
          ]}>
          {TABS.map(tab => {
            const Comp = tab.component;
            return (
              <View key={tab.name} style={{width: SCREEN_WIDTH, flex: 1}}>
                <Comp />
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>

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
                width: SCREEN_WIDTH / TAB_COUNT,
                backgroundColor: colors.primary,
              },
              indicatorAnimStyle,
            ]}
          />
        </View>

        {TABS.map((tab, i) => {
          const isActive = activeTab === i;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => runOnUI(snapTo)(i)}
              activeOpacity={0.7}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={24}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {color: isActive ? colors.primary : colors.textMuted},
                ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
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
    paddingVertical: 6,
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
