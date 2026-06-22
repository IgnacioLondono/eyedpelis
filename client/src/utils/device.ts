const TV_UA = /Android TV|GoogleTV|CrKey|AFTB|AFTM|AFTT|SmartTV|BRAVIA/i;

export function detectTv(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('tv')) return true;
  return TV_UA.test(navigator.userAgent);
}

export function isTv(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('tv-mode') || detectTv();
}

export function initDeviceMode(): void {
  if (detectTv()) {
    document.documentElement.classList.add('tv-mode');
  }
}
