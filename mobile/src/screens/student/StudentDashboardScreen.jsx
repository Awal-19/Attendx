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

export default function StudentDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [summary, setSummary] = useState(null);
  const [nextLecture, setNextLecture] = useState(null);
  const [bioStatus, setBioStatus] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [dRes, nRes, bRes, notifRes] = await Promise.all([
        api.get('/students/dashboard/'),
        api.get('/academics/timetable/next/'),
        api.get('/biometrics/status/'),
        api.get('/notifications/?limit=3'),
      ]);
      setSummary(dRes.data);
      setNextLecture(nRes.data || null);
      setBioStatus(bRes.data);
      setNotifs(notifRes.data?.notifications || []);
      await setCachedData(`student_dash_${user?.id}`, {
        summary: dRes.data,
        next: nRes.data || null,
        bio: bRes.data,
        notifs: notifRes.data?.notifications || [],
      });
    } catch {
      const cached = await getCachedData(`student_dash_${user?.id}`);
      if (cached?.data) {
        setSummary(cached.data.summary);
        setNextLecture(cached.data.next);
        setBioStatus(cached.data.bio);
        setNotifs(cached.data.notifs || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = summary?.stats || summary || {};
  const rate = stats.attendance_rate ?? stats.overall_attendance_percentage ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader
        title="Student Portal"
        subtitle={
          user?.student_profile?.index_number
            ? `${user.full_name} • ${user.student_profile.index_number}`
            : user?.full_name
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboard();
            }}
            tintColor={COLORS.skyBlue}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Biometric Face Status Alert */}
            {bioStatus && bioStatus.enrollment_status !== 'ENROLLED' && (
              <TouchableOpacity
                style={styles.bioAlert}
                onPress={() => navigation.navigate('FaceID')}
              >
                <Ionicons name="scan-circle" size={24} color="#fcd34d" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bioTitle}>Facial Registration Required</Text>
                  <Text style={styles.bioSub}>
                    Tap to enroll your face before scanning classroom QR codes.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fcd34d" />
              </TouchableOpacity>
            )}

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Number(rate).toFixed(1)}%</Text>
                <Text style={styles.statLabel}>Attendance Rate</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {stats.enrolled_courses_count ?? summary?.courses?.length ?? 0}
                </Text>
                <Text style={styles.statLabel}>Enrolled Courses</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.softRed }]}>
                  {stats.attended_sessions ?? stats.total_present ?? 0}
                </Text>
                <Text style={styles.statLabel}>Classes Attended</Text>
              </View>
            </View>

            {/* Primary Scan Action */}
            <TouchableOpacity
              style={styles.scanCta}
              onPress={() => navigation.navigate('ScanQR')}
            >
              <Ionicons name="qr-code" size={26} color={COLORS.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scanCtaTitle}>Scan Classroom QR & Verify Face</Text>
                <Text style={styles.scanCtaSub}>Mark live lecture attendance securely</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {/* Next Lecture */}
            {nextLecture && (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('Timetable')}
              >
                <Text style={styles.sectionTag}>NEXT LECTURE</Text>
                <Text style={styles.cardTitle}>
                  {nextLecture.course_code} — {nextLecture.course_title}
                </Text>
                <Text style={styles.cardMeta}>
                  {nextLecture.day_of_week} • {String(nextLecture.start_time).slice(0, 5)} –{' '}
                  {String(nextLecture.end_time).slice(0, 5)}
                </Text>
                <Text style={styles.cardMeta}>
                  Venue: {nextLecture.venue_display} • {nextLecture.lecturer_name}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recent Notifications */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTag}>RECENT NOTIFICATIONS</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
                  <Text style={styles.linkText}>View All</Text>
                </TouchableOpacity>
              </View>
              {notifs.length === 0 ? (
                <Text style={styles.cardMeta}>No recent notifications.</Text>
              ) : (
                notifs.map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {n.message}
                    </Text>
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
  bioAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 14,
    padding: 12,
  },
  bioTitle: { color: '#fcd34d', fontSize: 13.5, fontWeight: '700' },
  bioSub: { color: '#fef3c7', fontSize: 12, marginTop: 2 },
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
  statValue: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3, textAlign: 'center' },
  scanCta: {
    backgroundColor: COLORS.uccRed,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanCtaTitle: { color: COLORS.white, fontSize: 15.5, fontWeight: '800' },
  scanCtaSub: { color: '#fee2e2', fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  sectionTag: { color: COLORS.skyBlue, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  cardTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: COLORS.textSecondary, fontSize: 12.5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: COLORS.skyBlue, fontSize: 12.5, fontWeight: '600' },
  notifItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  notifTitle: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  notifBody: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
});

