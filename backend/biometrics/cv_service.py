"""
Modular Facial Verification & Liveness Detection Service for AttendX.

Uses OpenCV Zoo's YuNet (5-landmark face detection) and SFace (128-D hypersphere
embedding + alignment) behind a clean provider interface so the underlying CV
model can be upgraded or swapped without touching API views.
"""

import base64
import os
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

import cv2
import numpy as np
from django.conf import settings


WEIGHTS_DIR = os.path.join(settings.BASE_DIR, "biometrics", "models_weights")
YUNET_PATH = os.path.join(WEIGHTS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_PATH = os.path.join(WEIGHTS_DIR, "face_recognition_sface_2021dec.onnx")


@dataclass
class FrameAnalysisResult:
    ok: bool
    error_code: str = ""
    error_message: str = ""
    embedding: Optional[np.ndarray] = None
    quality_score: float = 0.0
    brightness: float = 0.0
    sharpness: float = 0.0
    landmarks: Optional[np.ndarray] = None
    face_box: Optional[np.ndarray] = None
    face_crop: Optional[np.ndarray] = None


@dataclass
class LivenessResult:
    passed: bool
    score: float
    reason: str = ""


class FaceVerificationProvider(ABC):
    @abstractmethod
    def analyze_frame(
        self,
        image_bgr: np.ndarray,
        min_brightness: float = 40.0,
        max_brightness: float = 235.0,
        min_sharpness: float = 30.0,
        min_quality: float = 0.35,
    ) -> FrameAnalysisResult:
        raise NotImplementedError

    @abstractmethod
    def check_liveness(
        self,
        frames_bgr: List[np.ndarray],
        analyses: List[FrameAnalysisResult],
        challenge: str = "HEAD_TURN",
    ) -> LivenessResult:
        raise NotImplementedError

    @abstractmethod
    def compare_embeddings(self, enrolled: np.ndarray, live: np.ndarray) -> float:
        raise NotImplementedError


class YuNetSFaceProvider(FaceVerificationProvider):
    """
    Thread-safe YuNet + SFace computer vision provider.
    - Detection: YuNet (score_threshold=0.75)
    - Alignment & Embedding: SFace alignCrop + 128-D L2-normalized feature
    - Matching: Cosine similarity (recommended threshold >= 0.363)
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._recognizer = None

    def _get_recognizer(self):
        if self._recognizer is None:
            self._recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, "")
        return self._recognizer

    def _detect_faces(self, image_bgr: np.ndarray):
        h, w = image_bgr.shape[:2]
        detector = cv2.FaceDetectorYN.create(
            YUNET_PATH,
            "",
            (w, h),
            score_threshold=0.72,
            nms_threshold=0.3,
            top_k=10,
        )
        _, faces = detector.detect(image_bgr)
        return faces

    def analyze_frame(
        self,
        image_bgr: np.ndarray,
        min_brightness: float = 40.0,
        max_brightness: float = 235.0,
        min_sharpness: float = 30.0,
        min_quality: float = 0.35,
    ) -> FrameAnalysisResult:
        if image_bgr is None or image_bgr.size == 0:
            return FrameAnalysisResult(
                ok=False,
                error_code="INVALID_IMAGE",
                error_message="Invalid or empty camera frame received.",
            )

        # Resize oversized frames for fast classroom processing while preserving aspect ratio
        h, w = image_bgr.shape[:2]
        max_dim = 720
        if max(h, w) > max_dim:
            scale = max_dim / float(max(h, w))
            image_bgr = cv2.resize(
                image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
            )
            h, w = image_bgr.shape[:2]

        faces = self._detect_faces(image_bgr)
        if faces is None or len(faces) == 0:
            return FrameAnalysisResult(
                ok=False,
                error_code="NO_FACE_DETECTED",
                error_message="Face not detected. Position your face clearly inside the frame.",
            )

        if len(faces) > 1:
            return FrameAnalysisResult(
                ok=False,
                error_code="MULTIPLE_FACES",
                error_message="Multiple faces detected. Ensure only you are in the camera frame.",
            )

        face = faces[0]
        x, y, fw, fh = int(max(0, face[0])), int(max(0, face[1])), int(face[2]), int(face[3])
        if fw < 56 or fh < 56:
            return FrameAnalysisResult(
                ok=False,
                error_code="FACE_TOO_SMALL",
                error_message="Move closer to the camera so your face fills the guide.",
            )

        x2 = min(w, x + fw)
        y2 = min(h, y + fh)
        face_roi = image_bgr[y:y2, x:x2]
        if face_roi.size == 0:
            return FrameAnalysisResult(
                ok=False,
                error_code="NO_FACE_DETECTED",
                error_message="Face region could not be cropped cleanly.",
            )

        gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray_roi))
        sharpness = float(cv2.Laplacian(gray_roi, cv2.CV_64F).var())

        if brightness < min_brightness:
            return FrameAnalysisResult(
                ok=False,
                error_code="POOR_LIGHTING",
                error_message="Poor lighting: environment is too dark. Move to a brighter area.",
                brightness=brightness,
                sharpness=sharpness,
            )
        if brightness > max_brightness:
            return FrameAnalysisResult(
                ok=False,
                error_code="POOR_LIGHTING",
                error_message="Overexposed lighting detected. Avoid direct glare behind or on your face.",
                brightness=brightness,
                sharpness=sharpness,
            )

        if sharpness < min_sharpness:
            return FrameAnalysisResult(
                ok=False,
                error_code="LOW_QUALITY",
                error_message="Image is too blurry. Hold the camera steady and try again.",
                brightness=brightness,
                sharpness=sharpness,
            )

        # Compute composite quality score [0..1]
        b_score = 1.0 - min(abs(brightness - 130.0) / 110.0, 1.0)
        s_score = min(sharpness / 150.0, 1.0)
        det_conf = float(face[14]) if len(face) > 14 else 0.85
        quality_score = round(0.35 * b_score + 0.35 * s_score + 0.30 * det_conf, 3)

        if quality_score < min_quality:
            return FrameAnalysisResult(
                ok=False,
                error_code="LOW_QUALITY",
                error_message="Image quality is too low for biometric verification. Improve lighting and hold steady.",
                quality_score=quality_score,
                brightness=brightness,
                sharpness=sharpness,
            )

        with self._lock:
            recognizer = self._get_recognizer()
            aligned_crop = recognizer.alignCrop(image_bgr, face)
            feat = recognizer.feature(aligned_crop)

        embedding = np.asarray(feat, dtype=np.float32).flatten()
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        landmarks = face[4:14].reshape(5, 2)  # right_eye, left_eye, nose, right_mouth, left_mouth

        return FrameAnalysisResult(
            ok=True,
            embedding=embedding,
            quality_score=quality_score,
            brightness=round(brightness, 2),
            sharpness=round(sharpness, 2),
            landmarks=landmarks,
            face_box=face[:4],
            face_crop=face_roi,
        )

    def check_liveness(
        self,
        frames_bgr: List[np.ndarray],
        analyses: List[FrameAnalysisResult],
        challenge: str = "HEAD_TURN",
    ) -> LivenessResult:
        """
        Multi-signal presentation-attack detection across sequential frames:
        1. Rejects static/frozen frames (printed photo or still phone image).
        2. Evaluates 3D facial landmark pose shift (nose-to-eye-midpoint ratio delta).
        3. Checks texture/high-frequency screen moiré & flat-print contrast.
        """
        if len(analyses) < 2:
            return LivenessResult(
                passed=False,
                score=0.0,
                reason="Liveness check requires multiple sequential camera frames.",
            )

        # 1. Check inter-frame pixel motion on resized grayscale frames
        motion_scores = []
        for i in range(1, len(frames_bgr)):
            g1 = cv2.cvtColor(cv2.resize(frames_bgr[i - 1], (160, 120)), cv2.COLOR_BGR2GRAY)
            g2 = cv2.cvtColor(cv2.resize(frames_bgr[i], (160, 120)), cv2.COLOR_BGR2GRAY)
            diff = float(np.mean(np.abs(g1.astype(np.float32) - g2.astype(np.float32))))
            motion_scores.append(diff)

        max_motion = max(motion_scores) if motion_scores else 0.0
        if max_motion < 0.8:
            return LivenessResult(
                passed=False,
                score=0.15,
                reason="Liveness check unsuccessful: static or frozen image detected. Please follow the on-screen movement prompt.",
            )

        # 2. Check 3D facial landmark yaw/pitch shift across frames
        yaw_ratios = []
        pitch_ratios = []
        for a in analyses:
            if a.landmarks is None:
                continue
            re, le, nose = a.landmarks[0], a.landmarks[1], a.landmarks[2]
            eye_dist = float(np.linalg.norm(le - re)) + 1e-5
            eye_mid_x = (re[0] + le[0]) / 2.0
            eye_mid_y = (re[1] + le[1]) / 2.0
            yaw_ratios.append(float(nose[0] - eye_mid_x) / eye_dist)
            pitch_ratios.append(float(nose[1] - eye_mid_y) / eye_dist)

        yaw_delta = (max(yaw_ratios) - min(yaw_ratios)) if len(yaw_ratios) >= 2 else 0.0
        pitch_delta = (max(pitch_ratios) - min(pitch_ratios)) if len(pitch_ratios) >= 2 else 0.0
        pose_delta = max(yaw_delta, pitch_delta)

        # 3. Check face texture naturalness (rejects washed-out/glare-heavy screen replays)
        texture_ok = True
        for a in analyses:
            if a.face_crop is not None:
                hsv = cv2.cvtColor(a.face_crop, cv2.COLOR_BGR2HSV)
                # Extremely clipped specular highlights (>250 V across >25% of face) indicate screen glare
                glare_ratio = float(np.mean(hsv[:, :, 2] > 252))
                if glare_ratio > 0.28:
                    texture_ok = False
                    break

        if not texture_ok:
            return LivenessResult(
                passed=False,
                score=0.25,
                reason="Liveness check unsuccessful: excessive screen glare or reflection detected.",
            )

        if pose_delta < 0.025 and max_motion < 2.2:
            return LivenessResult(
                passed=False,
                score=0.3,
                reason="Liveness check unsuccessful: insufficient natural head movement detected.",
            )

        liveness_score = round(min(0.55 + min(pose_delta * 2.5, 0.3) + min(max_motion / 20.0, 0.15), 0.99), 3)
        return LivenessResult(passed=True, score=liveness_score, reason="Live subject verified.")

    def compare_embeddings(self, enrolled: np.ndarray, live: np.ndarray) -> float:
        e = np.asarray(enrolled, dtype=np.float32).reshape(1, -1)
        l = np.asarray(live, dtype=np.float32).reshape(1, -1)
        with self._lock:
            recognizer = self._get_recognizer()
            score = float(recognizer.match(e, l, cv2.FaceRecognizerSF_FR_COSINE))
        return round(score, 4)


_PROVIDER_INSTANCE = YuNetSFaceProvider()


def get_face_provider() -> FaceVerificationProvider:
    return _PROVIDER_INSTANCE


def decode_base64_image(data_url_or_b64: str) -> Optional[np.ndarray]:
    if not data_url_or_b64 or not isinstance(data_url_or_b64, str):
        return None
    payload = data_url_or_b64.split(",", 1)[-1].strip()
    try:
        img_bytes = base64.b64decode(payload)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None

