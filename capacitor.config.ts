import type { CapacitorConfig } from '@capacitor/cli';

// Placeholder identity for the week-1 test build. The export server will set
// appId and appName per game from the project's meta block.
const config: CapacitorConfig = {
  appId: 'app.gameengine.runner',
  appName: 'Runner',
  webDir: 'dist',
};

export default config;
