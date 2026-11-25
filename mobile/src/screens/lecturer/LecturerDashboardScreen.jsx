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
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function LecturerDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [summary, setSummary] = useState(null);
  const [nextLecture, setNextLecture] = useState(null);
  const [defaultersCount, setDefaultersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dRes, nRes, defRes] = await Promise.all([
        api.get('/lecturers/dashboard/'),
        api.get('/academics/timetable/next/'),
        api.get('/reports/defaulters/'),
      ]);
      setSummary(dRes.data);
      setNextLecture(nRes.data || null);
      const defs = defRes.data?.defaulters || defRes.data || [];
      setDefaultersCount(Array.isArray(defs) ? defs.length : 0);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = summary?.stats || summary || {};
  const courses = summary?.courses || [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader
        title="Lecturer Portal"
        subtitle={`${user?.full_name || ''} • Faculty`}
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={COLORS.skyBlue}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{courses.length || stats.assigned_courses_count || 0}</Text>
                <Text style={styles.statLbl}>Courses</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.total_sessions ?? 0}</Text>
                <Text style={styles.statLbl}>Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statVal, { color: COLORS.softRed }]}>{defaultersCount}</Text>
                <Text style={styles.statLbl}>Low Attendance</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.qrCta}
              onPress={() => navigation.navigate('LiveQR')}
            >
              <Ionicons name="qr-code-outline" size={26} color={COLORS.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Launch Dynamic QR Session</Text>
                <Text style={styles.ctaSub}>Generate rotating QR & monitor live check-ins</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {nextLecture && (
              <View style={styles.card}>
                <Text style={styles.tag}>NEXT TEACHING SLOT</Text>
                <Text style={styles.cardTitle}>
                  {nextLecture.course_code} — {nextLecture.course_title}
                </Text>
                <Text style={styles.meta}>
                  {nextLecture.day_of_week} • {String(nextLecture.start_time).slice(0, 5)} –{' '}
                  {String(nextLecture.end_time).slice(0, 5)}
                </Text>
                <Text style={styles.meta}>Venue: {nextLecture.venue_display}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.tag}>ASSIGNED COURSES</Text>
              {courses.length === 0 ? (
                <Text style={styles.meta}>No assigned courses found.</Text>
              ) : (
                courses.map((c) => (
                  <View key={c.id} style={styles.courseItem}>
                    <Text style={styles.courseCode}>{c.code}</Text>
                    <Text style={styles.courseTitle}>{c.title}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { padding: 14, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statVal: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  statLbl: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  qrCta: {
    backgroundColor: COLORS.uccRed,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaTitle: { color: COLORS.white, fontSize: 15.5, fontWeight: '800' },
  ctaSub: { color: '#fee2e2', fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  tag: { color: COLORS.skyBlue, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 12.5 },
  courseItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  courseCode: { color: COLORS.softRed, fontSize: 12.5, fontWeight: '800' },
  courseTitle: { color: COLORS.white, fontSize: 13.5, fontWeight: '600' },
});

