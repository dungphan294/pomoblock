# Icon & Splash Screen Pipeline

How to change the app icon and splash screen for web, Android, and iOS in one command.

---

## Overview

All icons and splash screens are generated from two source SVGs in `resources/`:

```txt
resources/
  icon.svg      ← app icon source (any viewBox, vector)
  splash.svg    ← splash screen source (any viewBox, vector)
```

The tool `@capacitor/assets` reads these and writes every required platform asset. The generated files are committed to the repo so CI can build without running the generator.

---

## Changing the Icon

1. Replace `resources/icon.svg` with your new icon.
2. Replace `resources/splash.svg` with your new splash (or keep the auto-centered default).
3. Run:

```bash
npm run generate-icons
```

1. Commit everything under `android/`, `ios/`, and `src/assets/icons/`.

That's it. The next CI run will use the new assets.

---

## Source File Requirements

| Platform | File | Min size | Transparency |
|----------|------|----------|--------------|
| All | `resources/icon.svg` | any viewBox | allowed |
| All | `resources/splash.svg` | any viewBox | allowed |
| Android (fallback) | `resources/icon.png` | 1024×1024 | allowed |
| iOS (fallback) | `resources/icon.png` | 1024×1024 | **not allowed** — App Store rejects transparent icons |

**SVG notes:**

- The SVG viewBox can be any size — the tool scales it.
- Avoid `<image>` tags inside the SVG (raster embeds cause sharp/librsvg to fail silently).
- Commented-out `<rect>` background elements are fine.

---

## What Gets Generated

### Web (PWA icons)

Written to `src/assets/icons/`:

```txt
icon-48.webp
icon-72.webp
icon-96.webp
icon-128.webp
icon-192.webp
icon-256.webp
icon-512.webp
```

These are WebP. Reference them in your `manifest.webmanifest` if you use one.

The `src/assets/icon/favicon.svg` and `src/assets/icon/favicon.png` are **not** touched by the generator — update them manually. The `apple-touch-icon.png` (180×180) at `src/assets/icon/apple-touch-icon.png` is generated separately using:

```bash
node -e "require('sharp')('resources/icon.svg').resize(180).png().toFile('src/assets/icon/apple-touch-icon.png')"
```

Referenced in `src/index.html`:

```html
<link rel="apple-touch-icon" href="assets/icon/apple-touch-icon.png" />
```

### Android

Written to `android/app/src/main/res/`:

| Directory | Files | Purpose |
|-----------|-------|---------|
| `mipmap-ldpi/` through `mipmap-xxxhdpi/` | `ic_launcher.png` | Legacy icon (pre-API 26) |
| `mipmap-ldpi/` through `mipmap-xxxhdpi/` | `ic_launcher_round.png` | Round icon variant |
| `mipmap-ldpi/` through `mipmap-xxxhdpi/` | `ic_launcher_foreground.png` | Adaptive icon foreground |
| `mipmap-ldpi/` through `mipmap-xxxhdpi/` | `ic_launcher_background.png` | Adaptive icon background |
| `mipmap-anydpi-v26/` | `ic_launcher.xml`, `ic_launcher_round.xml` | Adaptive icon descriptors |
| `drawable/` and `drawable-port-*/`, `drawable-land-*/` | `splash.png` | Splash screens (portrait + landscape, all densities) |
| `drawable-night/` and variants | `splash.png` | Dark mode splash |

**Android adaptive icon** (API 26+): The OS applies a mask (circle, squircle, rounded square — device-dependent) to the foreground layer. The safe zone is the inner 66dp of a 108dp canvas. The generator handles this padding automatically.

**Background color**: Set via the `--iconBackgroundColor` flag in `npm run generate-icons`. Currently `#FFFFFF` (white) — the icon's red circle provides its own background.

### iOS

Written to `ios/App/App/Assets.xcassets/`:

| Asset set | Files | Purpose |
|-----------|-------|---------|
| `AppIcon.appiconset/` | `AppIcon-512@2x.png` (1024×1024) | App Store + home screen icon |
| `Splash.imageset/` | `Default@1x~universal~anyany.png` × 3 scales | Launch image (light + dark) |

**iOS icon rules:**

- No transparency (App Store Connect rejects transparent PNGs).
- No rounded corners in the source — iOS applies the rounded-rect mask itself.
- The single 1024×1024 `universal` entry in `Contents.json` is sufficient for modern iOS (13+). Older builds may need additional sizes — Xcode will warn if any are missing.

**iOS splash**: Capacitor uses a launch storyboard by default. For the image to appear you need `@capacitor/splash-screen` installed and `launchShowDuration` set in `capacitor.config.ts`:

```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: '#FFFFFF',
  },
},
```

Without the plugin, the generated `Splash.imageset` exists but is never displayed.

---

## Adding to CI (optional)

The committed generated files mean CI works without running the generator. If you want CI to always regenerate from source (to keep assets in sync with `resources/`), add this step **before** `npx cap sync` in both workflows:

**android-deploy.yml** and **ios-deploy.yml** — after `npm ci && npm run build`:

```yaml
- name: Generate icons and splash
  run: npm run generate-icons
```

Trade-off: adds ~15–30 s per build but guarantees assets are never stale.

---

## Checklist for Icon Updates

- [ ] Replace `resources/icon.svg`
- [ ] Replace `resources/splash.svg` (or regenerate with new colors via `--splashBackgroundColor`)
- [ ] Run `npm run generate-icons`
- [ ] Manually update `src/assets/icon/favicon.svg` (not touched by the generator)
- [ ] Manually update `src/assets/icon/favicon.png` (32×32 or 64×64)
- [ ] Regenerate `apple-touch-icon.png` (see command above)
- [ ] Commit all changed files in `android/`, `ios/`, `src/assets/`
- [ ] Update `--iconBackgroundColor` in `generate-icons` script if the icon background color changed
- [ ] If icon has transparency: verify iOS `AppIcon-512@2x.png` has no transparent pixels (App Store rejects it)
- [ ] If adding `@capacitor/splash-screen`: configure `launchShowDuration` in `capacitor.config.ts`
