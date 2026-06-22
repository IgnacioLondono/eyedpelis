import { Capacitor } from '@capacitor/core';

export type DeviceProfile = 'web' | 'android-mobile' | 'android-tv';

const TV_UA = /Android TV|GoogleTV|CrKey|AFTB|AFTM|AFTT|AFTS|AFTN|SmartTV|BRAVIA|TiVo|Hidabroot/i;

export function isCapacitorApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function detectTv(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('tv')) return true;
  if (TV_UA.test(navigator.userAgent)) return true;
  // Android TV suele no tener touch y pantalla ancha
  if (/Android/i.test(navigator.userAgent) && !('ontouchstart' in window) && window.innerWidth >= 960) {
    return true;
  }
  return false;
}

export function getDeviceProfile(): DeviceProfile {
  if (detectTv()) return 'android-tv';
  if (Capacitor.getPlatform() === 'android') return 'android-mobile';
  if (/Android/i.test(navigator.userAgent) && window.innerWidth < 1024 && 'ontouchstart' in window) {
    return 'android-mobile';
  }
  return 'web';
}

export function isTv(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('tv-mode') || detectTv();
}

export function isAndroidMobile(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('android-mobile');
}

export function initDeviceMode(): DeviceProfile {
  const profile = getDeviceProfile();
  const root = document.documentElement;
  root.classList.remove('tv-mode', 'android-mobile', 'android-app');
  if (profile === 'android-tv') root.classList.add('tv-mode');
  if (profile === 'android-mobile') root.classList.add('android-mobile');
  if (isCapacitorApp()) root.classList.add('android-app');
  return profile;
}
