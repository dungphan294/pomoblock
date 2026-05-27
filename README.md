# pomoblock

Ionic/Capacitor app with automated CI/CD via GitHub Actions + Fastlane for both iOS (TestFlight) and Android (Play Store internal track).

---

## CI/CD Overview

| Platform | Runner | Trigger | Destination |
|---|---|---|---|
| iOS | `macos-latest` | `[deploy]` or `[deploy:ios]` in commit message, or manual | TestFlight |
| Android | `ubuntu-latest` | `[deploy]` or `[deploy:android]` in commit message, or manual | Play Store internal |

Both pipelines use [Fastlane](https://fastlane.tools/) for building and uploading.

---

## Deploying from a commit

Deployments are opt-in. Add a keyword anywhere in your commit message to trigger the relevant pipeline(s):

| Keyword | iOS | Android |
|---|---|---|
| `[deploy]` | ✅ | ✅ |
| `[deploy:ios]` | ✅ | ❌ |
| `[deploy:android]` | ❌ | ✅ |
| *(no keyword)* | ❌ | ❌ |

Examples:

```bash
git commit -m "chore: bump version [deploy]"              # both platforms
git commit -m "fix: iOS push crash [deploy:ios]"          # iOS only
git commit -m "fix: Android back button [deploy:android]" # Android only
git commit -m "docs: update README"                       # no deploy
```

To trigger manually without a push, go to **GitHub → Actions → select workflow → Run workflow**.

---

## Required GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** to add these.

### iOS

| Secret | Description | How to get it |
|---|---|---|
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Firebase config for iOS, base64-encoded | **Firebase Console → Project settings → iOS app** → download `GoogleService-Info.plist` → `base64 -i GoogleService-Info.plist \| pbcopy` |
| `IOS_CERTIFICATE_BASE64` | Apple Distribution .p12 certificate, base64-encoded | Export from **Keychain Access** → select your Apple Distribution cert → Export as .p12 → `base64 -i cert.p12 \| pbcopy` |
| `IOS_CERTIFICATE_PASSWORD` | Password set when exporting the .p12 | You choose this when exporting |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store Distribution profile for `com.pomoblock.app`, base64-encoded | Download `.mobileprovision` from [Apple Developer portal](https://developer.apple.com/account/resources/profiles/list) → `base64 -i profile.mobileprovision \| pbcopy` |
| `IOS_PUSH_EXTENSION_PROFILE_BASE64` | App Store Distribution profile for `com.pomoblock.app.pushextension`, base64-encoded | Same as above but for the push notification extension App ID → `base64 -i pushextension.mobileprovision \| pbcopy` |
| `APP_STORE_CONNECT_API_KEY_BASE64` | App Store Connect API key (.p8 file), base64-encoded | **App Store Connect → Users and Access → Integrations → Generate API Key** → download .p8 → `base64 -i key.p8 \| pbcopy` |
| `APP_STORE_CONNECT_KEY_ID` | ID of the API key | Shown next to the key name in App Store Connect Integrations |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID | Shown at the top of the App Store Connect Integrations page |

### Android

| Secret | Description | How to get it |
|---|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase config for Android, base64-encoded | **Firebase Console → Project settings → Android app** → download `google-services.json` → `base64 -i google-services.json \| pbcopy` |
| `ANDROID_KEYSTORE_BASE64` | Release keystore, base64-encoded | Generate with `keytool` (see below) → `base64 -i release.keystore \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Set when running `keytool -genkey` |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore | Set when running `keytool -genkey` |
| `ANDROID_KEY_PASSWORD` | Key password | Set when running `keytool -genkey` |
| `PLAY_STORE_JSON_BASE64` | Google Play service account JSON, base64-encoded | **Google Play Console → Setup → API access → Create service account** → download JSON → `base64 -i key.json \| pbcopy` |

---

## Adding a new iOS app extension

Each Xcode target bundled inside the IPA (widgets, share extensions, notification extensions, etc.) must have its own App Store Distribution provisioning profile on the CI runner. The pattern is the same every time:

1. **Register the App ID** — Apple Developer portal → Identifiers → `+` → App IDs → type: App Extension → bundle ID: `com.pomoblock.app.<extension-name>`
2. **Create a Distribution profile** — Profiles → `+` → App Store Connect → select the new App ID → download the `.mobileprovision`
3. **Add a GitHub secret** — encode and add:
   ```bash
   base64 -i <extension>.mobileprovision | pbcopy
   # Secret name: IOS_<EXTENSION_NAME>_PROFILE_BASE64
   ```
4. **Add an import step** in `.github/workflows/ios-deploy.yml` (copy the "Import Push Extension Provisioning Profile" step, change the secret name and env var name)
5. **Add an entry** to `provisioningProfiles` in `ios/fastlane/Fastfile`:
   ```ruby
   "com.pomoblock.app.<extension-name>" => ENV["<EXTENSION_NAME>_PROFILE_UUID"]
   ```

---

## Generating an Android keystore

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias your-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep `release.keystore` safe — losing it means you can never update the app on Play Store.

---

## Base64 encoding (macOS)

```bash
base64 -i yourfile | pbcopy   # encodes and copies to clipboard
```

---

## Project structure

```
.github/workflows/
  ios-deploy.yml       # iOS pipeline
  android-deploy.yml   # Android pipeline

ios/
  fastlane/Fastfile    # iOS lane: code signing → build → upload to TestFlight
  Gemfile              # Fastlane dependency (enables gem caching in CI)

android/
  fastlane/Fastfile    # Android lane: Gradle bundle → upload to Play Store internal
  Gemfile              # Fastlane dependency
```
