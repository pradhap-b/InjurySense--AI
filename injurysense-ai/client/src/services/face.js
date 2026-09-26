let faceLandmarker = null;
let loading = null;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
export async function loadFaceLandmarker() {
  if (window.location.protocol === 'file:') {
    throw new Error('INTERNET REQUIRED: Eye analysis needs face model assets that are unavailable in offline file mode.')
  }
  if (faceLandmarker) return faceLandmarker;
  if (loading) return loading;
  loading = import('@mediapipe/tasks-vision').then(async ({ FilesetResolver, FaceLandmarker }) => {
    const vision = await FilesetResolver.forVisionTasks(new URL('./wasm/', window.location.href).href);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return faceLandmarker;
  }).finally(() => { loading = null; });
  return loading;
}
