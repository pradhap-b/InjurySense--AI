const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateAngle(first, vertex, last) {
  if (!first || !vertex || !last) return null;
  const a = { x: first.x - vertex.x, y: first.y - vertex.y };
  const b = { x: last.x - vertex.x, y: last.y - vertex.y };
  const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (!denominator) return null;
  return Math.round(Math.acos(clamp((a.x * b.x + a.y * b.y) / denominator, -1, 1)) * 180 / Math.PI);
}

const average = values => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const pointDistance = (first, second) => first && second ? Math.hypot(first.x - second.x, first.y - second.y) : null;

export function analyzePose(landmarks, previous, previousTimestamp, history = []) {
  if (!landmarks?.length) return null;
  const requiredLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  if (requiredLandmarks.some(index => !landmarks[index])) return null;
  const leftKnee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
  const rightKnee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
  const leftHip = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
  const rightHip = calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
  const leftElbow = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
  const rightElbow = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
  const shoulderWidth = pointDistance(landmarks[11], landmarks[12]);
  const kneeDifference = Math.abs((leftKnee ?? 180) - (rightKnee ?? 180));
  const hipDifference = Math.abs((leftHip ?? 180) - (rightHip ?? 180));
  const shoulderDifference = shoulderWidth ? Math.abs(landmarks[11].y - landmarks[12].y) / shoulderWidth * 100 : 100;
  const symmetry = Math.round(clamp(100 - kneeDifference * 0.55 - hipDifference * 0.3 - shoulderDifference * 0.15, 0, 100));
  const confidence = Math.round(average(landmarks.map(point => point.visibility ?? point.presence ?? 0)) * 100);
  const now = performance.now();
  const deltaSeconds = previousTimestamp ? Math.max((now - previousTimestamp) / 1000, 0.001) : null;
  const displacement = previous ? average([11, 12, 23, 24, 25, 26, 27, 28].map(index => pointDistance(landmarks[index], previous[index]))) : null;
  const velocity = displacement !== null && deltaSeconds ? displacement / deltaSeconds : 0;
  const recentVelocity = history.at(-1)?.velocity ?? 0;
  const acceleration = deltaSeconds ? Math.abs(velocity - recentVelocity) / deltaSeconds : 0;
  const intensity = Math.round(clamp(velocity * 180, 0, 100));
  const stability = Math.round(clamp(100 - velocity * 75 - acceleration * 8, 0, 100));
  const kneeAlignment = average([
    Math.abs(landmarks[25].x - landmarks[23].x) / Math.max(0.01, Math.abs(landmarks[27].x - landmarks[23].x)),
    Math.abs(landmarks[26].x - landmarks[24].x) / Math.max(0.01, Math.abs(landmarks[28].x - landmarks[24].x))
  ]);
  const alignment = kneeAlignment !== null && kneeAlignment < 2.5 ? (symmetry >= 82 ? 'GOOD' : 'MODERATE') : 'NEEDS ATTENTION';
  const plankAlignment = calculateAngle(landmarks[11], landmarks[23], landmarks[27]);
  const squatScore = clamp((180 - average([leftKnee, rightKnee])) / 75, 0, 1);
  const plankScore = plankAlignment === null ? 0 : clamp(1 - Math.abs(180 - plankAlignment) / 35, 0, 1);
  const pushUpScore = average([leftElbow, rightElbow]) !== null ? clamp((150 - average([leftElbow, rightElbow])) / 80, 0, 1) : 0;
  const exercise = squatScore > 0.45 ? 'SQUAT' : pushUpScore > 0.45 && Math.abs(landmarks[11].y - landmarks[23].y) < 0.18 ? 'PUSH-UP' : plankScore > 0.7 ? 'PLANK' : 'STANDING';
  const riskScore = Math.max((100 - symmetry) * 0.55, 0) + Math.max(50 - stability, 0) * 0.3 + Math.min(acceleration * 8, 30) + (alignment === 'NEEDS ATTENTION' ? 20 : 0);
  const riskLevel = riskScore >= 55 ? 'HIGH' : riskScore >= 28 ? 'MODERATE' : 'LOW';
  return { leftKnee, rightKnee, leftHip, rightHip, leftElbow, rightElbow, symmetry, confidence, velocity, acceleration, intensity, stability, alignment, plankAlignment, exercise, exerciseConfidence: Math.round(Math.max(squatScore, plankScore, pushUpScore) * 100), riskLevel, riskScore: Math.round(riskScore) };
}

export function createRepCounter() {
  let state = 'STANDING';
  let repetitions = 0;
  return metrics => {
    if (!metrics) return { state, repetitions };
    const knee = average([metrics.leftKnee, metrics.rightKnee]) ?? 180;
    if (metrics.exercise === 'SQUAT') {
      if (state === 'STANDING' && knee < 155) state = 'DESCENDING';
      else if (state === 'DESCENDING' && knee < 115) state = 'BOTTOM';
      else if (state === 'BOTTOM' && knee > 125) state = 'ASCENDING';
      else if (state === 'ASCENDING' && knee > 160) { state = 'STANDING'; repetitions += 1; }
    } else if (metrics.exercise === 'PUSH-UP') {
      if (state === 'STANDING' && (metrics.leftElbow ?? 180) < 145) state = 'DESCENDING';
      else if (state === 'DESCENDING' && (metrics.leftElbow ?? 180) < 95) state = 'BOTTOM';
      else if (state === 'BOTTOM' && (metrics.leftElbow ?? 0) > 120) state = 'ASCENDING';
      else if (state === 'ASCENDING' && (metrics.leftElbow ?? 0) > 155) { state = 'STANDING'; repetitions += 1; }
    } else if (state !== 'STANDING') state = 'STANDING';
    return { state, repetitions };
  };
}
