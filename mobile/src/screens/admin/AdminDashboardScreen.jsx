import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function AdminDashboardScreen() {
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAdmin = useCallback(async () => {
    try {
      const [oRes, dRes, pRes] = await Promise.all([
        api.get('/reports/admin-overview/'),
        api.get('/academics/departments/'),
        api.get('/academics/programmes/'),
      ]);
      setOverview(oRes.data);
      setDepartments(dRes.data?.results || dRes.data || []);
      setProgrammes(pRes.data?.results || pRes.data || []);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const stats = overview?.summary || overview || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Admin Overview" subtitle="University Attendance Monitoring" />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAdmin();
            }}
            tintColor={COLORS.skyBlue}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.total_students ?? 0}</Text>
                <Text style={styles.statLbl}>Students</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.total_lecturers ?? 0}</Text>
                <Text style={styles.statLbl}>Lecturers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.total_courses ?? 0}</Text>
                <Text style={styles.statLbl}>Courses</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statVal, { color: COLORS.skyBlue }]}>
                  {Number(stats.overall_attendance_rate ?? stats.attendance_rate ?? 0).toFixed(1)}%
                </Text>
                <Text style={styles.statLbl}>Attendance Rate</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.tag}>DEPARTMENTS ({departments.length})</Text>
              {departments.slice(0, 8).map((d) => (
                <View key={d.id} style={styles.rowItem}>
                  <Text style={styles.code}>{d.code}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {d.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.tag}>PROGRAMMES ({programmes.length})</Text>
              {programmes.slice(0, 8).map((p) => (
                <View key={p.id} style={styles.rowItem}>
                  <Text style={styles.code}>{p.code}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
              ))}
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statVal: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  statLbl: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  tag: { color: COLORS.skyBlue, fontSize: 11.5, fontWeight: '800' },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  code: { color: COLORS.softRed, fontSize: 12.5, fontWeight: '800', width: 70 },
  name: { color: COLORS.white, fontSize: 13.5, flex: 1 },
});

