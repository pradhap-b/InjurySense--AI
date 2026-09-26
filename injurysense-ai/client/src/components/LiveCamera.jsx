import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Camera, Pause, Play, Save, Square, Target, Waves } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { usePose } from '../hooks/usePose';
import { apiRequest } from '../services/api';
import { analyzePose, createRepCounter } from '../services/biomechanics';

const connections = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

function drawSkeleton(canvas, landmarks) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.lineWidth = 3;
  context.strokeStyle = '#61d6ff';
  context.fillStyle = '#a78bfa';
  connections.forEach(([first, second]) => {
    const start = landmarks[first];
    const end = landmarks[second];
    if (!start || !end) return;
    context.beginPath();
    context.moveTo(start.x * canvas.width, start.y * canvas.height);
    context.lineTo(end.x * canvas.width, end.y * canvas.height);
    context.stroke();
  });
  landmarks.forEach(point => {
    if ((point.visibility ?? 0) < 0.35) return;
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2);
    context.fill();
  });
}

function Metric({ label, value, unit = '' }) {
  return <div className="metric"><div className="metric-icon"><Activity size={18} /></div><div><span>{label}</span><strong>{value}<small>{unit}</small></strong></div></div>;
}

export default function LiveCamera({ notify, setStatuses }) {
  const camera = useCamera();
  const pose = usePose(camera.videoRef, camera.state === 'ACTIVE');
  const canvasRef = useRef(null);
  const previousLandmarks = useRef(null);
  const previousTimestamp = useRef(null);
  const history = useRef([]);
  const repCounter = useRef(createRepCounter());
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [repState, setRepState] = useState({ state: 'STANDING', repetitions: 0 });
  const [startedAt, setStartedAt] = useState(null);

  useEffect(() => {
    setStatuses(status => ({ ...status, camera: camera.state, pose: pose.state }));
  }, [camera.state, pose.state, setStatuses]);

  useEffect(() => {
    const video = camera.videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;
    const resize = () => { canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; };
    resize();
    video.addEventListener('loadedmetadata', resize);
    return () => video.removeEventListener('loadedmetadata', resize);
  }, [camera.videoRef, camera.state]);

  useEffect(() => {
    if (!pose.landmarks || !running) return;
    const timestamp = performance.now();
    const nextMetrics = analyzePose(pose.landmarks, previousLandmarks.current, previousTimestamp.current, history.current);
    if (!nextMetrics || nextMetrics.confidence < 35) {
      drawSkeleton(canvasRef.current, null);
      return;
    }
    drawSkeleton(canvasRef.current, pose.landmarks);
    const nextRepState = repCounter.current(nextMetrics);
    history.current = [...history.current.slice(-89), { timestamp, velocity: nextMetrics.velocity, stability: nextMetrics.stability }];
    previousLandmarks.current = pose.landmarks;
    previousTimestamp.current = timestamp;
    setMetrics(nextMetrics);
    setRepState(nextRepState);
  }, [pose.landmarks, running]);

  const start = async () => {
    const stream = await camera.start();
    if (!stream) return;
    previousLandmarks.current = null;
    previousTimestamp.current = null;
    history.current = [];
    repCounter.current = createRepCounter();
    setRepState({ state: 'STANDING', repetitions: 0 });
    setMetrics(null);
    setStartedAt(Date.now());
    setRunning(true);
    notify('Real camera started');
  };

  const stop = () => {
    camera.stop();
    setRunning(false);
    drawSkeleton(canvasRef.current, null);
    notify('Camera stopped');
  };

  const pause = () => { camera.pause(); setRunning(false); };
  const resume = () => { camera.resume(); setRunning(true); };
  const save = async () => {
    if (!metrics || !startedAt) return notify('Start the camera and obtain pose data before saving.');
    try {
      await apiRequest('/sessions', { method: 'POST', body: JSON.stringify({
        activity: 'live-camera', exercise: metrics.exercise, startTime: new Date(startedAt).toISOString(), endTime: new Date().toISOString(),
        duration: Math.round((Date.now() - startedAt) / 1000), repetitions: repState.repetitions, symmetry: metrics.symmetry, stability: metrics.stability,
        poseMetrics: { leftKnee: metrics.leftKnee, rightKnee: metrics.rightKnee, leftHip: metrics.leftHip, rightHip: metrics.rightHip, confidence: metrics.confidence },
        motionMetrics: { velocity: metrics.velocity, acceleration: metrics.acceleration, intensity: metrics.intensity }, riskMetrics: { riskLevel: metrics.riskLevel, alignment: metrics.alignment }
      }) });
      notify('Session saved');
    } catch (error) { notify(error.message); }
  };

  const lowConfidence = pose.landmarks && (!metrics || metrics.confidence < 35);
  return <section className="page"><div className="section-intro"><span className="tag"><Camera size={14} /> REAL COMPUTER VISION</span><h2>Live Camera Analysis</h2><p>Local MediaPipe pose inference produces observations from your webcam. This is not a medical diagnosis.</p></div><div className="camera-layout"><div><div className="camera-card"><video ref={camera.videoRef} autoPlay muted playsInline /><canvas ref={canvasRef} className="landmark-canvas" /><div className="camera-status"><span className="dot" /><strong>Camera: {camera.state}</strong><span>Pose AI: {pose.state}</span>{camera.error && <><span>{camera.error}</span><button className="ghost small" onClick={start}>Retry</button></>}{pose.error && <span>{pose.error}</span>}</div></div>{lowConfidence && <div className="error-box"><AlertTriangle size={18} /><div><strong>No reliable body pose detected.</strong><p>Move into the camera frame.</p></div></div>}{pose.error && <div className="error-box"><AlertTriangle size={18} /><div><strong>Pose AI: ERROR</strong><p>Check model loading and retry the camera.</p><button className="ghost small" onClick={start}>Retry</button></div></div>}<div className="camera-actions"><button className="primary" onClick={camera.state === 'READY' || camera.state === 'ERROR' || camera.state === 'PERMISSION REQUIRED' ? start : stop}>{camera.state === 'ACTIVE' || camera.state === 'PAUSED' ? <><Square size={16} /> Stop</> : <><Play size={16} /> Start camera</>}</button><button className="ghost" disabled={camera.state !== 'ACTIVE' && camera.state !== 'PAUSED'} onClick={camera.state === 'ACTIVE' ? pause : resume}>{camera.state === 'ACTIVE' ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}</button><button className="ghost" onClick={save}><Save size={16} /> Save session</button></div></div><div className="side-stack"><div className="card"><div className="card-head"><div><h3>Live biomechanics</h3><span>Actual body landmarks only</span></div></div><Metric label="Pose confidence" value={metrics?.confidence ?? '—'} unit="%" /><Metric label="Left knee" value={metrics?.leftKnee ?? '—'} unit="°" /><Metric label="Right knee" value={metrics?.rightKnee ?? '—'} unit="°" /><Metric label="Left hip" value={metrics?.leftHip ?? '—'} unit="°" /><Metric label="Right hip" value={metrics?.rightHip ?? '—'} unit="°" /><Metric label="Symmetry" value={metrics?.symmetry ?? '—'} unit="%" /><Metric label="Stability" value={metrics?.stability ?? '—'} unit="%" /><Metric label="Movement intensity" value={metrics?.intensity ?? '—'} unit="%" /><div className="mini-row"><span>Exercise</span><b>{metrics?.exercise ?? 'WAITING'}</b></div><div className="mini-row"><span>Repetitions</span><b>{repState.repetitions}</b></div><div className="mini-row"><span>Rep state</span><b>{repState.state}</b></div><div className="mini-row"><span>Knee alignment</span><b>{metrics?.alignment ?? 'WAITING'}</b></div><div className="mini-row"><span>Risk level</span><b>{metrics?.riskLevel ?? 'WAITING'}</b></div></div><div className="privacy"><Waves size={18} /><div><strong>Possible movement concern</strong><p>Risk indicators reflect measured geometry and motion changes only. Stop activity for pain or serious symptoms.</p></div></div><div className="privacy"><Target size={18} /><div><strong>Session data stays local until saved</strong><p>Only the summary is sent to the authenticated session API. Video and frames are not uploaded.</p></div></div></div></div></section>;
}
