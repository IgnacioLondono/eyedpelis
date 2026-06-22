import type { ScanResult } from './scanner.js';

export type ScanPhase = 'idle' | 'indexing' | 'enriching' | 'done';

export interface ScanStatus {
  running: boolean;
  phase: ScanPhase;
  current: number;
  total: number;
  message: string;
  result: ScanResult | null;
  enrichCount: number;
  error: string | null;
}

const idle: ScanStatus = {
  running: false,
  phase: 'idle',
  current: 0,
  total: 0,
  message: '',
  result: null,
  enrichCount: 0,
  error: null,
};

let state: ScanStatus = { ...idle };
let enrichPromise: Promise<number> | null = null;

export function getScanStatus(): ScanStatus {
  return { ...state };
}

export function setScanProgress(partial: Partial<ScanStatus>) {
  state = { ...state, ...partial };
}

export function resetScanStatus() {
  state = { ...idle };
}

export function isScanRunning() {
  return state.running;
}

export function getEnrichPromise() {
  return enrichPromise;
}

export function setEnrichPromise(p: Promise<number> | null) {
  enrichPromise = p;
}
