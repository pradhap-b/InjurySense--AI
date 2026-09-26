export function createAudioAnalyzer(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API is unsupported');
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  return {
    context, analyser, time, freq,
    sample() {
      analyser.getByteTimeDomainData(time); analyser.getByteFrequencyData(freq);
      let sum = 0; let crossings = 0;
      for (let i=0;i<time.length;i++) { const x=(time[i]-128)/128; sum += x*x; if (i>0 && (time[i-1]-128)*(time[i]-128)<0) crossings++; }
      let energy = 0; for (const v of freq) energy += v/255; energy /= freq.length;
      const rms = Math.sqrt(sum/time.length);
      return { rms, level: Math.min(100, Math.round(rms*230)), energy: Number(energy.toFixed(3)), zeroCrossings: crossings };
    },
    waveform() { analyser.getByteTimeDomainData(time); return Array.from(time); },
    frequencies() { analyser.getByteFrequencyData(freq); return Array.from(freq); },
    destroy() { source.disconnect(); analyser.disconnect(); context.close(); }
  };
}
