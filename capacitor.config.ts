import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.callanalyzer.eth',
  appName: 'Call Analyzer - ETH',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
