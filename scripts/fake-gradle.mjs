// Stands in for Gradle in the server test: records how it was called and
// leaves files where a real release build would.
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const record = JSON.stringify({
  args,
  keystoreFile: process.env.ORG_GRADLE_PROJECT_keystoreFile,
  hasPassword: Boolean(process.env.ORG_GRADLE_PROJECT_keystorePassword),
  keyAlias: process.env.ORG_GRADLE_PROJECT_keyAlias,
});
console.log('> Task :app:assembleRelease');
if (args.some((a) => a === '-PversionName=fail')) {
  console.error('FAILURE: Build failed with an exception.');
  process.exit(1);
}
mkdirSync('app/build/outputs/apk/release', { recursive: true });
mkdirSync('app/build/outputs/bundle/release', { recursive: true });
writeFileSync('app/build/outputs/apk/release/app-release.apk', record);
writeFileSync('app/build/outputs/bundle/release/app-release.aab', record);
console.log('BUILD SUCCESSFUL in 1s');
