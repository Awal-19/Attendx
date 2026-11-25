import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getCachedData, setCachedData } from '../../services/storage';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const TODAY_IDX = [6, 0, 1, 2, 3, 4, 5][new Date().getDay()];

const fmtTime = (t) => (t ? String(t).slice(0, 5) : '--:--');

export default function TimetableScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [schedules, setSchedules] = useState([]);
  const [nextLecture, setNextLecture] = useState(null);
  const [mode, setMode] = useState('daily');
  const [selectedDay, setSelectedDay] = useState(DAYS[TODAY_IDX]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTimetable = useCallback(async () => {
    try {
      const [sRes, nRes] = await Promise.all([
        api.get('/academics/schedules/'),
        api.get('/academics/timetable/next/'),
      ]);
      const list = sRes.data || [];
      setSchedules(list);
      setNextLecture(nRes.data || null);
      await setCachedData(`timetable_${user?.id}`, { list, next: nRes.data || null });
    } catch {
      const cached = await getCachedData(`timetable_${user?.id}`);
      if (cached?.data) {
        setSchedules(cached.data.list || []);
        setNextLecture(cached.data.next || null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const visibleItems =
    mode === 'daily' ? schedules.filter((s) => s.day_of_week === selectedDay) : schedules;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Lecture Timetable" subtitle="Daily & Weekly Schedule" />
      <OfflineBanner />

      <View style={styles.modeRow}>
        {['daily', 'weekly'].map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, mode === m && { color: COLORS.white }]}>
              {m === 'daily' ? 'Daily View' : 'Weekly View'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'daily' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setSelectedDay(d)}
              style={[styles.dayPill, selectedDay === d && styles.dayPillActive]}
            >
              <Text style={[styles.dayText, selectedDay === d && { color: COLORS.white }]}>
                {d.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 14, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTimetable();
            }}
            tintColor={COLORS.skyBlue}
          />
        }
      >
        {nextLecture && (
          <View style={styles.nextCard}>
            <Text style={styles.nextTag}>NEXT UPCOMING LECTURE</Text>
            <Text style={styles.nextTitle}>
              {nextLecture.course_code} • {nextLecture.course_title}
            </Text>
            <Text style={styles.nextMeta}>
              {nextLecture.day_of_week} • {fmtTime(nextLecture.start_time)} - {fmtTime(nextLecture.end_time)}
            </Text>
            <Text style={styles.nextMeta}>
              Venue: {nextLecture.venue_display} • {nextLecture.lecturer_name}
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 30 }} />
        ) : visibleItems.length === 0 ? (
          <Text style={styles.empty}>No lectures scheduled for this view.</Text>
        ) : (
          visibleItems.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.courseCode}>{s.course_code}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    s.status === 'CANCELLED'
                      ? styles.statusCancelled
                      : s.status === 'RESCHEDULED'
                      ? styles.statusResched
                      : styles.statusScheduled,
                  ]}
                >
                  {s.status}
                </Text>
              </View>
              <Text style={styles.courseTitle}>{s.course_title}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.skyBlue} />
                <Text style={styles.metaText}>
                  {s.day_of_week} • {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.softRed} />
                <Text style={styles.metaText}>{s.venue_display}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{s.lecturer_name}</Text>
              </View>
              {user?.role === 'LECTURER' && s.status !== 'CANCELLED' && (
                <TouchableOpacity
                  style={styles.qrLaunchBtn}
                  onPress={() =>
                    navigation.navigate('LiveQR', {
                      courseId: s.course,
                      scheduleId: s.id,
                    })
                  }
                >
                  <Ionicons name="qr-code-outline" size={16} color={COLORS.white} />
                  <Text style={styles.qrLaunchText}>Start QR Attendance Session</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  modeRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.deepBlue },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: COLORS.royalBlue },
  modeText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  dayStrip: { maxHeight: 50, paddingVertical: 8 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.deepBlue,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayPillActive: { backgroundColor: COLORS.uccRed, borderColor: COLORS.uccRed },
  dayText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  nextCard: {
    backgroundColor: '#13316e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  nextTag: { color: '#fcd34d', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  nextTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginTop: 4 },
  nextMeta: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 3 },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 5,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseCode: { color: COLORS.softRed, fontSize: 13, fontWeight: '800' },
  statusBadge: { fontSize: 10.5, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusScheduled: { backgroundColor: 'rgba(29, 78, 216, 0.35)', color: COLORS.skyBlue },
  statusResched: { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fcd34d' },
  statusCancelled: { backgroundColor: 'rgba(220, 38, 38, 0.25)', color: COLORS.softRed },
  courseTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: COLORS.textSecondary, fontSize: 12.5 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 30 },
  qrLaunchBtn: {
    marginTop: 8,
    backgroundColor: COLORS.uccRed,
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qrLaunchText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
});

