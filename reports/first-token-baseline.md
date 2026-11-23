# Baseline antes do sinal de primeiro token

Executado com `src/classifier.js` no estado de trabalho atual, antes das alterações desta tarefa. Cada taxa é contagem/total; no `real-sim` não há amostras benignas, portanto FP = 0/0 (n/a). Erros são listados por posição e categoria/notas, sem reproduzir o conteúdo do clipboard.

## dev

- Amostras benignas: 140; amostras simuladas maliciosas: 56.
- FP: 6/140 (4.29%).
- FN: 0/56 (0.00%).
- Erros:
  - FP benigno #1 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #2 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #3 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #4 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #5 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #6 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - Nenhum FN.

## holdout

- Amostras benignas: 50; amostras simuladas maliciosas: 23.
- FP: 2/50 (4.00%).
- FN: 0/23 (0.00%).
- Erros:
  - FP benigno #1 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - FP benigno #2 (ambiguous): low; motivos: curl/wget para shell, encadeamento |.
  - Nenhum FN.

## real-sim

- Amostras benignas: 0; amostras simuladas maliciosas: 7.
- FP: 0/0 (n/a).
- FN: 0/7 (0.00%).
- Erros:
  - Nenhum FP.
  - Nenhum FN.

## Evasões de primeiro token

Taxa = casos não classificados como `none`; este baseline fixa os resultados antes da mudança para comparação com os mesmos textos após a implementação.

| Caso | Nível | Score | Motivos |
| --- | --- | ---: | --- |
| sem prefixo | high | 5 | cmd /c, encadeamento && |
| prefixo isca (set/echo/cd) | high | 5 | cmd /c, encadeamento && |
| espaços + aspas + @/& | none | 0 | nenhum |
| comentário REM antes do comando | high | 5 | cmd /c, encadeamento && |
| nova linha inicial | high | 5 | cmd /c, encadeamento && |

## Nível basal por amostra

Tabela sem texto do clipboard, usada para listar qualquer mudança de nível após a regra.

| Conjunto | # | Categoria | Identificação | Nível |
| --- | ---: | --- | --- | --- |
| dev benign | 1 | ambiguous |  | low |
| dev benign | 2 | ambiguous |  | low |
| dev benign | 3 | ambiguous |  | low |
| dev benign | 4 | ambiguous |  | low |
| dev benign | 5 | ambiguous |  | low |
| dev benign | 6 | ambiguous |  | low |
| dev benign | 7 | bash |  | none |
| dev benign | 8 | bash |  | none |
| dev benign | 9 | bash |  | none |
| dev benign | 10 | bash |  | none |
| dev benign | 11 | bash |  | none |
| dev benign | 12 | bash |  | none |
| dev benign | 13 | code |  | none |
| dev benign | 14 | code |  | none |
| dev benign | 15 | code |  | none |
| dev benign | 16 | code |  | none |
| dev benign | 17 | code |  | none |
| dev benign | 18 | code |  | none |
| dev benign | 19 | code |  | none |
| dev benign | 20 | code |  | none |
| dev benign | 21 | code |  | none |
| dev benign | 22 | code |  | none |
| dev benign | 23 | code |  | none |
| dev benign | 24 | containers |  | none |
| dev benign | 25 | containers |  | none |
| dev benign | 26 | containers |  | none |
| dev benign | 27 | containers |  | none |
| dev benign | 28 | containers |  | none |
| dev benign | 29 | containers |  | none |
| dev benign | 30 | containers |  | none |
| dev benign | 31 | containers |  | none |
| dev benign | 32 | containers |  | none |
| dev benign | 33 | containers |  | none |
| dev benign | 34 | containers |  | none |
| dev benign | 35 | containers |  | none |
| dev benign | 36 | containers |  | none |
| dev benign | 37 | containers |  | none |
| dev benign | 38 | containers |  | none |
| dev benign | 39 | containers |  | none |
| dev benign | 40 | containers |  | none |
| dev benign | 41 | data |  | none |
| dev benign | 42 | data |  | none |
| dev benign | 43 | data |  | none |
| dev benign | 44 | data |  | none |
| dev benign | 45 | data |  | none |
| dev benign | 46 | data |  | none |
| dev benign | 47 | data |  | none |
| dev benign | 48 | documentation |  | none |
| dev benign | 49 | documentation |  | none |
| dev benign | 50 | documentation |  | none |
| dev benign | 51 | documentation |  | none |
| dev benign | 52 | documentation |  | none |
| dev benign | 53 | documentation |  | none |
| dev benign | 54 | documentation |  | none |
| dev benign | 55 | documentation |  | none |
| dev benign | 56 | documentation |  | none |
| dev benign | 57 | documentation |  | none |
| dev benign | 58 | git |  | none |
| dev benign | 59 | git |  | none |
| dev benign | 60 | git |  | none |
| dev benign | 61 | git |  | none |
| dev benign | 62 | git |  | none |
| dev benign | 63 | git |  | none |
| dev benign | 64 | git |  | none |
| dev benign | 65 | git |  | none |
| dev benign | 66 | git |  | none |
| dev benign | 67 | git |  | none |
| dev benign | 68 | git |  | none |
| dev benign | 69 | git |  | none |
| dev benign | 70 | git |  | none |
| dev benign | 71 | git |  | none |
| dev benign | 72 | install |  | none |
| dev benign | 73 | install |  | none |
| dev benign | 74 | install |  | none |
| dev benign | 75 | install |  | none |
| dev benign | 76 | install |  | none |
| dev benign | 77 | install |  | none |
| dev benign | 78 | install |  | none |
| dev benign | 79 | install |  | none |
| dev benign | 80 | install |  | none |
| dev benign | 81 | install |  | none |
| dev benign | 82 | install |  | none |
| dev benign | 83 | install |  | none |
| dev benign | 84 | install |  | none |
| dev benign | 85 | install |  | none |
| dev benign | 86 | install |  | none |
| dev benign | 87 | install |  | none |
| dev benign | 88 | install |  | none |
| dev benign | 89 | install |  | none |
| dev benign | 90 | install |  | none |
| dev benign | 91 | install |  | none |
| dev benign | 92 | install |  | none |
| dev benign | 93 | install |  | none |
| dev benign | 94 | logs-and-paths |  | none |
| dev benign | 95 | logs-and-paths |  | none |
| dev benign | 96 | logs-and-paths |  | none |
| dev benign | 97 | logs-and-paths |  | none |
| dev benign | 98 | logs-and-paths |  | none |
| dev benign | 99 | logs-and-paths |  | none |
| dev benign | 100 | logs-and-paths |  | none |
| dev benign | 101 | personal-data-examples |  | none |
| dev benign | 102 | personal-data-examples |  | none |
| dev benign | 103 | personal-data-examples |  | none |
| dev benign | 104 | personal-data-examples |  | none |
| dev benign | 105 | personal-data-examples |  | none |
| dev benign | 106 | personal-data-examples |  | none |
| dev benign | 107 | powershell |  | none |
| dev benign | 108 | powershell |  | none |
| dev benign | 109 | powershell |  | none |
| dev benign | 110 | powershell |  | none |
| dev benign | 111 | powershell |  | none |
| dev benign | 112 | powershell |  | none |
| dev benign | 113 | powershell |  | none |
| dev benign | 114 | powershell |  | none |
| dev benign | 115 | powershell |  | none |
| dev benign | 116 | powershell |  | none |
| dev benign | 117 | recipes-and-text |  | none |
| dev benign | 118 | recipes-and-text |  | none |
| dev benign | 119 | recipes-and-text |  | none |
| dev benign | 120 | recipes-and-text |  | none |
| dev benign | 121 | recipes-and-text |  | none |
| dev benign | 122 | recipes-and-text |  | none |
| dev benign | 123 | recipes-and-text |  | none |
| dev benign | 124 | recipes-and-text |  | none |
| dev benign | 125 | recipes-and-text |  | none |
| dev benign | 126 | clickfix-benign-curl |  | none |
| dev benign | 127 | clickfix-benign-curl |  | none |
| dev benign | 128 | clickfix-benign-curl |  | none |
| dev benign | 129 | clickfix-benign-curl |  | none |
| dev benign | 130 | clickfix-benign-curl |  | none |
| dev benign | 131 | clickfix-benign-cmd |  | none |
| dev benign | 132 | clickfix-benign-cmd |  | none |
| dev benign | 133 | clickfix-benign-cmd |  | none |
| dev benign | 134 | clickfix-benign-cmd |  | none |
| dev benign | 135 | clickfix-benign-cmd |  | none |
| dev benign | 136 | clickfix-benign-for-f |  | none |
| dev benign | 137 | clickfix-benign-for-f |  | none |
| dev benign | 138 | clickfix-benign-for-f |  | none |
| dev benign | 139 | clickfix-benign-certutil |  | none |
| dev benign | 140 | clickfix-benign-certutil |  | none |
| dev malicious | 1 | base64-long |  | high |
| dev malicious | 2 | base64-long |  | high |
| dev malicious | 3 | base64-long |  | high |
| dev malicious | 4 | base64-long |  | high |
| dev malicious | 5 | bitsadmin |  | high |
| dev malicious | 6 | bitsadmin |  | high |
| dev malicious | 7 | bitsadmin |  | high |
| dev malicious | 8 | bitsadmin |  | high |
| dev malicious | 9 | certutil |  | high |
| dev malicious | 10 | certutil |  | high |
| dev malicious | 11 | certutil |  | high |
| dev malicious | 12 | certutil |  | high |
| dev malicious | 13 | cmd-chain |  | high |
| dev malicious | 14 | cmd-chain |  | high |
| dev malicious | 15 | cmd-chain |  | high |
| dev malicious | 16 | cmd-chain |  | high |
| dev malicious | 17 | cmd-chain |  | high |
| dev malicious | 18 | cmd-chain |  | high |
| dev malicious | 19 | cmd-chain |  | high |
| dev malicious | 20 | curl-pipe |  | high |
| dev malicious | 21 | curl-pipe |  | high |
| dev malicious | 22 | curl-pipe |  | high |
| dev malicious | 23 | curl-pipe |  | high |
| dev malicious | 24 | curl-pipe |  | high |
| dev malicious | 25 | curl-pipe |  | high |
| dev malicious | 26 | mshta |  | high |
| dev malicious | 27 | mshta |  | high |
| dev malicious | 28 | mshta |  | high |
| dev malicious | 29 | mshta |  | high |
| dev malicious | 30 | multiline-and-spaces |  | high |
| dev malicious | 31 | multiline-and-spaces |  | high |
| dev malicious | 32 | multiline-and-spaces |  | high |
| dev malicious | 33 | multiline-and-spaces |  | high |
| dev malicious | 34 | multiline-and-spaces |  | high |
| dev malicious | 35 | multiline-and-spaces |  | high |
| dev malicious | 36 | powershell-download-or-iex |  | high |
| dev malicious | 37 | powershell-download-or-iex |  | high |
| dev malicious | 38 | powershell-download-or-iex |  | high |
| dev malicious | 39 | powershell-download-or-iex |  | high |
| dev malicious | 40 | powershell-download-or-iex |  | high |
| dev malicious | 41 | powershell-download-or-iex |  | high |
| dev malicious | 42 | powershell-download-or-iex |  | high |
| dev malicious | 43 | powershell-encoded |  | high |
| dev malicious | 44 | powershell-encoded |  | high |
| dev malicious | 45 | powershell-encoded |  | high |
| dev malicious | 46 | powershell-encoded |  | high |
| dev malicious | 47 | powershell-encoded |  | high |
| dev malicious | 48 | powershell-encoded |  | high |
| dev malicious | 49 | powershell-encoded |  | high |
| dev malicious | 50 | powershell-encoded |  | high |
| dev malicious | 51 | utility-mix |  | high |
| dev malicious | 52 | utility-mix |  | high |
| dev malicious | 53 | utility-mix |  | high |
| dev malicious | 54 | utility-mix |  | high |
| dev malicious | 55 | utility-mix |  | high |
| dev malicious | 56 | utility-mix |  | high |
| holdout benign | 1 | ambiguous |  | low |
| holdout benign | 2 | ambiguous |  | low |
| holdout benign | 3 | bash |  | none |
| holdout benign | 4 | bash |  | none |
| holdout benign | 5 | code |  | none |
| holdout benign | 6 | code |  | none |
| holdout benign | 7 | code |  | none |
| holdout benign | 8 | code |  | none |
| holdout benign | 9 | containers |  | none |
| holdout benign | 10 | containers |  | none |
| holdout benign | 11 | containers |  | none |
| holdout benign | 12 | containers |  | none |
| holdout benign | 13 | containers |  | none |
| holdout benign | 14 | containers |  | none |
| holdout benign | 15 | containers |  | none |
| holdout benign | 16 | data |  | none |
| holdout benign | 17 | data |  | none |
| holdout benign | 18 | data |  | none |
| holdout benign | 19 | documentation |  | none |
| holdout benign | 20 | documentation |  | none |
| holdout benign | 21 | documentation |  | none |
| holdout benign | 22 | documentation |  | none |
| holdout benign | 23 | git |  | none |
| holdout benign | 24 | git |  | none |
| holdout benign | 25 | git |  | none |
| holdout benign | 26 | git |  | none |
| holdout benign | 27 | git |  | none |
| holdout benign | 28 | git |  | none |
| holdout benign | 29 | install |  | none |
| holdout benign | 30 | install |  | none |
| holdout benign | 31 | install |  | none |
| holdout benign | 32 | install |  | none |
| holdout benign | 33 | install |  | none |
| holdout benign | 34 | install |  | none |
| holdout benign | 35 | install |  | none |
| holdout benign | 36 | install |  | none |
| holdout benign | 37 | install |  | none |
| holdout benign | 38 | logs-and-paths |  | none |
| holdout benign | 39 | logs-and-paths |  | none |
| holdout benign | 40 | logs-and-paths |  | none |
| holdout benign | 41 | personal-data-examples |  | none |
| holdout benign | 42 | personal-data-examples |  | none |
| holdout benign | 43 | powershell |  | none |
| holdout benign | 44 | powershell |  | none |
| holdout benign | 45 | powershell |  | none |
| holdout benign | 46 | powershell |  | none |
| holdout benign | 47 | recipes-and-text |  | none |
| holdout benign | 48 | recipes-and-text |  | none |
| holdout benign | 49 | recipes-and-text |  | none |
| holdout benign | 50 | recipes-and-text |  | none |
| holdout malicious | 1 | base64-long |  | high |
| holdout malicious | 2 | base64-long |  | low |
| holdout malicious | 3 | bitsadmin |  | high |
| holdout malicious | 4 | bitsadmin |  | high |
| holdout malicious | 5 | certutil |  | high |
| holdout malicious | 6 | certutil |  | high |
| holdout malicious | 7 | cmd-chain |  | high |
| holdout malicious | 8 | cmd-chain |  | high |
| holdout malicious | 9 | cmd-chain |  | high |
| holdout malicious | 10 | curl-pipe |  | high |
| holdout malicious | 11 | curl-pipe |  | high |
| holdout malicious | 12 | mshta |  | high |
| holdout malicious | 13 | mshta |  | high |
| holdout malicious | 14 | multiline-and-spaces |  | high |
| holdout malicious | 15 | multiline-and-spaces |  | high |
| holdout malicious | 16 | powershell-download-or-iex |  | high |
| holdout malicious | 17 | powershell-download-or-iex |  | high |
| holdout malicious | 18 | powershell-download-or-iex |  | high |
| holdout malicious | 19 | powershell-encoded |  | high |
| holdout malicious | 20 | powershell-encoded |  | high |
| holdout malicious | 21 | powershell-encoded |  | high |
| holdout malicious | 22 | utility-mix |  | high |
| holdout malicious | 23 | utility-mix |  | high |
| real-sim | 1 | ClickFix cmd/curl.exe | FN inicial | high |
| real-sim | 2 | ClickFix cmd/curl.exe | variação: http | high |
| real-sim | 3 | ClickFix cmd/curl.exe | variação: rótulo decimal no domínio reservado | high |
| real-sim | 4 | ClickFix cmd/curl.exe | variação: %temp% | high |
| real-sim | 5 | ClickFix cmd/curl.exe | variação: -o | high |
| real-sim | 6 | ClickFix cmd/curl.exe | variação: segundo for /f | high |
| real-sim | 7 | ClickFix cmd/curl.exe | variação: quebras de linha | high |
