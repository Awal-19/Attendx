import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function StudentHistoryScreen() {
  const [records, setRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const [hRes, rRes] = await Promise.all([
        api.get('/students/history/'),
        api.get('/reports/attendance/'),
      ]);
      setRecords(hRes.data?.records || hRes.data || []);
      setCourses(rRes.data?.courses || rRes.data?.course_summaries || []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Attendance History" subtitle="Course Percentages & Records" />
      <OfflineBanner />

      {loading ? (
        <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item, idx) => String(item.id || idx)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadHistory();
              }}
              tintColor={COLORS.skyBlue}
            />
          }
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListHeaderComponent={
            courses.length > 0 ? (
              <View style={{ gap: 8, marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Course Breakdown</Text>
                {courses.map((c, idx) => {
                  const pct = Number(c.attendance_rate ?? c.percentage ?? 0);
                  return (
                    <View key={c.course_id || c.code || idx} style={styles.courseRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseCode}>{c.course_code || c.code}</Text>
                        <Text style={styles.courseName} numberOfLines={1}>
                          {c.course_title || c.title}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.pctText,
                          { color: pct < 75 ? COLORS.softRed : COLORS.success },
                        ]}
                      >
                        {pct.toFixed(1)}%
                      </Text>
                    </View>
                  );
                })}
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Lectures</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No attendance records yet.</Text>}
          renderItem={({ item }) => {
            const isPresent = item.status === 'PRESENT' || item.status === 'LATE';
            return (
              <View style={styles.recordCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.courseCode}>{item.course_code || item.session_course_code}</Text>
                  <Text
                    style={[
                      styles.statusPill,
                      isPresent ? styles.presentPill : styles.absentPill,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
                <Text style={styles.courseName}>{item.session_title || item.course_title}</Text>
                <Text style={styles.meta}>
                  {item.marked_at ? new Date(item.marked_at).toLocaleString() : item.date || ''}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  sectionTitle: { color: COLORS.skyBlue, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  courseRow: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseCode: { color: COLORS.softRed, fontSize: 13, fontWeight: '800' },
  courseName: { color: COLORS.white, fontSize: 13.5, fontWeight: '600', marginTop: 2 },
  pctText: { fontSize: 16, fontWeight: '800' },
  recordCard: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  presentPill: { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: COLORS.success },
  absentPill: { backgroundColor: 'rgba(220, 38, 38, 0.25)', color: COLORS.softRed },
  meta: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
});

