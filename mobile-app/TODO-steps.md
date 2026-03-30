# Android Studio Verification Loop

## One-time setup

1. Open Android Studio.
2. Start your emulator from Device Manager.
3. In `mobile-app`, install the current dev APK:

```bash
npm run android:install-apk
```

4. Start Metro for the dev client:

```bash
npm run android:dev
```

5. Launch the app on the emulator:

```bash
npm run android:launch
```

## Daily edit/test flow

1. Keep Android Studio's emulator running.
2. Keep `npm run android:dev` running in a terminal.
3. Make app changes.
4. Verify the change in the emulator.
5. Reload the app from the dev menu or press `r` in the Metro terminal when needed.

## When you need to redeploy

Use this after replacing `togetherly-latest.apk` with a newer build, or after generating a local APK at `android/app/build/outputs/apk/...`:

```bash
npm run android:redeploy
```

This reinstalls the APK on the emulator and launches the app again.

## When a full rebuild is required

You only need a new APK when a native change happens, for example:

- `app.json` plugin or permission changes
- new native library or Expo plugin changes
- Android package/config updates

Build a fresh development client APK, place it at `mobile-app/togetherly-latest.apk`, or point the script at a custom file with `APK_PATH`, then run:

```bash
npm run android:redeploy
```

Examples:

```bash
set APK_PATH=C:\path\to\your\app-debug.apk
npm run android:install-custom-apk
```

## Notes

- The scripts use a repo-local `.android-home/` folder so `adb` works reliably on this machine.
- JavaScript, styling, and most screen-level changes do not need a new APK.
- Expo `prebuild` is currently failing on this Windows setup with `spawn EPERM`, so for now Android Studio is best used as the emulator/verification target while the dev client handles reloads.
