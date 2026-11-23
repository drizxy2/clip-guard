# Clip Guard

Clip Guard is an experimental browser extension that warns about suspicious shell commands before they are written to the clipboard or pasted into a page. Its heuristics can produce false positives or miss threats; it does not replace operating-system security controls.

## Install

Download and extract the [latest release](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave, and other Chromium browsers:** open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
- **Firefox:** until the add-on is signed and published on AMO, load it temporarily at `about:debugging#/runtime/this-firefox` by selecting the extracted `manifest.json`. Temporary add-ons are removed when Firefox closes.

## Protection and privacy

Block mode stops suspicious clipboard writes or pastes until you decide. Warn-only mode allows the action and shows a warning. Clip Guard makes no network requests and never saves clipboard text. If optional local measurements are enabled, only the origin, alert level, reasons, and date are recorded. Text awaiting your decision remains in memory temporarily.

The interface follows your browser language. See the [project README](../../README.md) for technical details.
