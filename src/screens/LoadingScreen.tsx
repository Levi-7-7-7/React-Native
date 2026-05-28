import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  useColorScheme,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

const MESSAGES: {text: string; sub: string}[] = [
  {text: 'Starting up…',             sub: 'Connecting to the server'},
  {text: 'Almost there…',            sub: 'The server is waking up, hang tight'},
  {text: 'Still loading…',           sub: 'Cold starts can take up to 40 seconds'},
  {text: 'Just a few more seconds…', sub: 'The server was sleeping — it\'s booting now'},
  {text: 'Thanks for waiting!',      sub: 'This only happens after a period of inactivity'},
];

const MSG_INTERVAL = 7000;
const FADE_DURATION = 500;

export default function LoadingScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const bg       = isDark ? '#0f172a' : '#f0f4ff';
  const card     = isDark ? '#1e293b' : '#ffffff';
  const primary  = isDark ? '#60a5fa' : '#1e3a8a';
  const textMain = isDark ? '#f1f5f9' : '#111827';
  const textSub  = isDark ? '#94a3b8' : '#6b7280';
  const dotColor = isDark ? '#334155' : '#e5e7eb';

  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim    = useRef(new Animated.Value(1)).current;
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const cardScale   = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Track whether the component is still mounted to stop animation loops
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Card entrance
    Animated.parallel([
      Animated.spring(cardScale,   {toValue: 1, friction: 7, tension: 80, useNativeDriver: true}),
      Animated.timing(cardOpacity, {toValue: 1, duration: 450, useNativeDriver: true}),
    ]).start();

    // Pulse ring loop — stopped when unmounted
    const pulse = () => {
      if (!mounted.current) {return;}
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.55, duration: 900, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1,    duration: 900, useNativeDriver: true}),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {toValue: 0,    duration: 900, useNativeDriver: true}),
          Animated.timing(pulseOpacity, {toValue: 0.35, duration: 900, useNativeDriver: true}),
        ]),
      ]).start(({finished}) => {
        if (finished && mounted.current) {pulse();}
      });
    };
    pulse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (MESSAGES.length <= 1) {return;}
    const timer = setInterval(() => {
      if (!mounted.current) {return;}
      Animated.parallel([
        Animated.timing(fadeAnim,  {toValue: 0,  duration: FADE_DURATION, useNativeDriver: true}),
        Animated.timing(slideAnim, {toValue: -8, duration: FADE_DURATION, useNativeDriver: true}),
      ]).start(() => {
        if (!mounted.current) {return;}
        setMsgIndex(prev => (prev + 1 < MESSAGES.length ? prev + 1 : prev));
        slideAnim.setValue(8);
        Animated.parallel([
          Animated.timing(fadeAnim,  {toValue: 1, duration: FADE_DURATION, useNativeDriver: true}),
          Animated.timing(slideAnim, {toValue: 0, duration: FADE_DURATION, useNativeDriver: true}),
        ]).start();
      });
    }, MSG_INTERVAL);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const msg = MESSAGES[msgIndex];

  return (
    <SafeAreaView style={[styles.root, {backgroundColor: bg}]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: card,
            opacity: cardOpacity,
            transform: [{scale: cardScale}],
            shadowColor: isDark ? '#000' : '#1e3a8a',
          },
        ]}>

        <View style={styles.lottiePulseWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              {borderColor: primary, opacity: pulseOpacity, transform: [{scale: pulseAnim}]},
            ]}
          />
          <LottieView
            source={require('../assets/animations/loading_dots.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        <Text style={[styles.appName, {color: primary}]}>Activity Points</Text>
        <Text style={[styles.appTagline, {color: textSub}]}>Management System</Text>
        <View style={[styles.divider, {backgroundColor: dotColor}]} />

        <Animated.View style={{opacity: fadeAnim, transform: [{translateY: slideAnim}], alignItems: 'center'}}>
          <Text style={[styles.msgTitle, {color: textMain}]}>{msg.text}</Text>
          <Text style={[styles.msgSub,   {color: textSub}]}>{msg.sub}</Text>
        </Animated.View>

        <View style={styles.dotsRow}>
          {MESSAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === msgIndex ? primary : dotColor,
                  width:  i === msgIndex ? 18 : 7,
                  opacity: i === msgIndex ? 1 : 0.5,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28},
  card: {width: '100%', borderRadius: 24, alignItems: 'center', paddingTop: 36, paddingBottom: 28, paddingHorizontal: 24, shadowOffset: {width: 0, height: 8}, shadowOpacity: 0.1, shadowRadius: 24, elevation: 10},
  lottiePulseWrapper: {width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 8},
  pulseRing: {position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2},
  lottie: {width: 120, height: 50},
  appName: {fontSize: 22, fontWeight: '800', letterSpacing: 0.3, marginTop: 4},
  appTagline: {fontSize: 13, fontWeight: '500', letterSpacing: 1.4, marginTop: 3, textTransform: 'uppercase'},
  divider: {width: 36, height: 3, borderRadius: 2, marginVertical: 20, opacity: 0.5},
  msgTitle: {fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6},
  msgSub: {fontSize: 13, fontWeight: '400', textAlign: 'center', lineHeight: 19, maxWidth: 240},
  dotsRow: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 22},
  dot: {height: 7, borderRadius: 4},
});
