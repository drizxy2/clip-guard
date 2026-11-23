# Clipboard blocking results

## Classifier

| Corpus | Before | After |
| --- | --- | --- |
| Benign full corpus | 8/175 false positives (4.6%) | 0/175 false positives (0%) |
| Simulated suspicious corpus | 79/79 detected (100%; 78 high) | 79/79 detected (100%; 78 high) |
| Dev benign | — | 0/140 false positives |
| Dev malicious | — | 56/56 detected |
| Holdout benign | — | 0/50 false positives |
| Holdout malicious | — | 23/23 detected (22 high) |

The classifier change narrows uncorroborated `curl`/`wget` installer-pipe matches; corroborating suspicious signals continue to trigger detection.

## Integration results

- Unit and classifier tests: 32/32 passed, including i18n key checks.
- Chromium legacy E2E: 22/22 passed.
- Chromium blocking E2E: 16/16 passed, including block, event reporting, warn-only, benign copies, iframe context, Escape, and allowing a retained `ClipboardItem` while preserving both `text/plain` and `text/html`.
- Chromium enhancement E2E: 18/18 passed, including localized copy/paste confirmations, suspicious paste decisions for input/textarea/contenteditable, beforeinput/drop, nested iframes, warning-only mode, accessibility, and the preference toggle.
- Firefox E2E: 6/6 passed.
- Firefox enhancement E2E: 18/18 passed, including actual shadow-DOM toast and prompt text in pt-BR, en-US, and es-ES, benign paste insertion, blocked-paste approval, warn-only mode, toast deduplication, Escape, and iframe toast deduplication. Chromium E2E covers the unsupported-language fallback to en and the preference toggle.
- Firefox extension lint: 0 errors, 0 notices; 2 existing minimum-version warnings.

The Chromium and Firefox E2E suites ran with the extension loaded in Playwright. No jsdom fallback or manual checklist was needed.

## Intercepted paths

- `navigator.clipboard.writeText(text)`
- `navigator.clipboard.write(items)`, classifying each item's `text/plain`
- `document.execCommand("copy")` and `document.execCommand("cut")`
- `DataTransfer.prototype.setData("text/plain", ...)` during `copy` and `cut` events
- `paste` in capture phase, plus `beforeinput` (`insertFromPaste`) and text-readable `drop`

Suspicious writes are blocked by default; the retained original operation is invoked only after the user selects “Permitir mesmo assim”. “Manter bloqueado” and Escape leave the clipboard unchanged. Suspicious paste is stopped before insertion; “Colar mesmo assim” inserts plain text into the original input/textarea/contenteditable. Warn-only mode permits paste and displays a non-modal warning. Benign copy/paste content is not persisted; the same classifier corpus applies to both paths: 0/175 benign false positives and 79/79 simulated suspicious detections.

## Release

`dist/clip-guard.zip` SHA-256: `d1b2de57d75c39e492fa08d71c9cf4cd20bd1e6ceef5810f5afdb794ade99d03`
