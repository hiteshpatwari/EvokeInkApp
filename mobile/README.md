# Mobile shell

This workspace builds the existing Read & Reflect React UI as bundled Capacitor
assets. It does not use `server.url` or permit remote WebView navigation.

Set `VITE_PROMPT_API_URL` to the full HTTPS `/api/prompts` endpoint before a
production build. The build rejects a missing, non-HTTPS, credential-bearing,
query-bearing, or fragment-bearing URL. The native bundle contains no provider
credential. Prompt transport failures use deterministic general prompts.

```powershell
$env:VITE_PROMPT_API_URL = "https://example.com/api/prompts"
corepack pnpm mobile:build
corepack pnpm mobile:sync
corepack pnpm mobile:secrets

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& .\mobile\android\gradlew.bat -p .\mobile\android assembleDebug
```

The generated Android project pins `compileSdk` and `targetSdk` to API 36 and
Java source/target compatibility to 21. Android worksheet export uses the
private-cache native share adapter. Canonical application state uses Capacitor
Preferences with verified one-time WebView migration and read-after-write
durability; browser builds continue to use `localStorage`.
