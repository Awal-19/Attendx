import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function LecturerLiveQRScreen() {
  const route = useRoute();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(route.params?.courseId || '');
  const [session, setSession] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [records, setRecords] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (route.params?.courseId) {
      setSelectedCourseId(route.params.courseId);
    }
  }, [route.params?.courseId]);

  const loadCoursesAndActive = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/academics/courses/'),
        api.get('/attendance/sessions/?status=ACTIVE'),
      ]);
      const cList = cRes.data?.results || cRes.data || [];
      setCourses(cList);
      if (!selectedCourseId && cList.length > 0) {
        setSelectedCourseId(cList[0].id);
      }
      const activeList = sRes.data?.results || sRes.data || [];
      if (activeList.length > 0) {
        const active = activeList[0];
        setSession(active);
        setQrToken(active.active_qr_token || null);
        setSecondsLeft(active.active_qr_token?.seconds_remaining || 0);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    loadCoursesAndActive();
  }, [loadCoursesAndActive]);

  const refreshQR = useCallback(async (sessId) => {
    try {
      const res = await api.post(`/attendance/sessions/${sessId}/generate-qr/`, {});
      const tok = res.data?.qr_token;
      if (tok) {
        setQrToken(tok);
        setSecondsLeft(tok.seconds_remaining || 30);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchRecords = useCallback(async (sessId) => {
    try {
      const res = await api.get(`/attendance/sessions/${sessId}/records/`);
      setRecords(res.data?.records || res.data || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!session?.id || session.status !== 'ACTIVE') return undefined;
    fetchRecords(session.id);
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          refreshQR(session.id);
          fetchRecords(session.id);
          return session.qr_refresh_seconds || 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status, session?.qr_refresh_seconds, refreshQR, fetchRecords]);

  const startSession = async () => {
    if (!selectedCourseId) return;
    setBusy(true);
    try {
      const payload = {
        course: selectedCourseId,
        title: 'Mobile Live Lecture',
        duration_minutes: 60,
        qr_refresh_seconds: 30,
      };
      if (route.params?.scheduleId) {
        payload.schedule = route.params.scheduleId;
      }
      const res = await api.post('/attendance/sessions/', payload);
      setSession(res.data?.session);
      setQrToken(res.data?.qr_token || res.data?.session?.active_qr_token);
      setSecondsLeft(res.data?.qr_token?.seconds_remaining || 30);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not start session.');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!session?.id) return;
    setBusy(true);
    try {
      await api.post(`/attendance/sessions/${session.id}/close/`, {});
      setSession(null);
      setQrToken(null);
      setRecords([]);
    } catch {
      Alert.alert('Error', 'Could not close session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Live QR Projector" subtitle="Dynamic Rotating Attendance QR" />
      <OfflineBanner />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
        ) : session ? (
          <>
            <View style={styles.qrCard}>
              <Text style={styles.courseTag}>{session.course_code}</Text>
              <Text style={styles.sessionTitle}>{session.course_title}</Text>
              <Text style={styles.timerText}>Refreshing in {secondsLeft}s</Text>

              {qrToken?.qr_image_base64 ? (
                <View style={styles.qrFrame}>
                  <Image
                    source={{ uri: qrToken.qr_image_base64 }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <ActivityIndicator color={COLORS.royalBlue} style={{ marginVertical: 40 }} />
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => refreshQR(session.id)}
                >
                  <Ionicons name="refresh" size={16} color={COLORS.white} />
                  <Text style={styles.btnText}>Rotate QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={endSession} disabled={busy}>
                  <Ionicons name="stop-circle" size={16} color={COLORS.white} />
                  <Text style={styles.btnText}>End Session</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTag}>
                LIVE CHECK-INS ({records.length})
              </Text>
              {records.length === 0 ? (
                <Text style={styles.meta}>Waiting for students to scan & verify...</Text>
              ) : (
                records.map((r, idx) => (
                  <View key={r.id || idx} style={styles.recRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recName}>{r.student_name || r.student_email}</Text>
                      <Text style={styles.meta}>
                        {r.student_index || ''} • {r.verification_method || 'QR + FACE'}
                      </Text>
                    </View>
                    <Text style={styles.recStatus}>{r.status}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTag}>SELECT COURSE TO START</Text>
            {courses.map((c) => {
              const active = String(c.id) === String(selectedCourseId);
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourseId(c.id)}
                  style={[styles.coursePick, active && styles.coursePickActive]}
                >
                  <Text style={styles.courseTag}>{c.code}</Text>
                  <Text style={styles.recName}>{c.title}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.startBtn}
              onPress={startSession}
              disabled={busy || !selectedCourseId}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="radio" size={18} color={COLORS.white} />
                  <Text style={styles.btnText}>Start Live QR Session</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { padding: 14, gap: 14 },
  qrCard: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  courseTag: { color: COLORS.softRed, fontSize: 13, fontWeight: '800' },
  sessionTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  timerText: { color: COLORS.skyBlue, fontSize: 13, fontWeight: '700', marginTop: 6 },
  qrFrame: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 16,
    marginVertical: 16,
  },
  qrImage: { width: 230, height: 230 },
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  refreshBtn: {
    flex: 1,
    backgroundColor: COLORS.royalBlue,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  closeBtn: {
    flex: 1,
    backgroundColor: COLORS.uccRed,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sectionTag: { color: COLORS.skyBlue, fontSize: 11.5, fontWeight: '800' },
  coursePick: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coursePickActive: {
    borderColor: COLORS.uccRed,
    backgroundColor: COLORS.cardBg,
  },
  startBtn: {
    marginTop: 6,
    backgroundColor: COLORS.uccRed,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recName: { color: COLORS.white, fontSize: 13.5, fontWeight: '600' },
  meta: { color: COLORS.textSecondary, fontSize: 12 },
  recStatus: { color: COLORS.success, fontSize: 12, fontWeight: '800' },
});

