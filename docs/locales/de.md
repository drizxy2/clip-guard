# Clip Guard

Clip Guard ist eine experimentelle Browsererweiterung. Sie warnt vor verdächtigen Shell-Befehlen, bevor diese in die Zwischenablage geschrieben oder in eine Seite eingefügt werden. Die Heuristik kann Fehlalarme auslösen oder Bedrohungen übersehen; sie ersetzt nicht die Sicherheitsfunktionen des Betriebssystems.

## Installation

Laden Sie die [neueste Version](https://github.com/drizxy2/clip-guard/releases) herunter und entpacken Sie sie.

- **Chrome, Edge, Brave und andere Chromium-Browser:** Öffnen Sie `chrome://extensions` oder `edge://extensions`, aktivieren Sie den Entwicklermodus, wählen Sie **Entpackte Erweiterung laden** und dann den entpackten Ordner mit `manifest.json`.
- **Firefox:** Bis zur Signierung und Veröffentlichung auf AMO laden Sie die Erweiterung vorübergehend über `about:debugging#/runtime/this-firefox`, indem Sie die entpackte `manifest.json` auswählen. Beim Schließen von Firefox wird sie entfernt.

## Schutz und Datenschutz

Der Blockiermodus hält verdächtige Schreib- oder Einfügevorgänge an, bis Sie entscheiden. Der reine Warnmodus erlaubt die Aktion und zeigt einen Hinweis. Clip Guard sendet keine Netzwerkanfragen und speichert niemals den Inhalt der Zwischenablage. Bei aktivierten optionalen lokalen Messungen werden nur Herkunft, Stufe, Gründe und Datum erfasst. Text, der auf Ihre Entscheidung wartet, bleibt vorübergehend im Arbeitsspeicher.

Die Oberfläche folgt der Browsersprache. Technische Einzelheiten finden Sie in der [Projekt-README](../../README.md).
