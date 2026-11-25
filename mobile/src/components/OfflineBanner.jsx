import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';
import { COLORS } from '../theme/colors';

export default function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  if (isConnected && isInternetReachable) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color={COLORS.white} />
      <Text style={styles.text}>
        Offline Mode • Cached schedule shown. Attendance scanning requires live server connection.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.uccRed,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});

