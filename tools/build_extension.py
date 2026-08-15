"""Package the Colorflower web app into an MV3 Chrome extension (unpacked).

The extension reuses the existing static app verbatim — this script copies the
web assets into `extension/` and writes the MV3 manifest + a tiny background
service worker that opens the full studio in a new tab on toolbar-icon click.

Run from the repo root:  python tools/build_extension.py
Then load `extension/` via chrome://extensions -> Developer mode -> Load unpacked.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"

# Single source of truth for the version — read it from app.js.
APP_JS = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
VERSION = re.search(r"APP_VERSION\s*=\s*'([\d.]+)'", APP_JS).group(1)

COPY = ["index.html", "src", "core", "vendor", "data", "assets", "site.webmanifest"]

MANIFEST = {
    "manifest_version": 3,
    "name": "Colorflower — Color Picker",
    "short_name": "Colorflower",
    "version": VERSION,
    "description": "Flower-native color picker and color system studio.",
    "icons": {
        "16": "assets/icons/icon-16.png",
        "32": "assets/icons/icon-32.png",
        "48": "assets/icons/icon-48.png",
        "128": "assets/icons/icon-128.png",
    },
    "action": {
        "default_title": "Open Colorflower",
        "default_icon": {
            "16": "assets/icons/icon-16.png",
            "32": "assets/icons/icon-32.png",
        },
    },
    "background": {"service_worker": "background.js"},
}

BACKGROUND = """// Open the full Colorflower studio in a new tab when the toolbar icon is clicked.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
"""


def main():
    if EXT.exists():
        shutil.rmtree(EXT)
    EXT.mkdir(parents=True)

    for item in COPY:
        src = ROOT / item
        dst = EXT / item
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    (EXT / "manifest.json").write_text(json.dumps(MANIFEST, indent=2), encoding="utf-8")
    (EXT / "background.js").write_text(BACKGROUND, encoding="utf-8")

    print(f"Built extension v{VERSION} at {EXT}")
    for p in sorted(EXT.rglob("*")):
        if p.is_file():
            print(f"  {p.relative_to(EXT)}")


if __name__ == "__main__":
    main()
