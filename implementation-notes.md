# CI/CD Implementation Notes

## iOS Deploy (`ios-deploy.yml`)

### Bug fixed: `Decode GoogleService-Info.plist` was the last step

The step was placed after `Execute Fastlane`, meaning the build ran without the file.
Moved it to position 4 — before `npm run build` and `cap sync ios`.

### Bug fixed: wrong path for `GoogleService-Info.plist`

Original path: `ios/GoogleService-Info.plist`
Correct path: `ios/App/App/GoogleService-Info.plist`

**Why:** For a Capacitor iOS project the Xcode app target lives at `ios/App/App/`. That is where Xcode expects `GoogleService-Info.plist` to be referenced. Placing it at the `ios/` root means Xcode never finds it and Firebase initialisation silently fails at runtime.

### Added: node_modules cache iOS

Cache key is `package-lock.json` hash. Saves ~1–2 min per run. Uses `restore-keys` fallback so a partial cache hit still works after minor dep changes.

---

## Android Deploy (`android-deploy.yml`)

### Bug fixed: `Decode google-services.json` was the last step

Same root cause as iOS — the step ran after `Execute Fastlane` / the Gradle build. Moved to position 6, before `npm run build` and `cap sync android`.

The path `android/app/google-services.json` is correct. `android/app/build.gradle` references it as `file('google-services.json')` which resolves relative to the `android/app/` module root. Confirmed in `build.gradle`:

```groovy
def servicesJSON = file('google-services.json')
```

### Added: node_modules cache Android

Same strategy as iOS workflow.

### Left unchanged: `KEYSTORE_PATH = "release.keystore"`

This is a relative filename used by `build.gradle` via `System.getenv("KEYSTORE_PATH")`. Gradle resolves `file("release.keystore")` relative to the app module (`android/app/`), which matches the decode target `android/app/release.keystore`. No change needed.

---

## Icons (`src/assets/icon/`, iOS, Android)

### Source files stored in `src/assets/icon/`

All brand SVGs copied from `/Users/vdphan/GitHub/icon/` into the project:

- `app-icon.svg` / `app-icon-white.svg` — 1024×1024 app icon
- `favicon.svg` / `favicon-white.svg` — 64×64 favicon
- `logo.svg` / `logo-white.svg` — 600×200 horizontal logo with text

Storing source SVGs in the project means future icon regeneration doesn't depend on a path outside the repo.

### PNG generation approach

No system SVG tools (ImageMagick, rsvg-convert, Inkscape) were installed. Used `@resvg/resvg-js` (Rust-based SVG renderer with prebuilt npm binaries, zero system deps) as a temporary `--no-save` install. Ran a one-off Node.js script, then uninstalled the package. The SVG source files remain in `src/assets/icon/` for future regeneration.

### Web: dual favicon strategy

`index.html` now has two `<link rel="icon">` tags: SVG first (modern browsers), PNG fallback (Safari ≤ 14, old Chromium). The `<title>` was updated from "Ionic App" to "PomoBlock".

### iOS: single 1024×1024 PNG

Modern Xcode (13+) requires only one PNG for the AppIcon asset. `AppIcon-512@2x.png` replaced.

### Android: adaptive icon background color

`ic_launcher_background.xml` updated from `#FFFFFF` to `#F8F9FA` — the exact background color of the brand icon. Prevents a white border flash visible during the launcher icon animation on some Android 12+ devices when the background and foreground colors don't match.

### Android: foreground PNG sizing

`ic_launcher_foreground.png` uses the 108dp canvas (full adaptive icon size), not the 72dp safe zone. The icon artwork has natural padding (the red circle is ~76% of the canvas width), so the safe zone is respected without explicit padding. If a launcher clips to the safe zone, only the outer #F8F9FA background is trimmed.

---

## Settings Page

### Storage: localStorage over Capacitor Preferences

Capacitor Preferences (`@capacitor/preferences`) is async — every read returns a Promise. That would require either async getters (not possible in Angular templates) or a separate init step with a loading state. `localStorage` is synchronous, so the service constructor can load and the settings object is immediately available. For a timer app this is fine; settings are small (<1 KB) and there is no cross-device sync requirement.

### Duration editing: ion-select with preset options (not free-text input)

Free-text input would require validation (is it a number? in range? integer?). `ion-select` with preset options makes invalid values impossible and produces a native iOS-style picker on device. Tradeoff: users are limited to the listed values. Options chosen cover the full practical range (1–60 min work, 1–15 min short break, 5–30 min long break, 2–6 sessions).

### Duration selects use interface="action-sheet"

The default `ion-select` interface on iOS is a native wheel picker which blocks interaction with the rest of the page until dismissed. `action-sheet` shows options as a bottom sheet list, which is clearer and consistent with the app's existing design. Tradeoff: for long lists (e.g., 60-option minute range) a wheel picker is more ergonomic — but with ≤8 options an action sheet is fine.

### Web Audio API for sounds

No audio files are needed. Tones are generated programmatically using `AudioContext` + `OscillatorNode`. The session-end alert is an 880 Hz sine with 0.8s fade; the ticking sound is a 1000 Hz sine with a 50ms click. Both work in a Capacitor WebView. `AudioContext` is lazy-created on first timer start (after a user gesture) to satisfy browser autoplay policy — creating it on app load would be silently blocked.

### Settings take effect at next session start, not mid-session

If a user changes work duration while a session is running, the running timer is not affected. `remainingSeconds` and `totalSeconds` are set from settings only when a new session begins (in `onComplete()`) or when the home tab is visited while the timer is idle (`ionViewWillEnter`). This avoids the confusing case where the timer suddenly jumps to a new total mid-countdown.

### Blocking settings are persisted but not functional

The UI has "Enable Blocking" and "Strict Mode" toggles. Their state is saved to `localStorage` and will be read by future blocking logic. Actual URL blocking on iOS requires a Network Extension and on Android requires a VPN service — both need native Capacitor plugins beyond this scope. The toggles are not disabled in the UI so the user can configure them ahead of that implementation.

### SESSIONS constant removed from home.page.ts

The module-level `SESSIONS = 4` constant was replaced by `settingsService.get().longBreakAfter`. The `sessionDots` getter and `onComplete()` now use the live setting. This means changing "Long Break After" in settings immediately affects the dot count shown on the home tab on the next visit.

---

## Sound Type Picker (per-sound selection)

### Decision: union types in settings.service.ts, not an enum or a separate constants file

`TickingSoundType = 'tick' | 'click' | 'soft'` and `SessionEndSoundType = 'beep' | 'bell' | 'chime'` live directly in `settings.service.ts`. No enum, no separate file. Reasons: (1) they serialize naturally to/from `localStorage` as plain strings with no mapping step; (2) they're consumed only in `home.page.ts` and `settings.page.html` — no need for a shared barrel file; (3) TypeScript narrows them at call sites so mismatches are compile errors.

### Decision: `playBeep` renamed to `playSessionEnd`, `playTick` gains a type param

The spec didn't say what to name things. `playBeep` was no longer accurate once it could play a bell or chime. Renamed to `playSessionEnd(type: SessionEndSoundType)`. `playTick(type: TickingSoundType)` follows the same pattern. Call sites in `tick()` and `onComplete()` pass the type from the current settings snapshot.

### Decision: `click` tick uses a white-noise buffer, not an oscillator

A mechanical click sound has no single frequency — it's broadband transient noise. Using a 15ms `AudioBufferSourceNode` filled with `Math.random() * 2 - 1` produces the correct mechanical feel. An oscillator at any frequency sounds electronic, not physical. Tradeoff: `createBuffer` allocates a new buffer per tick (every second when enabled). At 15ms × 44100 Hz the buffer is ~662 samples — negligible memory, no perceptible GC pressure.

### Decision: `bell` uses three partials (660 Hz + 1320 Hz + 1980 Hz), not a physical bell model

A real bell has inharmonic partials. A full physical model (Karplus-Strong, FM synthesis, or a real sample) would be more authentic but far more complex. Three harmonic sine waves at 660/1320/1980 Hz with decaying amplitude gives a recognisably bell-like quality while staying within the existing Web Audio pattern. Tradeoff: it sounds cleaner/more synthetic than a real bell.

### Decision: `chime` uses three ascending notes with 250ms spacing, not simultaneous

Playing C5+E5+G5 simultaneously sounds like a chord, not a chime. Staggering them 250ms apart sounds like a descending strike sequence — the same affordance as a doorbell or notification chime. Start times use `ctx.currentTime + i * 0.25` so the scheduling is sample-accurate.

### Decision: type selector is disabled (not hidden) when its toggle is off

Using `[disabled]="!settings.tickingSound"` grays out the selector and prevents interaction. An alternative was `@if (settings.tickingSound)` to hide it entirely. Disabled was chosen because it shows the user there *is* a choice to make — they can see what options exist before enabling the sound. Hidden would require the user to know to look there after toggling.

### No change to settings.page.ts

`IonSelect` and `IonSelectOption` were already imported, and `save<K extends keyof AppSettings>(key, value)` already handles any field. The new `sessionEndSoundType` and `tickingSoundType` fields slot in without any TypeScript changes to the component class.

### localStorage migration: none needed

The settings constructor merges stored data over `DEFAULTS`: `{ ...DEFAULTS, ...JSON.parse(raw) }`. Users with existing stored settings will simply get the new defaults (`'beep'` and `'tick'`) filled in — no migration script, no version flag.

---

## Icon & Splash Screen Generation

### Decision: `@capacitor/assets` over manual icon replacement

The previous icons were committed manually (15+ PNGs per platform). Adding `@capacitor/assets` v3 means all 87 Android assets + 10 iOS assets + 7 PWA WebP icons are regenerated from two SVG source files via `npm run generate-icons`. Trade-off: adds one devDependency and ~60 s of local generation time, but future icon changes are one command instead of 100+ manual file replacements.

### Decision: SVG source files (not PNG) in `resources/`

`@capacitor/assets` v3 supports SVG input directly via sharp/librsvg. SVG source stays version-controlled as text (diffable, tiny), whereas a 1024×1024 PNG source would be a 200KB+ binary blob. If librsvg is unavailable (rare CI environments without libvips SVG support), the fallback is to place a `resources/icon.png` (1024×1024 PNG) alongside the SVG — the tool prefers PNG if both exist.

### Decision: `splash.svg` centers the icon on a solid red background

The tool's `--splashBackgroundColor` flag applies a flat color background independently, but providing a custom `splash.svg` with the icon centered gives precise control over icon size in the splash (512px within 2732px canvas ≈ 18.7% of width — matches standard splash icon sizing guidelines). Scale: `scale(8)` on a 64×64 viewBox = 512×512 px content at `translate(1110, 1110)`.

### Decision: dark-mode splash = same as light (no `splash-dark.svg`)

The tool generates dark-mode splash variants from `splash-dark.svg` if it exists. Since the splash is solid `#FF0F01` red with the same icon, no dark variant was created. Both light and dark modes show the same red splash. This can be revisited by adding `resources/splash-dark.svg`.

### Decision: `apple-touch-icon.png` generated with sharp, not from the PWA WebP icons

The generator creates WebP icons in `src/assets/icons/`. Safari/iOS does not support WebP for `apple-touch-icon`. A separate 180×180 PNG is generated using the sharp instance already installed as a transitive dep of `@capacitor/assets`. Command: `node -e "require('sharp')('resources/icon.svg').resize(180).png().toFile('src/assets/icon/apple-touch-icon.png')"`.

### `ic_launcher_background.xml` → per-density `ic_launcher_background.png`

The previous setup used `android/app/src/main/res/values/ic_launcher_background.xml` with a hex color. The generator replaces this with per-density `ic_launcher_background.png` files (solid-color PNGs). Both approaches work; the PNG approach is what `@capacitor/assets` produces. The `mipmap-anydpi-v26/ic_launcher.xml` now references both `ic_launcher_foreground` and `ic_launcher_background` as drawables — unchanged structure.

### CI: no changes required

Both `android-deploy.yml` and `ios-deploy.yml` build from committed native assets. The generated files are committed, so CI works without running `generate-icons`. See `ICON_GUIDE.md` for how to add an optional generation step to CI.

### Correction: background color reverted from `#FF0F01` to `#FFFFFF`

The initial `generate-icons` run used `--iconBackgroundColor '#FF0F01'` (red), making the adaptive icon background and splash background both red. This was reverted: the original project used a white (`#FFFFFF`) background. The icon's red circle is self-contained in the foreground layer — it does not need a matching background. Updated: `package.json` flags, `resources/splash.svg` background rect, `ICON_GUIDE.md` examples.

---

## iOS Audio Fix

### Root cause 1: AudioContext never resumed (JS)

On iOS WKWebView, `new AudioContext()` always starts in `"suspended"` state — even when called inside a user-gesture handler. The original code created the context lazily inside `playTick()`/`playSessionEnd()`, which are called from `setInterval` — entirely outside any user-gesture frame. A suspended context schedules oscillators silently.

**Fix**: in `toggleTimer()` (the tap handler), create the AudioContext and call `.resume()` before starting the interval. By the time the first `tick()` fires 1 second later, `resume()` has completed and the context is `"running"`.

### Root cause 2: AVAudioSession not configured (native iOS)

Without AVAudioSession configuration, Capacitor's WKWebView defaults to the `.soloAmbient` session category, which is silenced by the hardware silent switch. For a focus timer where the session-end alert needs to be heard, `.playback` is the correct category.

**Fix**: `AppDelegate.swift` now sets `.playback` + `.mixWithOthers` on launch. `.mixWithOthers` prevents the app from interrupting background music — important since users often listen to music during a Pomodoro session.

**Why not `UIBackgroundModes`**: the timer runs in the foreground only. Background audio would require keeping the JS `setInterval` alive while backgrounded, which WKWebView does not do. That is a separate problem (background timer) not addressed here.

---

## iOS CI/CD: bundle ID collision and provisioning profile architecture

### Bug 1: `update_code_signing_settings` overwrote the extension's bundle ID

`update_code_signing_settings` without a `targets` filter applies to every target in the `.xcodeproj`. Setting `bundle_identifier: "com.pomoblock.app"` overwrote the pushextension target's bundle ID (correctly set to `com.pomoblock.app.pushextension` in `project.pbxproj`) — causing altool to reject the IPA with a 409 `CFBundleIdentifier Collision`.

**Fix**: added `targets: ["App"]` to restrict the call to the main app target only.

### Bug 2: extension had no provisioning profile in CI

With the correct bundle ID restored, Xcode could no longer sign the extension using the main app's profile. Headless CI runners have no Apple ID session — automatic signing cannot reach Apple's developer portal. Every target in the IPA needs an explicit provisioning profile physically present on the runner.

**Fix**: use `build_ios_app(export_options: { provisioningProfiles: { ... } })` to map each bundle ID to its profile UUID at export time. A second GitHub secret (`IOS_PUSH_EXTENSION_PROFILE_BASE64`) holds the extension's Distribution profile, imported in a new CI step.

**Why `export_options` over a second `update_code_signing_settings` call**: `export_options` is applied at the `xcodebuild -exportArchive` stage without modifying the `.xcodeproj` on disk. It also scales naturally — each additional extension is one more hash entry, one more secret, one more import step. See the "Adding a new iOS app extension" section in `README.md` for the repeatable pattern.

---

## CI: per-platform deploy keywords

### Decision: `if:` conditions on jobs rather than workflow-level trigger filters

GitHub Actions cannot suppress a workflow run based on commit message content at the trigger level — the workflow always fires when the push branch matches. The `if:` condition on the job marks it "skipped" (completes in seconds, no billable minutes). Both workflows appear in the Actions tab on every push; one or both are skipped based on keywords.

Keywords: `[deploy]` = both platforms, `[deploy:ios]` = iOS only, `[deploy:android]` = Android only.

**Tradeoff considered**: merging both workflows into a single `deploy.yml` with two jobs would reduce two workflow runs to one. Rejected as a risky structural change with no functional benefit — keeping the files separate maintains clearer ownership and per-platform failure isolation.
