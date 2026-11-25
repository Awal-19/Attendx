import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { API_BASE_URL } from '../services/api';
import { COLORS } from '../theme/colors';

export default function LoginScreen() {
  const { signIn, sessionMessage, clearSessionMessage } = useAuth();
  const { isConnected } = useNetwork();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    clearSessionMessage();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your institutional email or index number and password.');
      return;
    }
    if (!isConnected) {
      setError('No internet connection. Connect to Wi-Fi or mobile data to sign in.');
      return;
    }
    setLoading(true);
    try {
      await signIn(identifier, password);
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.detail ||
          data?.error ||
          data?.non_field_errors?.[0] ||
          'Invalid credentials or server unreachable.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <View style={styles.crestBox}>
              <Image
                source={require('../../assets/ucc-official-crest.png')}
                style={styles.crest}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>AttendX • UCC</Text>
            <Text style={styles.brandSub}>University of Cape Coast Mobile Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSub}>
              Use your Student Index Number, Staff ID, or Institutional Email
            </Text>

            {(error || sessionMessage) ? (
              <View style={styles.alertBox}>
                <Ionicons name="alert-circle" size={18} color={COLORS.softRed} />
                <Text style={styles.alertText}>{error || sessionMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email / Index Number / Staff ID</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={COLORS.skyBlue} />
              <TextInput
                style={styles.input}
                placeholder="e.g. PS/CSC/22/0001 or user@ucc.edu.gh"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={setIdentifier}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.skyBlue} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Sign In Securely</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>
            Connected API: {API_BASE_URL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  crestBox: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.uccRed,
  },
  crest: {
    width: 60,
    height: 60,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '800',
  },
  brandSub: {
    color: COLORS.skyBlue,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  cardSub: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    marginTop: 4,
    marginBottom: 16,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  alertText: {
    color: COLORS.softRed,
    fontSize: 12.5,
    flex: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
  },
  loginBtn: {
    marginTop: 22,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.uccRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },
});

