import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { registerForPushNotificationsAsync } from '../../services/pushNotifications';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function NotificationsScreen() {
  const [tab, setTab] = useState('inbox');
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [nRes, aRes, pRes] = await Promise.all([
        api.get('/notifications/'),
        api.get('/notifications/announcements/'),
        api.get('/notifications/preferences/'),
      ]);
      setNotifications(nRes.data?.notifications || []);
      setUnreadCount(nRes.data?.unread_count || 0);
      setAnnouncements(aRes.data || []);
      setPrefs(pRes.data || null);
    } catch {
      // Keep existing state if offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const togglePref = async (key, val) => {
    setPrefs((p) => ({ ...p, [key]: val }));
    try {
      await api.patch('/notifications/preferences/', { [key]: val });
      if (key === 'push_enabled' && val) {
        registerForPushNotificationsAsync();
      }
    } catch {
      setPrefs((p) => ({ ...p, [key]: !val }));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Notifications & Alerts" subtitle={`${unreadCount} unread notifications`} />
      <OfflineBanner />

      <View style={styles.tabRow}>
        {[
          { id: 'inbox', label: `Inbox (${unreadCount})` },
          { id: 'announcements', label: 'Announcements' },
          { id: 'prefs', label: 'Preferences' },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
      ) : tab === 'inbox' ? (
        <FlatList
          data={notifications}
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
          ListHeaderComponent={
            unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
                <Ionicons name="checkmark-done" size={16} color={COLORS.skyBlue} />
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => !item.is_read && markRead(item.id)}
              style={[styles.card, !item.is_read && styles.unreadCard]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!item.is_read && <View style={styles.dot} />}
              </View>
              <Text style={styles.cardBody}>{item.message}</Text>
              <Text style={styles.cardMeta}>
                {item.category} • {new Date(item.created_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : tab === 'announcements' ? (
        <FlatList
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No announcements published.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.badge}>{item.category}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.message}</Text>
              <Text style={styles.cardMeta}>
                By {item.created_by_name || 'Administration'}
              </Text>
            </View>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {prefs &&
            [
              { key: 'push_enabled', label: 'Mobile Push Notifications' },
              { key: 'in_app_enabled', label: 'In-App Notifications' },
              { key: 'email_enabled', label: 'Email Alerts' },
              { key: 'attendance_alerts', label: 'Attendance & QR Alerts' },
              { key: 'announcements_enabled', label: 'University Announcements' },
              { key: 'system_updates', label: 'System & Timetable Updates' },
            ].map((item) => (
              <View key={item.key} style={styles.prefRow}>
                <Text style={styles.prefLabel}>{item.label}</Text>
                <Switch
                  value={Boolean(prefs[item.key])}
                  onValueChange={(v) => togglePref(item.key, v)}
                  trackColor={{ false: '#334155', true: COLORS.royalBlue }}
                  thumbColor={prefs[item.key] ? COLORS.white : '#94a3b8'}
                />
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  tabRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    backgroundColor: COLORS.deepBlue,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: { backgroundColor: COLORS.royalBlue },
  tabText: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  markAllText: { color: COLORS.skyBlue, fontSize: 12.5, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unreadCard: {
    borderColor: COLORS.royalBlue,
    backgroundColor: COLORS.cardBg,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: COLORS.white, fontSize: 14.5, fontWeight: '700', flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.uccRed },
  cardBody: { color: COLORS.textSecondary, fontSize: 13, marginTop: 5, lineHeight: 18 },
  cardMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 8 },
  badge: {
    alignSelf: 'flex-start',
    color: COLORS.softRed,
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  prefRow: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLabel: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
});

