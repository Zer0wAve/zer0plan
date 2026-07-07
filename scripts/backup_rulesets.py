#!/usr/bin/env python3
"""
Backup upstream rulesets to local backup/ directory.
If upstream repos disappear, we still have copies to reference.
"""

import os
import urllib.request

# (name, url, output_filename)
# Sources: 217heidai, skk.moe, powerfullz, Loyalsoldier, xishang0128
RULESETS = [
    ("ADBlock", "https://cdn.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.yaml", "ADBlock.yaml"),
    ("StaticResources", "https://ruleset.skk.moe/Clash/domainset/cdn.txt", "StaticResources.txt"),
    ("CDNResources", "https://ruleset.skk.moe/Clash/non_ip/cdn.txt", "CDNResources.txt"),
    ("TikTok", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/TikTok.list", "TikTok.list"),
    ("EHentai", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/EHentai.list", "EHentai.list"),
    ("SteamFix", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/SteamFix.list", "SteamFix.list"),
    ("GoogleFCM", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/FirebaseCloudMessaging.list", "FirebaseCloudMessaging.list"),
    ("AdditionalFilter", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalFilter.list", "AdditionalFilter.list"),
    ("AdditionalCDNResources", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalCDNResources.list", "AdditionalCDNResources.list"),
    ("Crypto", "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/Crypto.list", "Crypto.list"),
    ("GFWList", "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt", "GFWList.yaml"),
    ("BiliIntl", "https://cdn.jsdelivr.net/gh/xishang0128/rules@main/biliintl.list", "BiliIntl.list"),
]

BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "backup")


def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    success = 0
    failed = []

    for name, url, filename in RULESETS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read()
            out_path = os.path.join(BACKUP_DIR, filename)
            with open(out_path, "wb") as f:
                f.write(content)
            print(f"OK   {name}: {len(content)} bytes -> {filename}")
            success += 1
        except Exception as e:
            print(f"FAIL {name}: {e}")
            failed.append(name)

    print(f"\n{success}/{len(RULESETS)} backed up successfully")
    if failed:
        print(f"Failed: {', '.join(failed)}")
        # Exit 1 so GitHub Actions marks the run as failed
        exit(1)


if __name__ == "__main__":
    main()
