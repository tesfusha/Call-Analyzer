# Android Release Signing & Package Identity

- **Fixed Package Name (`applicationId`)**: `com.callanalyzer.eth` (set in `capacitor.config.ts`, `android/app/build.gradle`, and `android/app/src/main/res/values/strings.xml`). Never change this between releases.
- **Single Release Keystore**: Always sign every release APK/AAB with the same keystore so in-place updates preserve user IndexedDB data and preferences.

## Generating the Release Keystore (Once)

```bash
keytool -genkeypair -v \
  -keystore android/call-analyzer-release.jks \
  -alias call-analyzer-eth \
  -keyalg RSA -keysize 2048 -validity 10000
```

1. Copy `android/keystore.properties.example` to `android/keystore.properties` and enter your passwords.
2. **Back up `android/call-analyzer-release.jks` and `android/keystore.properties` offline / in an encrypted password manager.**
3. Build a signed release APK with:

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleRelease
```
