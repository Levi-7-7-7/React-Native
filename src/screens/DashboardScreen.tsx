import React, {useEffect, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {SafeAreaView} from 'react-native-safe-area-context';
import axiosInstance from '../api/axiosInstance';
import {useAuth} from '../context/AuthContext';
import {calcCappedPoints, passThreshold} from '../utils/calcPoints';
import {useTheme} from '../theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {tabEmitter} from '../utils/tabEvents';

export default function DashboardScreen() {
  const {user, setUser, logout} = useAuth();
  const {colors, isDark} = useTheme();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [userRes, certRes, catRes] = await Promise.all([
        axiosInstance.get('/students/me'),
        axiosInstance.get('/certificates/my'),
        axiosInstance.get('/categories'),
      ]);
      setUser(userRes.data);
      setCertificates(certRes.data.certificates || []);
      setCategories(catRes.data.categories || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cappedTotal = useMemo(() => {
    if (!certificates.length || !categories.length) return 0;
    const approved = certificates.filter(
      c => c.status?.toLowerCase() === 'approved',
    );
    return calcCappedPoints(approved, categories, user?.isLateralEntry ?? false);
  }, [certificates, categories, user]);

  const PASS_POINTS = passThreshold(user?.isLateralEntry);
  const hasPassed = cappedTotal >= PASS_POINTS;
  const progressPct = Math.min(cappedTotal / PASS_POINTS, 1);

  const userName = user?.name || 'Student';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const recentActivities = certificates.slice(0, 5);

  const getActivityStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return {color: colors.badgeApprovedText};
      case 'pending':  return {color: colors.badgePendingText};
      case 'rejected': return {color: colors.badgeRejectedText};
      default:         return {color: colors.textMuted};
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScrollView
        style={[styles.container, {backgroundColor: colors.bg}]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {setRefreshing(true); fetchData();}}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarGroup}>
            <View style={[styles.avatar, {backgroundColor: colors.primary}]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={[styles.helloText, {color: colors.text}]}>Hello, {userName}</Text>
              <Text style={[styles.welcomeText, {color: colors.textMuted}]}>Welcome back!</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.logoutBtn, {backgroundColor: colors.cardDanger}]}
            onPress={() => logout()}>
            <Text style={[styles.logoutText, {color: colors.dangerText}]}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Points Card */}
        <View style={[styles.pointsCard, {backgroundColor: colors.cardBlue}]}>
          <View>
            <Text style={[styles.pointsLabel, {color: colors.pointsLabel}]}>Activity Points</Text>
            {loading ? (
              <ActivityIndicator color="#ca8a04" style={{marginTop: 6}} />
            ) : (
              <Text style={styles.pointsValue}>{cappedTotal}</Text>
            )}
            <Text style={[styles.pointsOf, {color: colors.pointsOf}]}>
              of {PASS_POINTS} required
            </Text>
          </View>
          <MaterialCommunityIcons
            name="trophy-outline"
            size={48}
            color={colors.primary}
          />
        </View>

        {/* Progress bar */}
        <View style={[styles.progressBg, {backgroundColor: colors.border}]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct * 100}%` as any,
                backgroundColor: hasPassed ? '#22c55e' : '#3b82f6',
              },
            ]}
          />
        </View>

        {/* Pass Banner */}
        {hasPassed && (
          <View style={[styles.passBanner, {backgroundColor: colors.cardSuccess}]}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={42}
              color={colors.success || '#22c55e'}
            />
            <View style={styles.passBannerText}>
              <Text style={[styles.passBannerTitle, {color: colors.badgeApprovedText}]}>
                Activity Points Completed!
              </Text>
              <Text style={[styles.passBannerSub, {color: isDark ? '#86efac' : '#15803d'}]}>
                You have successfully met the required activity points.
              </Text>
            </View>
            <View style={styles.passBadge}>
              <Text style={styles.passBadgeText}>PASSED</Text>
            </View>
          </View>
        )}

        {/* Recent Activities */}
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Recent Activities</Text>
        <View style={[styles.activitiesCard, {backgroundColor: colors.card}]}>
          {loading ? (
            [1, 2, 3].map(n => (
              <View key={n} style={styles.skeletonRow}>
                <View style={[styles.skeletonCircle, {backgroundColor: colors.skeleton}]} />
                <View style={[styles.skeletonLine, {backgroundColor: colors.skeleton}]} />
              </View>
            ))
          ) : recentActivities.length === 0 ? (
            <Text style={[styles.noData, {color: colors.textMuted}]}>
              No activity yet. Upload your first certificate!
            </Text>
          ) : (
            recentActivities.map((cert, idx) => (
              <View
                key={cert._id}
                style={[
                  styles.activityRow,
                  {borderBottomColor: colors.borderLight},
                  idx === recentActivities.length - 1 && {borderBottomWidth: 0},
                ]}>
                <View style={styles.activityLeft}>
                  <View style={[styles.activityDot, {backgroundColor: colors.primary}]} />
                  <View style={{flex: 1}}>
                    <Text
                      style={[styles.activityName, {color: colors.text}]}
                      numberOfLines={1}>
                      {cert.subcategory || cert.eventName || 'Certificate'}
                    </Text>
                    <View style={styles.dateRow}>
                      <MaterialCommunityIcons
                        name="calendar-month-outline"
                        size={14}
                        color={colors.textMuted}
                      />
                      <Text style={[styles.activityDate, {color: colors.textMuted}]}>
                        {cert.createdAt
                          ? new Date(cert.createdAt).toLocaleDateString()
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.activityStatus, getActivityStatusStyle(cert.status)]}>
                  {cert.status?.toLowerCase() === 'approved'
                    ? `+${cert.pointsAwarded ?? 0} pts`
                    : cert.status}
                </Text>
              </View>
            ))
          )}
          {!loading && certificates.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => tabEmitter.emit('switchTab', 1)}>
              <Text style={[styles.viewAllText, {color: colors.primary}]}>
                View All Certificates →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1},
  content: {padding: 20, paddingBottom: 100},
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  avatarGroup: {flexDirection: 'row', alignItems: 'center', gap: 12},
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontWeight: '800', fontSize: 16},
  helloText: {fontSize: 17, fontWeight: '700'},
  welcomeText: {fontSize: 13, marginTop: 1},
  logoutBtn: {borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8},
  logoutText: {fontSize: 13, fontWeight: '700'},
  pointsCard: {
    borderRadius: 20, padding: 22, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#1e3a8a', shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  pointsLabel: {fontSize: 13, fontWeight: '500', marginBottom: 4},
  pointsValue: {fontSize: 52, fontWeight: '800', color: '#fff'},
  pointsOf: {fontSize: 13, marginTop: 2},
  progressBg: {height: 6, borderRadius: 3, marginTop: 12, marginBottom: 14},
  progressFill: {height: 6, borderRadius: 3},
  passBanner: {
    borderRadius: 14, padding: 14, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  passBannerText: {flex: 1},
  passBannerTitle: {fontSize: 14, fontWeight: '800'},
  passBannerSub: {fontSize: 12, marginTop: 2},
  passBadge: {
    backgroundColor: '#16a34a', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  passBadgeText: {color: '#fff', fontWeight: '800', fontSize: 11},
  sectionTitle: {fontSize: 17, fontWeight: '700', marginBottom: 12},
  activitiesCard: {
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  skeletonRow: {flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 12},
  skeletonCircle: {width: 32, height: 32, borderRadius: 16},
  skeletonLine: {flex: 1, height: 14, borderRadius: 7},
  activityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
  },
  activityLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  activityDot: {width: 10, height: 10, borderRadius: 5},
  activityName: {fontSize: 14, fontWeight: '600'},
  activityDate: {fontSize: 12},
  activityStatus: {fontSize: 13, fontWeight: '700'},
  noData: {textAlign: 'center', padding: 20, fontSize: 14},
  viewAllBtn: {marginTop: 16, alignItems: 'center'},
  viewAllText: {fontWeight: '600', fontSize: 14},
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});
