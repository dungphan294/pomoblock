# pomoblock

Ionic/Capacitor app with automated CI/CD via GitHub Actions + Fastlane for both iOS (TestFlight) and Android (Play Store internal track).

---

## CI/CD Overview

| Platform | Runner | Trigger | Destination |
|---|---|---|---|
| iOS | `macos-latest` | Push to `main` or manual | TestFlight |
| Android | `ubuntu-latest` | Push to `main` or manual | Play Store internal |

Both pipelines use [Fastlane](https://fastlane.tools/) for building and uploading.

---

## Skipping CI on a push

Add `[skip ci]` anywhere in your commit message to prevent both workflows from running:

```bash
git commit -m "update config [skip ci]"
```

To trigger a workflow manually without pushing, go to **GitHub → Actions → select workflow → Run workflow**.

---

## Required GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** to add these.

### iOS

| Secret | Description | How to get it |
|---|---|---|
| `IOS_CERTIFICATE_BASE64` | Apple Distribution .p12 certificate, base64-encoded | Export from **Keychain Access** → select your Apple Distribution cert → Export as .p12 → `base64 -i cert.p12 \| pbcopy` |
| `IOS_CERTIFICATE_PASSWORD` | Password set when exporting the .p12 | You choose this when exporting |
| `IOS_PROVISIONING_PROFILE_BASE64` | Distribution provisioning profile, base64-encoded | Download `.mobileprovision` from [Apple Developer portal](https://developer.apple.com/account/resources/profiles/list) → `base64 -i profile.mobileprovision \| pbcopy` |
| `APP_STORE_CONNECT_API_KEY_BASE64` | App Store Connect API key (.p8 file), base64-encoded | **App Store Connect → Users and Access → Integrations → Generate API Key** → download .p8 → `base64 -i key.p8 \| pbcopy` |
| `APP_STORE_CONNECT_KEY_ID` | ID of the API key | Shown next to the key name in App Store Connect Integrations |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID | Shown at the top of the App Store Connect Integrations page |

### Android

| Secret | Description | How to get it |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | Release keystore, base64-encoded | Generate with `keytool` (see below) → `base64 -i release.keystore \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Set when running `keytool -genkey` |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore | Set when running `keytool -genkey` |
| `ANDROID_KEY_PASSWORD` | Key password | Set when running `keytool -genkey` |
| `PLAY_STORE_JSON_BASE64` | Google Play service account JSON, base64-encoded | **Google Play Console → Setup → API access → Create service account** → download JSON → `base64 -i key.json \| pbcopy` |

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
