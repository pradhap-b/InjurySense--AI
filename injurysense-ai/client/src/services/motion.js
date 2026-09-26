export function motionPermissionNeeded() {
  return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
}
export async function requestMotionPermission() {
  if (!motionPermissionNeeded()) return 'granted';
  try { return await DeviceMotionEvent.requestPermission(); } catch { return 'denied'; }
}
export function vectorMagnitude(v={x:0,y:0,z:0}) { return Math.sqrt((v.x||0)**2+(v.y||0)**2+(v.z||0)**2); }
