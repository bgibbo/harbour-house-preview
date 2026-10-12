# Harbour House hosted website

This repository contains the static browser assets served by GitHub Pages and embedded in the existing Google Sites website. The private `private source repository` repository is the source of truth.

The browser uses the public Apps Script endpoint only for email submission, confirmation status and sanitized availability date ranges. Calendar access happens in Apps Script under the owner account. The visitor payload contains no Calendar IDs or event details. Keep credentials, private guest data and server configuration out of this public repository.

The live availability endpoint has been verified. It returns only sanitized occupied-night date ranges from the owner-authorized Calendar. The script never creates or changes Calendar events.
