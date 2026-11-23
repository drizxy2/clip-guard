# Clip Guard

Clip Guard est une extension expérimentale qui signale les commandes shell suspectes avant leur écriture dans le presse-papiers ou leur collage dans une page. Ses heuristiques peuvent produire des faux positifs ou manquer des menaces ; l’extension ne remplace pas les protections du système d’exploitation.

## Installation

Téléchargez et décompressez la [dernière version](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave et autres navigateurs Chromium :** ouvrez `chrome://extensions` ou `edge://extensions`, activez le mode développeur, choisissez **Charger l’extension non empaquetée**, puis sélectionnez le dossier extrait contenant `manifest.json`.
- **Firefox :** en attendant la signature et la publication sur AMO, chargez temporairement l’extension depuis `about:debugging#/runtime/this-firefox` en sélectionnant le `manifest.json` extrait. Elle est supprimée à la fermeture de Firefox.

## Protection et confidentialité

Le mode blocage suspend les écritures ou collages suspects jusqu’à votre décision. Le mode avertissement seul autorise l’action et affiche un avertissement. Clip Guard n’effectue aucune requête réseau et ne conserve jamais le texte du presse-papiers. Si les mesures locales facultatives sont activées, seules l’origine, la gravité, les raisons et la date sont enregistrées. Le texte en attente de votre décision reste temporairement en mémoire.

L’interface suit la langue du navigateur. Consultez le [README du projet](../../README.md) pour les détails techniques.
