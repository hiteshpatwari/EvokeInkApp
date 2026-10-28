# Release automation

Every push to `main` triggers `.github/workflows/release.yml`. The workflow first
runs its own formatting, lint, type, test, and web-build gate. Only a verified
commit may proceed independently to web deployment and Android packaging. Web
deployment is not blocked by Android signing. When `ENABLE_ANDROID_RELEASE` is
`true`, the mobile job builds signed, non-debuggable, minified release APK and
AAB artifacts, scans both for packaged secrets, records SHA-256 digests, and
keeps them as GitHub Actions artifacts for 30 days. Debug APKs are local-QA
artifacts only and are never published by the release workflow.

Web deployment is opt-in until the repository has its Cloudflare credentials.
When enabled, the same workflow builds and dry-runs the Worker, deploys the
verified commit in deterministic mock mode, and probes the public home, health,
and prompt contracts. The workflow never receives an OpenAI key.

## 1. Add OpenAI keys

The production web release uses the reviewed OpenAI path. Do not put its key in GitHub Actions,
the repository, a local tracked file, a `NEXT_PUBLIC_` variable, the Android
application, or the browser bundle.

### Create a dedicated OpenAI project

1. Sign in to the [OpenAI API Platform](https://platform.openai.com/). API
   billing is separate from a ChatGPT subscription.
2. Open the project selector and select **Create project**.
3. Name the project `Evoke Ink Production`. Keep production usage separate
   from experiments so usage, access, and rotation remain attributable.
4. Open the new project's **Limits** page.
5. Enable only the models the application needs. The current default model in
   `cloudflare.config.ts` is `gpt-5-mini`.
6. Set a monthly spend limit suitable for the initial test population and turn
   on a hard limit if the account offers it. Add lower warning thresholds so an
   owner is notified before the limit is reached. The in-application budget
   must be no higher than the approved provider budget.

OpenAI documents project creation, model limits, spend limits, service accounts,
and keys in [Managing projects in the API platform](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform).

### Create the production key

Use a project service account when available so the production credential does
not depend on an individual team member.

1. While `Evoke Ink Production` is selected, open the project's
   **Members** page.
2. Select **+ Service account**.
3. Name it `evoke-ink-production` and create it.
4. Copy the generated secret key immediately into a password manager. OpenAI
   shows the unredacted value once.
5. Open the project's **API Keys** page and restrict the service-account key to
   only the endpoint permissions required for model inference. Do not grant
   administration, files, fine-tuning, assistants, or unrelated write access.
6. Record an owner and rotation date. Prefer an expiring key and rotate it
   before expiry. OpenAI's current recommendations are in
   [Best practices for API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).

If service accounts are unavailable, create a project-scoped key from
**API Keys → Create new secret key**, choose **Restricted**, and apply the same
least-privilege and expiration rules.

### Store the key in the Cloudflare Worker

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** and select the `evoke-ink-app` Worker.
3. Open **Settings → Variables and Secrets**.
4. Select **Add**.
5. Choose **Secret** as the type, enter `OPENAI_API_KEY` as the name, paste the
   key as the value, and select **Deploy**.
6. Add a second secret named `AI_QUOTA_HASH_SECRET`. Generate a unique random
   value of at least 32 bytes with a password manager or cryptographic secret
   generator. This secret must remain stable across deployments because the
   application uses it to derive privacy-preserving quota identifiers.
7. Confirm that Cloudflare lists both secret names. Cloudflare will not show
   their plaintext values after storage.

Cloudflare's current dashboard procedure is documented under
[Add environment variables via the dashboard](https://developers.cloudflare.com/workers/configuration/environment-variables/#add-environment-variables-via-the-dashboard).

Do not add the optional handwriting-transcription secrets or enable
`HANDWRITING_TRANSCRIPTION_PROVIDER=openai` yet. Live image transcription has
separate approval, quota, privacy, retention, and native-attestation gates.

### Native handwriting transcription activation

The repository now implements request-bound Google Play Integrity verification,
but the feature remains disabled until the store and data-processing approvals
below are complete. A sideloaded APK cannot prove the production
`PLAY_RECOGNIZED` and `LICENSED` verdicts. Complete acceptance with an internal
test build installed from Google Play.

1. In Google Play Console, open Evoke Ink, go to **Protected with Play**, and
   link a Google Cloud project under **Play Integrity API**. Record the numeric
   Cloud project number. Google documents this procedure in
   [Play Integrity setup](https://developer.android.com/google/play/integrity/setup).
2. In that Cloud project, create a dedicated service account for the Worker and
   grant only the permission needed to decode Play Integrity tokens. Create a
   JSON key, copy the `client_email` and `private_key` values into a password
   manager, and delete the downloaded key file after the Worker secrets are
   stored.
3. In **Play Console → Setup → App integrity**, copy the SHA-256 digest for the
   **app signing certificate**, not the upload certificate. Convert the
   fingerprint bytes to unpadded base64url before configuring the Worker. More
   than one comma-separated digest may be supplied during an approved signing
   transition.
4. Add this GitHub repository variable:
   - `PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`: the numeric project number from
     step 1. It is not a secret. Release builds inject it into the Android app.

5. Add these Cloudflare Worker secrets under **Settings → Variables and
   Secrets**:
   - `PLAY_INTEGRITY_SERVICE_ACCOUNT_EMAIL`
   - `PLAY_INTEGRITY_SERVICE_ACCOUNT_PRIVATE_KEY`
   - `HANDWRITING_TRANSCRIPTION_QUOTA_HASH_SECRET`, generated independently
     from the prompt quota secret and kept stable across deployments

6. Keep the shared `AI_MONTHLY_BUDGET_USD` at `$2.70` or lower. Prompt
   generation and handwriting transcription reserve against the same atomic
   Worker budget, so their combined application authorization stays below the
   `$3` OpenAI project hard limit. Do not create a larger transcription-only
   budget.
7. Complete and record the owner approvals in
   `docs/security/STORE_PRIVACY_INPUTS.md`: OpenAI under-18 and Zero Data
   Retention posture, Cloudflare body/header logging and retention, published
   privacy policy, Google Play Data safety answers, and a controlled pilot with
   synthetic handwriting.
8. Only after steps 1 through 7, deploy with:
   - `HANDWRITING_TRANSCRIPTION_PROVIDER=openai`
   - `HANDWRITING_TRANSCRIPTION_LIVE_APPROVED=true`
   - `PLAY_INTEGRITY_ENABLED=true`
   - `PLAY_INTEGRITY_PACKAGE_NAME=app.evokeink.mobile`
   - `PLAY_INTEGRITY_CERTIFICATE_SHA256_DIGESTS=<base64url digest>`
   - `HANDWRITING_TRANSCRIPTION_ALLOWED_ORIGINS` set to the two owned web
     origins plus native `https://localhost`

   Keep `APP_ALLOWED_ORIGINS` restricted to the two owned web origins. Prompt
   generation intentionally does not accept the native origin; transcription
   has its own allowlist because Play Integrity protects that separate route.

9. Upload the resulting AAB to Internal testing, install it from Google Play on
   the S24, and run one synthetic answer-photo transcription. Confirm the
   request returns `provider: openai`, `fallback: false`, the OpenAI usage
   increase matches one request, and neither the prepared image nor transcript
   appears in application or host logs.
10. Repeat the same request with a missing token, reused token, altered image,
    and sideloaded build. Each must fail before quota reservation and OpenAI.
    If any check fails, set `HANDWRITING_TRANSCRIPTION_PROVIDER=mock` and deploy
    the rollback immediately.

### Web-only OpenAI activation

The reviewed production release uses `AI_PROVIDER=openai`, a $2.70 application
budget, a conservative $0.03 reservation per generation, a 45-second bounded
provider timeout, no implicit paid retries, a five-request hourly IP limit, a
40-request monthly IP limit, and the two owned web origins:
`https://evokeink.hiteshpatwari.com` and the direct Workers URL. Native origins
remain excluded until verified device attestation exists. For each release:

1. Keep `APP_ALLOWED_ORIGINS` restricted to the two owned production web
   origins.
2. Keep the application budget and installation/IP limits no higher than the
   approved provider controls.
3. Deploy the reviewed release and send one synthetic request containing no
   child name, notes, response, or other personal information.
4. Confirm the response metadata reports `provider: openai` and
   `fallback: false`, inspect the
   OpenAI project usage, and verify that browser and Android assets contain no
   key.
5. If verification fails, restore `AI_PROVIDER=mock` immediately. Follow
   `docs/security/INCIDENT_AND_KEY_ROTATION.md` if a key may have been exposed.

## 2. Add Cloudflare account details

These values allow GitHub Actions to deploy a verified commit. The workflow does
not receive the OpenAI key.

### Find the account ID

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Select the account that owns the `evoke-ink-app` Worker.
3. Open the Worker or the account overview and copy the **Account ID**.
4. Check that the selected account is the same account billed for Workers Paid.
   Do not use a Zone ID.

### Create a least-privilege deployment token

1. In Cloudflare, open **My Profile → API Tokens**. If the account uses
   account-owned service tokens, use **Manage Account → API Tokens** instead.
2. Select **Create Token → Create Custom Token**.
3. Name the token `github-evoke-ink-production-deploy`.
4. Add the account permission **Workers Scripts → Edit**.
5. Limit **Account Resources** to the one account that owns this Worker.
6. Do not add DNS, R2, KV, billing, user-management, or API-token-management
   permissions. This application deploys to its `workers.dev` address and does
   not need a zone route.
7. Set an expiration date and rotation reminder. Do not use client-IP filtering
   unless the GitHub-hosted runner's egress range is deliberately managed.
8. Select **Continue to summary**, verify the resource and permission, then
   select **Create Token**.
9. Copy the token once into a password manager. Cloudflare cannot display the
   token again.

Cloudflare explains creation and one-time secret display in
[Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/),
and defines the permission in
[API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/).

### Add the account values to GitHub

1. Open the GitHub repository
   `hiteshpatwari/EvokeInkApp`.
2. Go to **Settings → Secrets and variables → Actions → Secrets**.
3. Select **New repository secret**.
4. Create `CLOUDFLARE_ACCOUNT_ID` with the copied Cloudflare Account ID.
5. Create `CLOUDFLARE_API_TOKEN` with the deployment token.
6. Open the **Variables** tab.
7. Select **New repository variable**.
8. Create `ENABLE_PRODUCTION_DEPLOY` with the value `true`. Add this variable
   last; it is the switch that allows the deployment job to run.

GitHub's current procedures are documented in
[Using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
and
[Store information in variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

The same setup can be entered from an authenticated GitHub CLI without placing
values in command arguments. Each secret command prompts for its value:

```powershell
gh secret set CLOUDFLARE_ACCOUNT_ID --repo hiteshpatwari/EvokeInkApp
gh secret set CLOUDFLARE_API_TOKEN --repo hiteshpatwari/EvokeInkApp
gh variable set ENABLE_PRODUCTION_DEPLOY --body true --repo hiteshpatwari/EvokeInkApp
```

### Verify the automated deployment

1. Confirm names only; these commands do not print secret values:

   ```powershell
   gh secret list --repo hiteshpatwari/EvokeInkApp
   gh variable list --repo hiteshpatwari/EvokeInkApp
   ```

2. Open **Actions → Release Automation → Run workflow → Run workflow**, or run:

   ```powershell
   gh workflow run release.yml --repo hiteshpatwari/EvokeInkApp
   ```

3. Wait for **Verify release commit** and **Deploy and probe Cloudflare** to
   pass. **Build signed Android release** also runs when
   `ENABLE_ANDROID_RELEASE=true`.
4. Open the public Worker URL and create one deterministic mock worksheet.
5. If deployment must be stopped, change `ENABLE_PRODUCTION_DEPLOY` to `false`.
   Cloudflare deployment is skipped. Android packaging is controlled separately
   by `ENABLE_ANDROID_RELEASE`.

The `production` GitHub environment may have optional reviewers. Adding a
required reviewer creates a manual approval for every deployment, so leave the
environment without required reviewers when fully automatic mock deployment is
desired.

## 3. Configure signed Android releases

Do this before setting `ENABLE_ANDROID_RELEASE=true`. The upload keystore is a
long-lived owner-controlled credential. Losing it can prevent future Play Store
updates; exposing it requires rotation through the applicable Play process.

1. Create the upload keystore on an owner-controlled workstation. Keep the
   generated file outside the repository:

   ```powershell
   keytool -genkeypair -v -keystore evoke-ink-upload.jks -alias evoke-ink-upload -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Store the keystore and passwords in a password manager and an encrypted
   offline backup. Never commit them.
3. Convert the keystore to a single-line base64 value without printing it:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\evoke-ink-upload.jks))) | Set-Clipboard
   ```

4. In GitHub, open **Settings → Environments → production → Environment
   secrets** and create:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
5. Under **Settings → Secrets and variables → Actions → Variables**, create
   `ENABLE_ANDROID_RELEASE` with value `true` only after all four secrets are
   present.
6. Run Release Automation. Download the resulting APK, AAB, and SHA-256 files.
   Verify the APK signature with `apksigner verify --verbose --print-certs` and
   upload the AAB through the Play Console internal-testing track before wider
   distribution.

The workflow reconstructs the keystore only in a unique runner temporary
directory and removes it after the build. The keystore is not uploaded as an
artifact.

## Local Android build and installation

For a signed local release, set `ANDROID_KEYSTORE_FILE`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`,
then build the release APK and AAB and print both SHA-256 digests:

```powershell
pnpm release:android
```

For local QA without release credentials, build an explicitly debug-only APK:

```powershell
pnpm release:android:qa
```

With exactly one authorized Android device connected and release signing
configured, build, install, and launch the signed release APK:

```powershell
pnpm release:android:install
```

The script discovers a local Microsoft Java 21 installation on Windows when
`JAVA_HOME` is unset. It validates `ANDROID_HOME`, builds the mobile bundle,
synchronizes Capacitor, scans the selected artifacts for secrets, assembles the
signed release APK and AAB,
and refuses an ambiguous install when zero or multiple devices are connected.

## Manual boundaries

Automation does not accept store agreements, create or control signing
identities, approve privacy declarations, or judge physical-device usability.
Google Play submission still needs the owner-controlled Play account and release
signing key. iOS still needs an owner-controlled Apple membership, macOS/Xcode,
signing, and TestFlight or App Store submission. Physical-device checks for
camera/gallery behavior, PDF sharing, enlarged text, and safe areas remain human
release acceptance.

Follow `docs/GOOGLE_PLAY_RELEASE_RUNBOOK.md` for the complete Google Play app
creation, policy declaration, internal/closed testing, certification, production
submission, monitoring, and rollback process.
