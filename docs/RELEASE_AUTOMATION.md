# Release automation

Every push to `main` triggers `.github/workflows/release.yml`. The workflow first
runs its own formatting, lint, type, test, and web-build gate. Only a verified
commit proceeds to the mobile and deployment jobs. It builds the Capacitor
assets, scans them for packaged secrets, creates an Android debug APK, records
its SHA-256 digest, and keeps both files as a GitHub Actions artifact for 30
days.

Web deployment is opt-in until the repository has its Cloudflare credentials.
When enabled, the same workflow builds and dry-runs the Worker, deploys the
verified commit in deterministic mock mode, and probes the public home, health,
and prompt contracts. The workflow never receives an OpenAI key.

## One-time GitHub configuration

Create a Cloudflare API token limited to deploying this Worker. Add these GitHub
repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Then add the repository variable `ENABLE_PRODUCTION_DEPLOY` with value `true`.
Until that variable is enabled, Android artifacts continue to build and the web
deployment job remains skipped.

The `production` GitHub environment may have optional reviewers. Adding a
reviewer creates a manual approval on every deployment, so leave the environment
without required reviewers when fully automatic mock deployment is desired.

## Local Android build and installation

Build an APK and print its path and SHA-256 digest:

```powershell
pnpm release:android
```

With exactly one authorized Android device connected, build, install, and launch
the app:

```powershell
pnpm release:android:install
```

The script discovers a local Microsoft Java 21 installation on Windows when
`JAVA_HOME` is unset. It validates `ANDROID_HOME`, builds the mobile bundle,
synchronizes Capacitor, scans the bundle for secrets, assembles the debug APK,
and refuses an ambiguous install when zero or multiple devices are connected.

## Manual boundaries

Automation does not accept store agreements, create or control signing
identities, approve privacy declarations, or judge physical-device usability.
Google Play submission still needs the owner-controlled Play account and release
signing key. iOS still needs an owner-controlled Apple membership, macOS/Xcode,
signing, and TestFlight or App Store submission. Physical-device checks for
camera/gallery behavior, PDF sharing, enlarged text, and safe areas remain human
release acceptance.
