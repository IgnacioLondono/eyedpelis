import { usePlatform } from '../context/PlatformContext';

export function usePageShell() {
  const { isAndroidMobile, isAndroidTv } = usePlatform();

  return {
    shell: isAndroidMobile
      ? 'px-4 py-4 pb-6'
      : isAndroidTv
        ? 'px-10 py-8'
        : 'p-6',
    title: isAndroidTv
      ? 'text-4xl font-bold mb-8'
      : isAndroidMobile
        ? 'text-2xl font-bold mb-4'
        : 'text-3xl font-bold mb-6',
    heading: isAndroidTv
      ? 'text-4xl font-bold'
      : isAndroidMobile
        ? 'text-2xl font-bold'
        : 'text-3xl font-bold',
    isAndroidMobile,
    isAndroidTv,
  };
}
