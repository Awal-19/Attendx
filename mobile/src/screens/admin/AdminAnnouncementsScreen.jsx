import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function AdminAnnouncementsScreen() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('ALL_USERS');
  const [publishing, setPublishing] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/notifications/announcements/');
      setItems(res.data || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Required', 'Please enter a title and message.');
      return;
    }
    setPublishing(true);
    try {
      const created = await api.post('/notifications/announcements/', {
        title: title.trim(),
        message: message.trim(),
        target_type: targetType,
        category: 'ADMIN_MESSAGE',
      });
      await api.post(`/notifications/announcements/${created.data.id}/publish/`, {});
      setTitle('');
      setMessage('');
      Alert.alert('Published', 'Announcement dispatched to recipients.');
      loadList();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to publish announcement.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Announcements" subtitle="Publish University Alerts" />
      <OfflineBanner />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.tag}>NEW ANNOUNCEMENT</Text>
            <TextInput
              style={styles.input}
              placeholder="Announcement title..."
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Message body..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              value={message}
              onChangeText={setMessage}
            />
            <View style={styles.targetRow}>
              {[
                { id: 'ALL_USERS', label: 'All' },
                { id: 'ALL_STUDENTS', label: 'Students' },
                { id: 'ALL_LECTURERS', label: 'Lecturers' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTargetType(t.id)}
                  style={[styles.pill, targetType === t.id && styles.pillActive]}
                >
                  <Text style={styles.pillText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.pubBtn} onPress={handlePublish} disabled={publishing}>
              {publishing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.pubText}>Publish Now</Text>
              )}
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.badge}>{item.target_type}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.message}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  formCard: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    marginBottom: 8,
  },
  tag: { color: COLORS.skyBlue, fontSize: 11.5, fontWeight: '800' },
  input: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
    padding: 10,
    fontSize: 13.5,
  },
  targetRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.royalBlue, borderColor: COLORS.royalBlue },
  pillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  pubBtn: {
    backgroundColor: COLORS.uccRed,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pubText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: { color: COLORS.softRed, fontSize: 11, fontWeight: '800' },
  status: { color: COLORS.skyBlue, fontSize: 11, fontWeight: '700' },
  itemTitle: { color: COLORS.white, fontSize: 14.5, fontWeight: '700' },
  itemBody: { color: COLORS.textSecondary, fontSize: 12.5 },
});

