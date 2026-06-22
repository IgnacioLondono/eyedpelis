import { usePlatform } from '../context/PlatformContext';
import WebLayout from './WebLayout';
import AndroidMobileLayout from './AndroidMobileLayout';
import AndroidTvLayout from './AndroidTvLayout';

export default function AppLayout() {
  const { isAndroidMobile, isAndroidTv } = usePlatform();

  if (isAndroidTv) return <AndroidTvLayout />;
  if (isAndroidMobile) return <AndroidMobileLayout />;
  return <WebLayout />;
}
