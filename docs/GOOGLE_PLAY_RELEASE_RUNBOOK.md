# Google Play release and certification runbook

Last verified against Google Play documentation: 2026-10-27.

Use this runbook to publish Evoke Ink through Google Play. Start with an
internal test, complete the policy and privacy declarations using the final
release behavior, and promote the same tested bundle only after acceptance
passes. Google can change Play Console navigation and policy questions; recheck
the linked official documentation before every production submission.

This is an operational runbook, not legal advice. The publisher owns the target
audience, privacy, child-directed-service, consent, regional, and data-safety
decisions. Use [Store and privacy-review inputs](security/STORE_PRIVACY_INPUTS.md)
as implementation evidence, then have the final declarations reviewed by a
qualified privacy professional when required.

## 1. Release record

Create one release record before opening Play Console. Record:

| Field                   | Evoke Ink value or action                                             |
| ----------------------- | --------------------------------------------------------------------- |
| Product name            | Evoke Ink                                                             |
| Android package         | `app.evokeink.mobile`                                                 |
| Repository              | `hiteshpatwari/EvokeInkApp`                                           |
| Source commit           | Record the 40-character commit SHA                                    |
| GitHub Actions run      | Record the passing Release Automation URL                             |
| Bundle                  | `app-release.aab` from the commit-specific workflow artifact          |
| Installer for device QA | `app-release.apk` from the same artifact                              |
| Version                 | Current first-release values are `versionCode 1`, `versionName 1.0`   |
| Signing                 | Owner-controlled upload key; Google Play App Signing for distribution |
| Canonical support site  | `https://evokeink.hiteshpatwari.com/`                                 |
| Privacy policy          | Record the final public HTTPS URL; this is a release blocker          |
| Support email           | Record the monitored publisher support address                        |
| Release track           | Internal testing first                                                |

Do not change the package name after creating the Play Console app. It is the
installed application identity. `app.evokeink.mobile` was selected before the
first Play upload so the public product and Android identity remain aligned.

## 2. Go/no-go prerequisites

Do not upload until every item below is true.

- The release workflow passed for the exact commit being submitted.
- The signed AAB and its `.sha256` file were downloaded from the same workflow
  artifact and the hash matches.
- The upload keystore is stored outside the repository in a password manager
  and encrypted offline backup. The alias and passwords are recoverable.
- The production website and privacy-policy URL return HTTPS 200 without login.
- The publisher legal name, public developer name, address where required,
  support email, countries, pricing, and distribution model are decided.
- The target audience and child/family posture are explicitly approved. Do not
  choose age bands merely to maximize availability.
- The final privacy and Data safety answers reflect all off-device transmission,
  including the hosted relay and OpenAI. `store: false` does not mean that no
  data is collected under Google Play's definition.
- Live native handwriting transcription remains declared unavailable unless
  its separate privacy, retention, disclosure, budget, and device-attestation
  gates have been completed.
- At least two physical Android devices or one physical device plus Play's
  device-lab coverage are available for acceptance.

## 3. Download and verify the signed release

1. Open the successful **Release Automation** run for the intended commit.
2. Under **Artifacts**, download the commit-specific artifact named like:

   ```text
   evoke-ink-android-<40-character-commit-sha>
   ```

3. Extract it into a new release folder outside the repository.
4. Verify both files in PowerShell from that folder:

   ```powershell
   Get-FileHash .\apk\release\app-release.apk -Algorithm SHA256
   Get-Content .\apk\release\app-release.apk.sha256
   Get-FileHash .\bundle\release\app-release.aab -Algorithm SHA256
   Get-Content .\bundle\release\app-release.aab.sha256
   ```

5. Confirm each calculated hash equals the corresponding recorded hash.
6. Verify the APK certificate with the Android SDK's `apksigner`:

   ```powershell
   & "$env:ANDROID_HOME\build-tools\<installed-version>\apksigner.bat" verify --verbose --print-certs .\apk\release\app-release.apk
   ```

7. Save the commit SHA, workflow URL, hashes, upload certificate fingerprint,
   and operator name in the release record. Never save the keystore or passwords
   in that record.

Stop if the hash, certificate, package, or commit provenance is uncertain.

## 4. Create the Play Console app

1. Sign in to [Google Play Console](https://play.google.com/console/).
2. Select **Create app**.
3. Enter:
   - App name: **Evoke Ink**
   - Default language: the language used by the initial listing
   - App or game: **App**
   - Free or paid: choose the approved launch model. A free app cannot later be
     changed into a paid app under the same package.
   - Contact email: the monitored publisher support address
4. Enter the package name exactly as `app.evokeink.mobile` if prompted.
5. Accept only declarations the publisher is authorized to accept.
6. Accept the Play App Signing terms and create the app.
7. In **Setup > App integrity**, confirm Play App Signing is active. Use the
   Google-generated app-signing key unless an approved migration requirement
   calls for another option. The existing Evoke Ink keystore remains the upload
   key, not the key Google uses on distributed APKs.
8. Record both the **app signing certificate** and **upload certificate** SHA-256
   fingerprints. Services that validate the Play-installed application normally
   need the app-signing fingerprint, not the upload fingerprint.

Google requires Play App Signing for new applications distributed from Android
App Bundles. See [Upload your app to Play Console](https://developer.android.com/studio/publish/upload-bundle)
and [Sign your app](https://developer.android.com/studio/publish/app-signing).

## 5. Complete the store setup

Follow the app dashboard until no required setup item remains.

### Store settings

1. Choose the approved app category. **Education** is the likely category, but
   the publisher must confirm it against the final listing and product behavior.
2. Add the support email and, if approved, the product website and support phone.
3. Select the intended countries and regions. Start with a narrow pilot if the
   privacy and child-consent posture has not been reviewed globally.

### Main store listing

Prepare and upload:

- App name: **Evoke Ink**
- A short description that accurately describes parent-guided printable reading
  reflection and does not promise grading, factual verification, or guaranteed
  learning outcomes.
- A full description that explains child profiles, tailored prompts, printable
  worksheets, local storage, and any AI behavior enabled in the submitted build.
- A 512 by 512 PNG app icon derived from the approved Evoke Ink mark.
- A 1024 by 500 JPEG or 24-bit PNG feature graphic with no alpha.
- At least two current phone screenshots. Recommended coverage: profile setup,
  prompt creation, generated worksheet, saved reflections, and PDF sharing.
- Tablet screenshots only if the app is intentionally distributed and tested on
  those form factors.

Do not show real child names, notes, book progress, handwritten answers, email
addresses, device identifiers, or API responses in store assets. Use synthetic
sample data. Store assets appear across testing tracks once added. Check the
current [preview-asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
before export.

## 6. Complete App content and policy declarations

Open **Policy and programs > App content**. Save screenshots or exported answers
in the private release record after each declaration.

### Privacy policy

1. Publish a stable, public, non-geoblocked HTTPS privacy policy.
2. Link the same policy inside the app before production certification.
3. Ensure it identifies the publisher, support/privacy contact, local data,
   off-device fields, processors, purposes, retention, deletion/request process,
   security measures, child/parent posture, and change notice.
4. Enter the URL under **Privacy policy**.

Google requires an in-store and in-app privacy-policy link for apps targeting
children. This remains required even when no sensitive data is collected. See
[Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455).

### Ads

The current implementation contains no advertising SDK or advertising. Answer
**No** only after confirming the submitted dependency and runtime behavior still
match that fact.

### App access

The current app has no account or sign-in gate. Declare that all functionality
is accessible without special credentials. If a later build adds a parent gate,
subscription, regional restriction, or login, provide durable reviewer access
instructions that do not expire during review.

### Target audience and content

This is an owner/legal decision, not a mechanical form answer. Evoke Ink stores
a child profile locally and creates reading activities from early-elementary
through adult levels. The interface being parent-operated does not by itself
prove that the service is outside child-directed or mixed-audience rules.

1. Decide the intended audience and marketing posture before choosing age bands.
2. Select only age groups for which the final experience, content, disclosures,
   AI processing, and consent model were designed and reviewed.
3. If any selected group includes children, complete the Families requirements
   and ensure every declaration, SDK, listing asset, and data flow complies.
4. Do not add an artificial age selection solely to avoid a policy category.
5. Record the rationale and reviewer for the decision.

Google reviews whether the declaration matches the app and listing. See
[Target audience and content](https://support.google.com/googleplay/android-developer/answer/9867159)
and the [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335).

### Content rating

1. Start the IARC questionnaire.
2. Answer from the final app and all remotely supplied AI content paths.
3. Use the monitored support email for rating correspondence.
4. Review the generated rating and descriptors for every selected region.
5. Stop and correct answers or product behavior if the result conflicts with
   the intended audience.

### Data safety

Use `docs/security/STORE_PRIVACY_INPUTS.md` and a captured network inventory of
the exact release. Google defines collection broadly as transmitting data off
the device, including ephemeral processing and transmission through a developer
server or third party.

At minimum, evaluate and document:

- Reading-profile attributes, book metadata, progress, selected skills, parent
  summaries, and notes sent for AI prompt generation.
- Student-authored response text if live coaching is enabled.
- Prepared answer images and confirmed transcripts only if live transcription
  is actually enabled and approved for the native release.
- Ordinary connection metadata processed by Cloudflare and upstream providers.
- Whether each field is required or optional, linked to identity, shared, and
  used only for app functionality.
- Encryption in transit, deletion behavior, retention, and third-party handling.

The child name and local record identifiers are excluded from the implemented
AI request contract, but verify this against the deployed native network traffic
before answering. Do not claim that the application collects no data merely
because it has no cloud account or application database. Google requires every
published app to complete the form, although an app active only on internal
testing is currently exempt. See [Data safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469).

### Other declarations

Complete every Play Console item shown under **Needs attention**, including any
news, government, financial, health, advertising-ID, or sensitive-permission
question. Answer from the actual submitted app. The current manifest requests
only Internet access and uses the system file/camera picker rather than direct
camera or broad media permissions; confirm this again after upload.

## 7. Upload to Internal testing

1. Open **Test and release > Testing > Internal testing**.
2. Create the initial internal release.
3. Upload `bundle\release\app-release.aab` from the verified artifact.
4. Confirm Play Console reports:
   - Package `app.evokeink.mobile`
   - Version code `1` for the initial upload
   - Target SDK 36
   - No signing, manifest, device-support, or policy error
5. Enter factual release notes, for example:

   ```text
   Initial internal test of Evoke Ink. Includes local reading profiles,
   tailored reflection prompts, printable worksheets, saved reflections,
   PDF sharing, and response-coaching preparation.
   ```

6. Review warnings. Resolve warnings that affect target devices, policy,
   security, privacy, accessibility, or installation before rollout.
7. Add a tester email list or Google Group. Include the owner plus representative
   adult/parent testers using different supported Android versions and screen
   sizes.
8. Save and roll out the internal release. The first internal release may require
   Google review before testers can receive it.
9. Copy the tester opt-in link and have testers install from Google Play, not by
   sideloading the workflow APK.

Every later upload must have a strictly higher `versionCode`. Update
`mobile/android/app/build.gradle`, commit the change, and use the newly generated
artifact. Google Play will reject a reused version code.

## 8. Certification and device acceptance

Test the Play-installed build. A sideloaded APK does not prove Play signing,
delivery, upgrade, listing, or device-catalog behavior.

For each device, record model, Android version, display size, system font/display
scale, app version, result, and evidence. Verify:

- Clean install, launch, app icon, splash screen, and Evoke Ink branding.
- Home and Saved reflections navigation at standard and enlarged text sizes.
- Child-profile creation across early-elementary, grade-level, advanced, and
  adult-reader settings.
- Profile edits do not mutate profile snapshots on existing worksheets.
- Prompt generation success, rate-limit messaging, timeout, offline behavior,
  and no duplicate charge-inducing submission.
- Native requests do not expose the OpenAI key and are rejected or safely
  handled according to the approved native-provider configuration.
- Notes-specific prompts use only parent-provided facts and general mode does
  not invent book details.
- Per-prompt regeneration visibly changes a prompt or reports an unchanged
  provider result honestly.
- PDF creation, Android share sheet, temporary-file cleanup, print readability,
  and return-to-app behavior.
- Saved-reflection filtering, duplication, deletion, backup export, and restore.
- Typed response coaching and the manual transcript path.
- Photo selection, trim, rotate, replace, retake, and cancellation never retain
  the raw image. Confirm live upload remains unavailable if its release gates
  are not approved.
- App data survives an app update from a lower internal version to a higher one.
- App uninstall removes local application data as Android specifies; document
  that user-exported PDFs and backups are separate files.
- Airplane mode, slow network, interrupted requests, process restart, and device
  rotation produce understandable recovery states.
- No child or parent content appears in Android logs, crash reports, screenshots,
  notifications, analytics, or Play tester feedback unless the tester knowingly
  submits it.

## 9. Review Play-generated evidence

1. Open **Testing > Pre-launch report** after processing completes.
2. Review stability, Android compatibility, performance, accessibility, and
   security findings for every tested device.
3. Inspect **App bundle explorer / Latest releases and bundles** for generated
   APKs, supported devices, exclusions, download size, permissions, and signing.
4. Review **Android vitals** once test traffic exists.
5. Triage each issue as release-blocking, accepted with rationale, or false
   positive with evidence. Do not ignore crawler failures without determining
   whether a real user can encounter them.

Google automatically exercises uploaded artifacts when capacity permits. See
[Pre-launch reports](https://support.google.com/googleplay/android-developer/answer/9842757).

## 10. Closed testing and production access

Check the developer-account creation date and account type in Play Console.
Personal developer accounts created after 2023-11-13 currently must run a closed
test with at least 12 testers continuously opted in for at least 14 days before
applying for production access. Internal testing does not satisfy this gate.

If the gate applies:

1. Complete all app setup and policy declarations.
2. Promote the accepted bundle or upload a higher-version corrected bundle to a
   closed test.
3. Recruit more than 12 testers so one departure does not reset eligibility.
4. Give testers a focused acceptance script and a private feedback channel.
5. Keep at least 12 testers opted in continuously for the entire 14-day period.
6. Review and act on testing feedback. Keep a dated summary because the
   production-access application asks about testing and production readiness.
7. When the Dashboard enables the application, submit truthful production-access
   answers and retain a copy.

Verify the current rule on Google's [personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
before planning dates.

## 11. Submit for production review

1. Resolve every blocking Dashboard and **Publishing overview** item.
2. Reconfirm the privacy policy, Data safety, target audience, content rating,
   ads, app access, countries, pricing, and store listing against the final AAB.
3. Use **Managed publishing** if the publisher wants approval without immediate
   public availability. Internal test tracks are not controlled by managed
   publishing.
4. Create the production release from the exact accepted bundle when Play allows
   promotion, or upload a new higher-version bundle only if required changes were
   made.
5. Add concise release notes without unsupported educational or AI claims.
6. Start with the smallest practical staged rollout after approval. Do not begin
   a wide rollout immediately when production behavior has not been observed.
7. Submit changes for review once. Avoid unrelated edits during review because
   a new submission can restart the review clock.
8. Monitor **Publishing overview** for rejection, requested evidence, policy
   status, and approval. Reviews can exceed seven days in exceptional cases.

## 12. Post-release monitoring and rollback

During internal, closed, and staged production rollout:

- Monitor Android vitals, crash-free users, ANRs, install failures, device
  exclusions, support email, tester feedback, OpenAI spend, Cloudflare errors,
  and application rate-limit events.
- Compare unexpected AI spend with successful prompt-generation counts. Switch
  the web provider to the documented mock rollback if abuse or provider failure
  threatens the approved budget.
- Halt a staged rollout when Play Console permits if the new version is unsafe.
  Google Play does not provide a universal instant rollback to an older version;
  prepare a corrected bundle with a higher `versionCode` when necessary.
- Keep the upload keystore offline. Rotate the upload key through Play Console if
  exposure is suspected; follow `docs/security/INCIDENT_AND_KEY_ROTATION.md` for
  OpenAI, logging, traffic, or child-data incidents.
- Retain the submitted AAB, hashes, commit SHA, workflow URL, declarations,
  listing assets, review correspondence, acceptance evidence, and rollout result
  according to the approved release-record retention policy.

## Release sign-off

| Gate                                           | Owner                   | Evidence                           | Result |
| ---------------------------------------------- | ----------------------- | ---------------------------------- | ------ |
| Source and hosted workflow verified            | Engineering             | Commit and Actions URL             |        |
| AAB hashes and upload signature verified       | Release owner           | Hashes and certificate fingerprint |        |
| Privacy policy and store declarations approved | Publisher/privacy owner | URLs and exported answers          |        |
| Target audience and Families posture approved  | Publisher/legal owner   | Decision record                    |        |
| Play-installed device acceptance passed        | QA/release owner        | Device matrix and evidence         |        |
| Pre-launch report reviewed                     | Engineering/QA          | Triage record                      |        |
| Closed-test gate completed if applicable       | Publisher               | Tester and Play Console evidence   |        |
| Production release approved                    | Publisher               | Publishing overview                |        |
| Staged rollout monitored                       | Release owner           | Vitals and support review          |        |

A production rollout is ready only when every applicable gate has an owner,
evidence, and an explicit pass. An uploaded bundle alone is not certification.
