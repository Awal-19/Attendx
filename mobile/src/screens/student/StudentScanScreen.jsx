import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useNetwork } from '../../context/NetworkContext';
import RoleHeader from '../../components/RoleHeader';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../theme/colors';

export default function StudentScanScreen() {
  const { isConnected } = useNetwork();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [step, setStep] = useState('SCAN_QR'); // SCAN_QR | FACE_VERIFY | DONE | ERROR
  const [qrToken, setQrToken] = useState('');
  const [validationInfo, setValidationInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const resetFlow = () => {
    setStep('SCAN_QR');
    setQrToken('');
    setValidationInfo(null);
    setStatusMessage('');
    setBusy(false);
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (busy || step !== 'SCAN_QR' || !data) return;
    if (!isConnected) {
      setStep('ERROR');
      setStatusMessage('Offline: Attendance cannot be verified or recorded without an internet connection.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/attendance/scan/validate-qr/', { token: data });
      setQrToken(data);
      setValidationInfo(res.data);
      setStep('FACE_VERIFY');
    } catch (err) {
      setStep('ERROR');
      setStatusMessage(
        err.response?.data?.error || 'Invalid or expired QR code. Please scan the current classroom QR.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCaptureAndSubmit = async () => {
    if (busy || !cameraRef.current) return;
    if (!isConnected) {
      setStep('ERROR');
      setStatusMessage('Offline: Live backend verification is required.');
      return;
    }

    setBusy(true);
    try {
      const frames = [];
      for (let i = 0; i < 2; i += 1) {
        const pic = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.55,
          skipProcessing: true,
        });
        if (pic?.base64) {
          frames.push(`data:image/jpeg;base64,${pic.base64}`);
        }
        if (i === 0) await new Promise((r) => setTimeout(r, 450));
      }

      const res = await api.post('/attendance/scan/', {
        token: qrToken,
        frames,
        liveness_challenge: validationInfo?.liveness_challenge || 'HEAD_NOD',
        device_info: `AttendX-Mobile-${Platform.OS}`,
      });

      setStep('DONE');
      setStatusMessage(
        res.data?.message ||
          `Attendance confirmed for ${validationInfo?.session?.course_code || 'lecture'}.`
      );
    } catch (err) {
      setStep('ERROR');
      setStatusMessage(
        err.response?.data?.error ||
          'Facial verification failed. Ensure good lighting and face the camera directly.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <RoleHeader title="QR Attendance" subtitle="Camera Verification" />
        <ActivityIndicator color={COLORS.skyBlue} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <RoleHeader title="QR Attendance" subtitle="Camera Permission Required" />
        <View style={styles.centerBox}>
          <Ionicons name="camera-outline" size={54} color={COLORS.skyBlue} />
          <Text style={styles.title}>Camera Access Needed</Text>
          <Text style={styles.desc}>
            AttendX needs camera permission to scan the lecturer's dynamic QR code and verify your face.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.btnText}>Allow Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RoleHeader title="QR Attendance" subtitle="Dynamic QR + Face Verification" />
      <OfflineBanner />

      {step === 'SCAN_QR' && (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={busy ? undefined : handleBarcodeScanned}
          />
          <View style={styles.overlayBar}>
            <Text style={styles.overlayTitle}>
              {busy ? 'Validating QR Token...' : 'Point camera at classroom QR code'}
            </Text>
            <Text style={styles.overlaySub}>
              Ensure the full QR code is inside the frame.
            </Text>
          </View>
        </View>
      )}

      {step === 'FACE_VERIFY' && (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
          <View style={styles.overlayBar}>
            <Text style={styles.overlayTitle}>
              {validationInfo?.session?.course_code} • Facial Verification
            </Text>
            <Text style={styles.overlaySub}>
              {validationInfo?.liveness_instruction ||
                'Center your face in good lighting and tap Verify.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetFlow}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={handleCaptureAndSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>Verify Face & Mark Present</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {(step === 'DONE' || step === 'ERROR') && (
        <View style={styles.centerBox}>
          <Ionicons
            name={step === 'DONE' ? 'checkmark-circle' : 'alert-circle'}
            size={64}
            color={step === 'DONE' ? COLORS.success : COLORS.softRed}
          />
          <Text style={styles.title}>
            {step === 'DONE' ? 'Attendance Recorded' : 'Verification Failed'}
          </Text>
          <Text style={styles.desc}>{statusMessage}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={resetFlow}>
            <Text style={styles.btnText}>Scan Another QR</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: COLORS.white, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  desc: { color: COLORS.textSecondary, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  overlayBar: {
    backgroundColor: 'rgba(6, 20, 48, 0.94)',
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  overlayTitle: { color: COLORS.white, fontSize: 15.5, fontWeight: '700' },
  overlaySub: { color: COLORS.skyBlue, fontSize: 12.5, marginTop: 4 },
  primaryBtn: {
    backgroundColor: COLORS.uccRed,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});

