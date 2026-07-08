import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.corelabs.npsharp',
  appName: 'NPSharp',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
