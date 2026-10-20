# Store and privacy-review inputs

Last reviewed 2026-10-19. These are factual implementation inputs for the owner, store forms, and qualified counsel. They are not completed legal declarations.

## Product facts

- The product is operated by a parent or other adult to create a child's printable reading worksheet.
- It supports profiles from early elementary through adult readers and stores a child name plus reading attributes locally on the device.
- It has no child account, sign-in, social feature, advertising, analytics, location, contacts, camera, microphone, or tracking SDK.
- Real-AI generation sends reading attributes, book metadata, selected skills, and optional free-text parent notes through the hosted relay to OpenAI. The dedicated network payload excludes the child name and local record identifiers.
- Data is encrypted in transit when the production service is served exclusively over HTTPS. Local browser storage and user-downloaded backups are not application-encrypted.
- Local data is user-deletable. Historical worksheet snapshots intentionally retain the profile values used at generation time until the worksheet is deleted.
- The application does not currently offer a cloud account or retain an application database from which an operator can fulfill a server-side deletion request.

## Owner decisions before store submission

- Publisher legal identity, support contact, privacy-policy URL, and countries/regions of availability.
- Intended audience and store age bands. The owner must not infer that an adult-facing interface alone resolves child-directed or mixed-audience status.
- Whether a parent-only gate, consent record, or age screen is required for AI generation.
- Whether OpenAI and the selected host are approved processors for the intended audience and jurisdictions.
- Zero Data Retention approval and project configuration. OpenAI's under-18 guidance makes this a real-AI gate for personal data of children under 13 or the applicable digital-consent age.
- Final retention periods, data-subject/parent request process, incident contact, and policy wording.
- Whether book titles, optional free-text notes, or reading attributes are categorized as user content, identifiers, sensitive information, or linked data in each store's current form.

## Apple review worksheet

Apple requires App Store Connect privacy details to cover the app and integrated third-party partners. The owner should evaluate these likely entries against the final build:

- Name: stored locally and excluded from the P03 network payload.
- Other user content: parent summary and notes are collected by the relay/OpenAI for app functionality when real AI is enabled.
- Other data: reading profile attributes, book metadata, progress, and selected skills are collected for app functionality.
- Tracking: none implemented.
- Data linked to identity: no account or persistent server identity exists, but the owner must decide the form response using Apple's current definitions and final hosting metadata.

Source: [Apple App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Google Play review worksheet

Google treats off-device transmission as collection for its Data safety form, including transmission to the developer's server and third-party SDKs. The owner should evaluate:

- User IDs: none generated for a cloud account; local record IDs are not transmitted.
- Personal info/name: local only in the implemented request contract; reconfirm with captured deployed network traffic.
- App activity/other user-generated content: parent notes, summaries, reading metadata, and prompt inputs are transmitted for app functionality in real-AI mode.
- Encryption in transit: yes only after deployed HTTPS verification.
- Deletion: local deletion is available; there is no account or application database. Provider/host retention still requires an accurate policy answer.
- Ads and analytics: none.

If any target-audience age group includes children, Google Play Families requirements apply and the store answers must disclose relevant collection. Source: [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) and [Families Policy Requirements](https://support.google.com/googleplay/android-developer/answer/9893335).

## COPPA review worksheet

The FTC evaluates child-directed status using multiple factors, including subject matter, presentation, intended and actual audience, and marketing. The owner and qualified counsel must decide whether the service is child-directed, mixed-audience, or general-audience and what notice, verifiable parental consent, access/deletion rights, security, and retention controls follow.

The fact that a parent types the information or that the UI is parent-facing is relevant context, not a legal conclusion. Source: [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) and [FTC COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
