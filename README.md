# Harbour House hosted preview

This repository contains the static browser assets for the Harbour House website hosted at GitHub Pages. The private development repository remains the source of truth.

The page is marked noindex, but this is a public preview URL. Do not add credentials, private guest information, or server configuration here.

Availability is still sample data. Enquiries are sent through the public Google Apps Script endpoint in `enquiry-config.js`. The website confirms delivery by polling a status-only JSONP route; the Apps Script project must be updated and its existing `/exec` deployment redeployed to enable that route. The script sends to the owner and acknowledges the guest without creating a Calendar event. Never put credentials or tokens in this repository.
