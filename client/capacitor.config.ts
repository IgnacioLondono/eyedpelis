import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eyedcomun.eyedpelis',
  appName: 'Eyedpelis',
  webDir: 'dist',
  server: {
    url: 'https://eyedmovies.eyedcomun.me/',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
