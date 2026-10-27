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

## 1. Add OpenAI keys

The production release currently deploys with `AI_PROVIDER=mock`. Adding an
OpenAI key prepares the Worker for a later reviewed provider change, but does
not enable live OpenAI requests by itself. Do not put the key in GitHub Actions,
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

### Enable OpenAI only after the web-only review

Adding the secrets is safe preparation. Activation requires a reviewed code
change because `.github/workflows/release.yml` deliberately fixes
`AI_PROVIDER=mock` and currently includes native origins. Before activation:

1. Change the release environment to `AI_PROVIDER=openai`.
2. Set `APP_ALLOWED_ORIGINS` to the exact production web origin only. Remove
   `https://localhost` and `capacitor://localhost`; native OpenAI traffic is
   rejected until verified device attestation exists.
3. Set `AI_MONTHLY_BUDGET_USD`, `AI_INSTALLATION_MONTHLY_LIMIT`, and
   `AI_IP_MONTHLY_LIMIT` to the approved launch limits.
4. Deploy one reviewed release and send one synthetic request containing no
   child name, notes, response, or other personal information.
5. Confirm the response metadata reports the expected provider, inspect the
   OpenAI project usage, and verify that browser and Android assets contain no
   key.
6. If verification fails, restore `AI_PROVIDER=mock` immediately. Follow
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

3. Wait for **Verify release commit**, **Build Android APK**, and
   **Deploy and probe Cloudflare** to pass.
4. Open the public Worker URL and create one deterministic mock worksheet.
5. If deployment must be stopped, change `ENABLE_PRODUCTION_DEPLOY` to `false`.
   Android artifacts and validation continue, while Cloudflare deployment is
   skipped.

The `production` GitHub environment may have optional reviewers. Adding a
required reviewer creates a manual approval for every deployment, so leave the
environment without required reviewers when fully automatic mock deployment is
desired.

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
