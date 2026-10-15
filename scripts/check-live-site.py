#!/usr/bin/env python3
"""Check that the public Harbour House site and its local assets are available."""

from html.parser import HTMLParser
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen


SITE_URL = "https://bgibbo.github.io/harbour-house-preview/"
TIMEOUT_SECONDS = 25
RETRIES = 3


class PageAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.resources = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.resources.append(attributes["src"])
        elif tag == "link" and "stylesheet" in attributes.get("rel", "").lower().split():
            if attributes.get("href"):
                self.resources.append(attributes["href"])

    def handle_data(self, data):
        self.text_parts.append(data)


def fetch(url):
    last_error = None
    for attempt in range(RETRIES):
        try:
            request = Request(
                url,
                headers={"Cache-Control": "no-cache", "User-Agent": "HarbourHouseSiteMonitor/1.0"},
            )
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                status = response.status
                body = response.read()
            if status != 200:
                raise RuntimeError(f"HTTP {status} for {url}")
            return body
        except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
            last_error = error
            if attempt + 1 < RETRIES:
                sleep(2 ** attempt)
    raise RuntimeError(f"Request failed after {RETRIES} attempts: {last_error}") from last_error


def main():
    page = fetch(SITE_URL).decode("utf-8", errors="replace")
    parsed = PageAssets()
    parsed.feed(page)
    visible_content = " ".join(" ".join(parsed.text_parts).split()).casefold()

    for expected in ("3 harbour house", "dunmore east"):
        if expected not in visible_content:
            raise RuntimeError(f"Expected identifying content is missing: {expected}")

    site_origin = urlsplit(SITE_URL).netloc
    local_resources = []
    for resource in parsed.resources:
        absolute_url = urljoin(SITE_URL, resource)
        if urlsplit(absolute_url).netloc == site_origin:
            local_resources.append(absolute_url)

    local_scripts = [url for url in local_resources if urlsplit(url).path.endswith(".js")]
    local_stylesheets = [url for url in local_resources if urlsplit(url).path.endswith(".css")]
    if not local_scripts or not local_stylesheets:
        raise RuntimeError("The page did not expose both local JavaScript and CSS resources")

    checked = []
    for resource_url in dict.fromkeys(local_scripts + local_stylesheets):
        fetch(resource_url)
        checked.append(urlsplit(resource_url).path)

    print(f"PASS: {SITE_URL} returned HTTP 200 and still identifies 3 Harbour House in Dunmore East.")
    print("PASS: local JavaScript and CSS resources returned HTTP 200:")
    for path in checked:
        print(f"  - {path}")


if __name__ == "__main__":
    main()
