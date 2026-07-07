#!/usr/bin/env python3
"""
Convert upstream classical-format rulesets to domain-format text files.

classical lines like:
  DOMAIN-SUFFIX,example.com    -> .example.com
  DOMAIN,example.com           -> example.com
  DOMAIN-KEYWORD,xxx           -> skipped (not representable in domain format)
  IP-CIDR,xxx                  -> skipped
  # comment                    -> skipped
"""

import os
import re
import urllib.request

RULESETS = {
    "TikTok": "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/TikTok.list",
    "SteamFix": "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/SteamFix.list",
    "AdditionalFilter": "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalFilter.list",
    "AdditionalCDNResources": "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalCDNResources.list",
    "Crypto": "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/Crypto.list",
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "ruleset", "converted")


def convert_line(line: str) -> str | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    # DOMAIN-SUFFIX,example.com -> .example.com
    m = re.match(r"^DOMAIN-SUFFIX,\s*(.+)$", line, re.IGNORECASE)
    if m:
        domain = m.group(1).strip()
        return f".{domain}" if not domain.startswith(".") else domain

    # DOMAIN,example.com -> example.com
    m = re.match(r"^DOMAIN,\s*(.+)$", line, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # DOMAIN-KEYWORD, IP-CIDR, GEOIP, etc. — not convertible
    return None


def fetch(url: str) -> list[str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8").splitlines()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for name, url in RULESETS.items():
        lines = fetch(url)
        converted = []
        skipped = 0
        for line in lines:
            result = convert_line(line)
            if result:
                converted.append(result)
            else:
                stripped = line.strip()
                if stripped and not stripped.startswith("#"):
                    skipped += 1

        out_path = os.path.join(OUTPUT_DIR, f"{name}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(converted) + "\n")

        print(f"{name}: {len(converted)} domains, {skipped} skipped -> {out_path}")


if __name__ == "__main__":
    main()
