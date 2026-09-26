import { useCallback, useEffect, useRef, useState } from 'react';
import { stopStream } from '../services/browser';
const defaultVideo = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };

export function useCamera(constraints = { video: defaultVideo, audio: false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState('READY');
  const [error, setError] = useState('');
  const videoConstraints = typeof constraints.video === 'object' ? { ...defaultVideo, ...constraints.video } : defaultVideo;

  const start = useCallback(async () => {
    setError('');
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setState('ERROR');
      setError('Camera access requires HTTPS or localhost.');
      return null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('UNSUPPORTED');
      setError('Your browser does not support the required camera API.');
      return null;
    }
    try {
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('ACTIVE');
      return stream;
    } catch (cameraError) {
      const messages = {
        NotAllowedError: 'Camera permission denied. Allow camera access in your browser settings and press Retry.',
        NotFoundError: 'No compatible camera device detected.',
        NotReadableError: 'Camera is currently being used by another application.',
        OverconstrainedError: 'No compatible camera device detected.'
      };
      setError(messages[cameraError.name] || `Camera error: ${cameraError.message || cameraError.name}`);
      setState(cameraError.name === 'NotAllowedError' ? 'PERMISSION REQUIRED' : 'ERROR');
      return null;
    }
  }, [videoConstraints]);

  const pause = useCallback(() => { videoRef.current?.pause(); setState('PAUSED'); }, []);
  const resume = useCallback(async () => { await videoRef.current?.play().catch(() => {}); setState('ACTIVE'); }, []);
  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('READY');
  }, []);

  useEffect(() => () => stop(), [stop]);
  return { videoRef, stream: streamRef.current, state, error, start, pause, resume, stop };
}
