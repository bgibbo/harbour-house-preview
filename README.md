# Harbour House hosted website

This repository contains the static browser assets served by GitHub Pages and embedded in the existing Google Sites website. The private source repository is the source of truth.

The browser uses the public Apps Script endpoint only for email submission, confirmation status and sanitized availability date ranges. Calendar access happens in Apps Script under the owner account. The visitor payload contains no Calendar IDs or event details. Keep credentials, private guest data and server configuration out of this public repository.

## Security monitoring

The `Website security monitor` GitHub Actions workflow records the SHA, author, commit time, changed paths, and website/executable/configuration paths for every push to `main`. This is an audit trail, not an automatic malware verdict or rollback.

Once daily at 08:17 UTC, the workflow checks that the public GitHub Pages URL responds with HTTP 200, still contains the 3 Harbour House and Dunmore East identity text, and can serve the page's local JavaScript and CSS. A failed check makes the Actions run fail and remains visible in the repository's Actions history. GitHub notifications can also be delivered to repository watchers who enable Actions failure notifications in their GitHub notification settings; no email service credentials are stored here.

To recover from a bad change, use the audit run to identify the commit, inspect the commit history for the last known-good SHA, then create a revert commit (`git revert <bad-commit-sha>`) and push it to `main`. The monitor never changes the repository or rolls the site back automatically.

The live availability endpoint has been verified. It returns only sanitized occupied-night date ranges from the owner-authorized Calendar. The script never creates or changes Calendar events.
