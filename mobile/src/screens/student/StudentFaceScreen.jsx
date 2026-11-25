import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function StudentFaceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [bioStatus, setBioStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/biometrics/status/');
      setBioStatus(res.data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConsent = async (action) => {
    setFeedback('');
    try {
      const res = await api.post('/biometrics/consent/', { action });
      setFeedback(res.data?.message || 'Biometric consent updated.');
      await loadStatus();
    } catch (err) {
      setFeedback(err.response?.data?.error || 'Could not update consent.');
    }
  };

  const handleEnrollCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    setFeedback('');
    try {
      const frames = [];
      for (let i = 0; i < 3; i += 1) {
        const pic = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.6,
          skipProcessing: true,
        });
        if (pic?.base64) {
          frames.push(`data:image/jpeg;base64,${pic.base64}`);
        }
        if (i < 2) await new Promise((r) => setTimeout(r, 400));
      }
      const res = await api.post('/biometrics/enroll/', { frames });
      setCameraOpen(false);
      setFeedback(res.data?.message || 'Facial biometric template enrolled securely.');
      await loadStatus();
    } catch (err) {
      setFeedback(
        err.response?.data?.error || 'Face capture failed. Ensure bright lighting and look straight.'
      );
    } finally {
      setCapturing(false);
    }
  };

  if (cameraOpen) {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.safe} edges={['top']}>
          <RoleHeader title="Face Enrollment" subtitle="Camera Permission" />
          <View style={styles.centerBox}>
            <Text style={styles.title}>Allow Camera Access</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCameraOpen(false)}>
              <Text style={styles.btnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <RoleHeader title="Face Enrollment" subtitle="Position face inside frame" />
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        <View style={styles.overlayBar}>
          <Text style={styles.title}>Align your face in good lighting</Text>
          {feedback ? <Text style={styles.errText}>{feedback}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCameraOpen(false)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={handleEnrollCapture}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnText}>Capture & Enroll Face</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="Facial Registration" subtitle="Biometric Consent & Enrollment" />
      <OfflineBanner />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.tag}>CURRENT STATUS</Text>
              <Text style={styles.statusValue}>{bioStatus?.enrollment_status || 'NOT_ENROLLED'}</Text>
              <Text style={styles.desc}>
                Consent Active: {bioStatus?.has_active_consent ? 'Yes' : 'No'} • Liveness:{' '}
                {bioStatus?.liveness_enabled ? 'Enabled' : 'Standard'}
              </Text>
            </View>

            {feedback ? (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}

            {!bioStatus?.has_active_consent ? (
              <View style={styles.card}>
                <Text style={styles.title}>Informed Biometric Consent</Text>
                <Text style={styles.desc}>
                  AttendX generates an encrypted facial template on the university server solely for
                  classroom attendance verification. Raw photos are not stored.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleConsent('CONSENT')}>
                  <Text style={styles.btnText}>Give Consent & Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setCameraOpen(true)}
                >
                  <Ionicons name="camera" size={18} color={COLORS.white} />
                  <Text style={styles.btnText}>
                    {bioStatus?.enrollment_status === 'ENROLLED'
                      ? 'Update / Re-Enroll Face'
                      : 'Open Camera to Register Face'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dangerOutlineBtn}
                  onPress={() =>
                    Alert.alert(
                      'Revoke Consent',
                      'This permanently deletes your encrypted facial template.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Revoke', style: 'destructive', onPress: () => handleConsent('REVOKE') },
                      ]
                    )
                  }
                >
                  <Text style={styles.dangerText}>Revoke Consent & Delete Template</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  card: {
    backgroundColor: COLORS.deepBlue,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  tag: { color: COLORS.skyBlue, fontSize: 11, fontWeight: '800' },
  statusValue: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  title: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    backgroundColor: COLORS.royalBlue,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  btnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  dangerOutlineBtn: {
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.5)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerText: { color: COLORS.softRed, fontSize: 13, fontWeight: '700' },
  overlayBar: { backgroundColor: COLORS.deepBlue, padding: 18, borderTopWidth: 1, borderTopColor: COLORS.border },
  errText: { color: COLORS.softRed, fontSize: 12.5, marginTop: 4 },
  feedbackBox: {
    backgroundColor: 'rgba(29, 78, 216, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.royalBlue,
    borderRadius: 12,
    padding: 12,
  },
  feedbackText: { color: COLORS.white, fontSize: 13 },
});

