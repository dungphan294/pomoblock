# pomoblock

Ionic/Capacitor app with automated CI/CD via GitHub Actions + Fastlane for both iOS (TestFlight) and Android (Play Store internal track).

---

## iOS min-version enforcement

On every launch the app calls `GET /api/config?version=<appVersion>` on the backend. Based on the response it either:

- **`force`** — shows a non-dismissible "Update Required" alert that opens the App Store. The app is blocked until the user updates.
- **`flexible`** — shows a dismissible "Update Available" prompt.
- **`none`** — continues normally.

The minimum required version is updated automatically in Firestore every time the iOS deploy workflow pushes a new build to TestFlight (via `POST /api/admin/set-min-version`).

### Local setup

Set the backend URL in `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',   // point at your local pomoblock-backend
};
```

The production URL (`src/environments/environment.prod.ts`) defaults to `https://pomoblock-backend.vercel.app`. Change it if you deploy the backend elsewhere.

### Manually overriding the min version

To force all users on a version older than `1.2.0` to update immediately:

```bash
# Get a token (requires ENTRA_CLIENT_SECRET)
TOKEN=$(curl -s -X POST \
  "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "scope=<CLIENT_ID>/.default" \
  | jq -r .access_token)

curl -X POST https://pomoblock-backend.vercel.app/api/admin/set-min-version \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":"1.2.0"}'
```

To lower the min version (e.g. after rolling back), call the same endpoint with the older version string.

---

## CI/CD Overview

| Platform | Runner | Trigger | Destination |
| --- | --- | --- | --- |
| iOS | `macos-latest` | `[deploy]` or `[deploy:ios]` in commit message, or manual | TestFlight |
| Android | `ubuntu-latest` | `[deploy]` or `[deploy:android]` in commit message, or manual | Play Store internal |

Both pipelines use [Fastlane](https://fastlane.tools/) for building and uploading.

---

## Deploying from a commit

Deployments are opt-in. Add a keyword anywhere in your commit message to trigger the relevant pipeline(s):

| Keyword | iOS | Android |
| --- | --- | --- |
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
| --- | --- | --- |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Firebase config for iOS, base64-encoded | **Firebase Console → Project settings → iOS app** → download `GoogleService-Info.plist` → `base64 -i GoogleService-Info.plist \| pbcopy` |
| `IOS_CERTIFICATE_BASE64` | Apple Distribution .p12 certificate, base64-encoded | Export from **Keychain Access** → select your Apple Distribution cert → Export as .p12 → `base64 -i cert.p12 \| pbcopy` |
| `IOS_CERTIFICATE_PASSWORD` | Password set when exporting the .p12 | You choose this when exporting |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store Distribution profile for `com.pomoblock.app`, base64-encoded | Download `.mobileprovision` from [Apple Developer portal](https://developer.apple.com/account/resources/profiles/list) → `base64 -i profile.mobileprovision \| pbcopy` |
| `IOS_PUSH_EXTENSION_PROFILE_BASE64` | App Store Distribution profile for `com.pomoblock.app.pushextension`, base64-encoded | Same as above but for the push notification extension App ID → `base64 -i pushextension.mobileprovision \| pbcopy` |
| `APP_STORE_CONNECT_API_KEY_BASE64` | App Store Connect API key (.p8 file), base64-encoded | **App Store Connect → Users and Access → Integrations → Generate API Key** → download .p8 → `base64 -i key.p8 \| pbcopy` |
| `APP_STORE_CONNECT_KEY_ID` | ID of the API key | Shown next to the key name in App Store Connect Integrations |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID | Shown at the top of the App Store Connect Integrations page |
| `ENTRA_TENANT_ID` | Azure AD tenant ID used to obtain an access token for the admin API | Azure portal → Azure Active Directory → Overview → Tenant ID |
| `ENTRA_CLIENT_ID` | Client ID of the Azure App Registration for the backend | Azure portal → App registrations → your app → Application (client) ID |
| `ENTRA_CLIENT_SECRET` | Client secret for the App Registration | Azure portal → App registrations → your app → Certificates & secrets → New client secret |
| `ADMIN_API_URL` | Base URL of the deployed pomoblock-backend, e.g. `https://pomoblock-backend.vercel.app` | Vercel dashboard → your project → Domains |

The iOS pipeline uses these four secrets in a post-Fastlane step that calls `POST /api/admin/set-min-version` with the current `package.json` version. This records the minimum required iOS version in Firestore so that clients running an older build receive a force-update prompt.

### Android

| Secret | Description | How to get it |
| --- | --- | --- |
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

## Android in-app update priority

The app uses the [Google Play in-app updates API](https://developer.android.com/guide/playcore/in-app-updates) to prompt users to update without leaving the app.

**How it works end-to-end:**

1. **Fastlane sets the priority** when uploading to Play Store. In `android/fastlane/Fastfile`:

   ```ruby
   upload_to_play_store(
     track: "internal",
     json_key: "fastlane/play_store_key.json",
     in_app_update_priority: 5
   )
   ```

2. **`MainActivity` reads it** on launch via `AppUpdateManager` and routes to the appropriate update flow.

**Priority scale (0–5):**

| Value | Behaviour |
| --- | --- |
| 0–3 | `FLEXIBLE` — downloads in background, restart dialog when ready |
| 4–5 | `IMMEDIATE` — full-screen forced update, user must complete before continuing |

**To ship a non-critical release** (e.g. a minor feature, no urgent fix), lower the priority before deploying:

```ruby
# android/fastlane/Fastfile
in_app_update_priority: 2   # triggers flexible background update
```

Restore to `5` for the next critical release.

---

## Testing in-app updates (Android)

All three conditions must be true before the update prompt appears:

1. **Install from the Play Store internal testing track** — not via ADB or Android Studio. The device's Google account must have accepted the internal testing invite in Play Console, then installed through the Play Store app.
2. **The installed version must be older than the version on the track** — the prompt only appears when Play Store `versionCode` > installed `versionCode`. If the device already has the latest build, there is nothing to update to.
3. **`in_app_update_priority` is metadata only** — it controls `IMMEDIATE` vs `FLEXIBLE` in the app code. It does not make an update appear.

**Local testing without a Play Store release:**

Replace `AppUpdateManagerFactory.create(this)` in `MainActivity.java` with `new FakeAppUpdateManager(this)` temporarily. `FakeAppUpdateManager` simulates update availability on any device without needing a real Play Store release. Remember to revert before shipping.

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

```text
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
