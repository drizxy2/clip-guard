# Clip Guard

Clip Guard na beta browser extension wey dey warn you before suspicious shell command enter clipboard or paste for page. The way e dey check fit give wrong warning or miss some danger; e no replace your operating system security.

## How to install

Download and unzip the [latest release](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave, and other Chromium browsers:** open `chrome://extensions` or `edge://extensions`, turn on Developer mode, choose **Load unpacked**, then select the unzipped folder wey get `manifest.json`.
- **Firefox:** until AMO sign and publish the add-on, load am temporary for `about:debugging#/runtime/this-firefox` by choosing the unzipped `manifest.json`. Firefox go remove temporary add-on when you close am.

## Protection and privacy

Block mode stop suspicious write or paste till you decide. Warn-only mode allow am and show warning. Clip Guard no dey make network request and e no dey save clipboard text. If you turn on optional local measurement, e record only origin, level, reasons, and date. Text wey dey wait for your decision stay for memory for small time.

The extension follow your browser language. See the [project README](../../README.md) for technical details.
