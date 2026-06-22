import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getDeviceProfile, type DeviceProfile } from '../utils/device';

interface PlatformState {
  profile: DeviceProfile;
  isWeb: boolean;
  isAndroidMobile: boolean;
  isAndroidTv: boolean;
  isNative: boolean;
}

const PlatformContext = createContext<PlatformState>({
  profile: 'web',
  isWeb: true,
  isAndroidMobile: false,
  isAndroidTv: false,
  isNative: false,
});

export function PlatformProvider({ children, profile }: { children: ReactNode; profile?: DeviceProfile }) {
  const value = useMemo<PlatformState>(() => {
    const p = profile ?? getDeviceProfile();
    return {
      profile: p,
      isWeb: p === 'web',
      isAndroidMobile: p === 'android-mobile',
      isAndroidTv: p === 'android-tv',
      isNative: p !== 'web',
    };
  }, [profile]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  return useContext(PlatformContext);
}
