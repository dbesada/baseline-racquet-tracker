# Baseline mobile apps

This Capacitor workspace produces the Android and iOS shells for Baseline Racquet Deals.

## Use it today

The default development configuration loads the private TrueNAS app at
`https://nasbesada.tail0731b8.ts.net`. A phone must be signed into the owner's
Tailscale network. Build the Android test APK with:

```powershell
npm install
npm run android:debug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Production guard

A production build now defaults to the public TrueNAS address at
`https://baseline.besada.net`. You can still override it when needed:

```powershell
$env:BASELINE_BUILD = "production"
npm run android:sync
```

The public site currently uses an owner-only Cloudflare Access login. Before an
App Store or Play Store submission, replace that temporary gate with normal
in-app user accounts or a public read-only experience that reviewers can use.

External retailer links open outside the app; arbitrary domains are not added to
the native WebView navigation allowlist.

## Google Play bundle

1. Create an Android upload key and copy `android/keystore.properties.example`
   to `android/keystore.properties` with the real local values.
2. Never commit the keystore or the completed properties file.
3. Set production mode as shown above. Override the public URL only if needed.
4. Build with a monotonically increasing version code:

```powershell
cd android
./gradlew.bat bundleRelease -PBASELINE_VERSION_CODE=1 -PBASELINE_VERSION_NAME=1.0.0
```

The signed bundle is written to `android/app/build/outputs/bundle/release/`.

## iOS

The iOS source project is generated here, but Apple requires macOS, Xcode 26+
and an Apple Developer signing team to compile and submit it:

```bash
npm install
npm run ios:sync
npm run ios:open
```

Set `BASELINE_BUILD=production` before syncing the Xcode project. Override
`BASELINE_APP_URL` only when building against a different public host.

## Before either store submission

- Choose a stable public HTTPS app URL.
- Supply a public support contact and privacy-policy URL.
- Create the Google Play Console and Apple Developer accounts.
- Add native push notifications so price alerts continue when the app is closed.
- Test retailer links, offline handling, dark mode and alerts on physical devices.
