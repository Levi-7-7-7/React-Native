import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tutorAxios from '../api/tutorAxios';
import {useTheme} from '../theme';

interface Student {
  _id: string;
  name: string;
  registerNumber: string;
  batch: string;
  branch: string;
  totalPoints: number;
}

export default function TutorStudentsScreen() {
  const {colors} = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      const res = await tutorAxios.get('/tutors/students');
      setStudents(res.data.students || res.data || []);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const filtered = students.filter(s =>
    search
      ? s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.registerNumber?.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const renderItem = ({item}: {item: Student}) => (
    <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
      <View style={styles.cardTop}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {item.name
              ?.split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.studentName, {color: colors.text}]}>{item.name}</Text>
          <Text style={[styles.regNo, {color: colors.textMuted}]}>
            {item.registerNumber}
          </Text>
        </View>
        <View style={[styles.pointsBadge, {backgroundColor: colors.primaryMuted}]}>
          <Text style={[styles.pointsText, {color: colors.primary}]}>
            {item.totalPoints ?? 0} pts
          </Text>
        </View>
      </View>
      <View style={[styles.cardFooter, {borderTopColor: colors.borderLight}]}>
        <View style={styles.metaItem}>
          <Icon name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.metaText, {color: colors.textMuted}]}>
            {item.batch || 'N/A'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="school-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.metaText, {color: colors.textMuted}]}>
            {item.branch || 'N/A'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.textMuted}]}>
          Loading students…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      {/* Search */}
      <View style={[styles.searchWrapper, {backgroundColor: colors.card, borderColor: colors.border}]}>
        <Icon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, {color: colors.text}]}
          placeholder="Search by name or reg. number…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.countText, {color: colors.textMuted}]}>
        {filtered.length} student{filtered.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="account-search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, {color: colors.textMuted}]}>
              {search ? 'No matching students found.' : 'No students yet.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingText: {fontSize: 14},
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchIcon: {marginRight: 8},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 2},
  countText: {fontSize: 12, fontWeight: '600', marginHorizontal: 16, marginBottom: 4},
  list: {paddingHorizontal: 12, paddingBottom: 16},
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10},
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSmallText: {color: '#fff', fontWeight: '700', fontSize: 13},
  cardInfo: {flex: 1},
  studentName: {fontSize: 14, fontWeight: '700'},
  regNo: {fontSize: 12, marginTop: 2},
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pointsText: {fontSize: 12, fontWeight: '700'},
  cardFooter: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 16,
  },
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12},
  empty: {alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12},
  emptyText: {fontSize: 14},
});
