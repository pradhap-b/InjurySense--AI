export const getMediaDevices = () => navigator.mediaDevices;
export const stopStream = (stream) => stream?.getTracks().forEach((track) => track.stop());
export const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
export const getPermissionState = async (name) => {
  try { return (await navigator.permissions?.query({ name })).state; } catch { return 'unsupported'; }
};
