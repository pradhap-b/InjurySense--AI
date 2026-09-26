let poseLandmarker = null;
let loading = null;

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_NAMES = ['nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye','right_eye_outer','left_ear','right_ear','mouth_left','mouth_right','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle','left_heel','right_heel','left_foot_index','right_foot_index'];

export async function loadPoseLandmarker() {
  if (window.location.protocol === 'file:') {
    throw new Error('INTERNET REQUIRED: Live pose analysis needs model assets that are unavailable in offline file mode.')
  }
  if (poseLandmarker) return poseLandmarker;
  if (loading) return loading;
  loading = import('@mediapipe/tasks-vision').then(async ({ FilesetResolver, PoseLandmarker }) => {
    const vision = await FilesetResolver.forVisionTasks(new URL('./wasm/', window.location.href).href);
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    return poseLandmarker;
  }).finally(() => { loading = null; });
  return loading;
}
