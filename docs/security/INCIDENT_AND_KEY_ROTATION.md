# Incident response and key rotation

Use this runbook for suspected OpenAI-key exposure, unexpected content logging, unauthorized traffic, cost spikes, or disclosure of parent/child data. Do not paste secrets, request bodies, notes, names, or provider responses into tickets or chat.

## Immediate containment

1. Set the deployment to `AI_PROVIDER=mock` or disable the prompt route at the host. Verify prompt generation falls back without using OpenAI.
2. If a key may be exposed, revoke it in the OpenAI project immediately. Do not wait to prove use.
3. Pause or restrict the deployment if request bodies or sensitive headers entered logs. Preserve access to the affected log system without copying content into a broader location.
4. Record the detection time, affected environment, approximate request window, error category, and responders. Use identifiers only where needed for containment.

## Investigation

1. Determine which boundary was affected: device storage, downloaded backup/PDF, browser-to-relay traffic, host/CDN logs, relay-to-OpenAI traffic, source control, CI, or operator workstation.
2. Review provider usage, spend, and audit metadata. Do not inspect customer content unless necessary, authorized, and consistent with the approved privacy posture.
3. Establish the earliest and latest possible exposure times, data categories involved, affected count, and whether the data was actually accessed.
4. Check repository history and built artifacts for the secret. Never rewrite shared history or delete evidence without an incident-owner decision.
5. Engage the owner and qualified legal/privacy counsel for notification, regulator, contractual, or child-safety decisions. This runbook does not decide those obligations.

## OpenAI key rotation

1. Create a replacement key in the dedicated production OpenAI project with the smallest available scope and budget.
2. Put the replacement in the host's encrypted secret store. Never place it in a `NEXT_PUBLIC_` variable, client bundle, repository file, command history, or issue.
3. deploy or restart the relay so it reads the new value.
4. Run one synthetic prompt request containing no personal information. Verify the expected provider/fallback metadata and that logs contain metadata only.
5. Revoke the old key if containment did not already do so.
6. Verify the old key can no longer authenticate and record only the key name or final four-character fingerprint, never the value.

## Recovery and follow-up

1. Keep real AI disabled until the cause is corrected and the owner accepts residual risk.
2. Remove accidentally retained content using the host/provider deletion process when available; document the request and confirmation.
3. Add a regression test or configuration check for the failure mode.
4. Recheck spend limits, rate limits, log redaction, retention, Zero Data Retention status, and least-privilege access.
5. Write a content-free incident summary covering cause, impact, actions, evidence, and remaining human decisions.
