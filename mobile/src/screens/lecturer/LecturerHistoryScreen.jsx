import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function LecturerHistoryScreen() {
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        api.get('/attendance/sessions/'),
        api.get('/reports/defaulters/'),
      ]);
      setSessions(sRes.data?.results || sRes.data || []);
      setDefaulters(dRes.data?.defaulters || dRes.data || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Attendance & Analytics" subtitle="Session History & Low Attendance" />
      <OfflineBanner />

      <View style={styles.tabRow}>
        {[
          { id: 'sessions', label: `Sessions (${sessions.length})` },
          { id: 'defaulters', label: `Low Attendance (${defaulters.length})` },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t.id && { color: COLORS.white }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
      ) : tab === 'sessions' ? (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
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
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No attendance sessions recorded.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.code}>{item.course_code}</Text>
                <Text style={styles.rate}>{Number(item.attendance_rate || 0).toFixed(1)}%</Text>
              </View>
              <Text style={styles.title}>{item.title || item.course_title}</Text>
              <Text style={styles.meta}>
                Present: {item.present_count ?? 0} / {item.enrolled_count ?? 0} • {item.status}
              </Text>
              <Text style={styles.meta}>
                {item.start_time ? new Date(item.start_time).toLocaleString() : ''}
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={defaulters}
          keyExtractor={(item, idx) => String(item.student_id || item.index_number || idx)}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No low-attendance alerts.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.student_name || item.full_name}</Text>
                <Text style={[styles.rate, { color: COLORS.softRed }]}>
                  {Number(item.attendance_rate ?? item.percentage ?? 0).toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.meta}>
                {item.index_number || ''} • {item.course_code || ''}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  tabRow: { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: COLORS.deepBlue },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: COLORS.royalBlue },
  tabText: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: COLORS.softRed, fontSize: 13, fontWeight: '800' },
  rate: { color: COLORS.success, fontSize: 15, fontWeight: '800' },
  title: { color: COLORS.white, fontSize: 14.5, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 12 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
});

