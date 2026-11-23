# Resumo de avaliação do Clip Guard

Gerado em 2026-11-23T04:15:38.065Z por `npm run eval`. As métricas usam o classificador atual, sem ajustar suas regras.

## Dev

Amostras: 140 benignas (6 ambíguas), 56 simuladas.
- Falsos positivos, benignas totais: 0/140 (0.00%).
- FP em benignas não ambíguas: 0/134 (0.00%).
- FP em benignas ambíguas: 0/6 (0.00%).
- Falsos negativos (nível < low): 0/56 (0.00%).
- Detecção em high (bloqueia a colagem): 56/56 (100.00%).

## Holdout

Amostras: 50 benignas (2 ambíguas), 23 simuladas.
- Falsos positivos, benignas totais: 0/50 (0.00%).
- FP em benignas não ambíguas: 0/48 (0.00%).
- FP em benignas ambíguas: 0/2 (0.00%).
- Falsos negativos (nível < low): 0/23 (0.00%).
- Detecção em high (bloqueia a colagem): 22/23 (95.65%).

## Falsos positivos antes/depois

| Conjunto | Baseline original | Depois |
| --- | ---: | ---: |
| Dev com 15 controles benignos | 8/140 (5.71%) | 0/140 (0.00%) |
| Holdout | 2/50 (4.00%) | 0/50 (0.00%) |
No corpus dev antes de adicionar os 15 controles, o baseline era 6/125 (4.80%).

## Sinal de primeiro token

Decisão: o primeiro token executável é apenas um reforço (+1) quando há evidência independente de risco; não basta sozinho. Espaços, aspas, `@`/`&` são normalizados e `set`, `echo`, `cd` e `REM` são tratados como prefixos inertes antes de procurar o comando. A redução de nível por abertura natural/comum foi removida para não rebaixar texto com sinais de comando, cadeia, download ou execução.

| Conjunto | Métrica | Antes | Depois |
| --- | --- | ---: | ---: |
| dev | FP | 6/140 (4.29%) | 0/140 (0.00%) |
| dev | FN (nível < low) | 0/56 (0.00%) | 0/56 (0.00%) |
| dev | HIGH (bloqueia colagem) | 56/56 (100.00%) | 56/56 (100.00%) |
| holdout | FP | 2/50 (4.00%) | 0/50 (0.00%) |
| holdout | FN (nível < low) | 0/23 (0.00%) | 0/23 (0.00%) |
| holdout | HIGH (bloqueia colagem) | 22/23 (95.65%) | 22/23 (95.65%) |
| real-sim | FP | 0/0 (n/a) | 0/0 (n/a) |
| real-sim | FN (nível < low) | 0/7 (0.00%) | 0/7 (0.00%) |
| real-sim | HIGH (bloqueia colagem) | 7/7 (100.00%) | 7/7 (100.00%) |

### Evasões

| Caso | Antes | Depois |
| --- | --- | --- |
| sem prefixo | high | high |
| prefixo isca (set/echo/cd) | high | high |
| espaços + aspas + @/& | none | low |
| comentário REM antes do comando | high | high |
| nova linha inicial | high | high |

Casos que mudaram de nível após a correção: 8. A regressão de dev malicious #13 (`cmd-chain`) e #20 (`curl-pipe`) foi restaurada (`high → low → high`); detalhes em `reports/first-token-comparison.md`.
Ganho mensurável do sinal: a evasão com espaços, aspas e `@/&` passou de `none` para `low`; o sinal foi mantido. Limites: o parser reconhece fronteiras simples de comandos e prefixos listados, sem executar conteúdo nem interpretar scripts completos; o primeiro token nunca classifica sozinho.

## Evasão

Taxas antes/depois por mutação; cada denominador mostra o n avaliado.

| Mutação | Antes | Depois |
| --- | ---: | ---: |
| mixed case | 56/56 (100.00%) | 56/56 (100.00%) |
| cmd caret | 14/14 (100.00%) | 14/14 (100.00%) |
| quoted token | 14/14 (100.00%) | 14/14 (100.00%) |
| string concatenation | 11/14 (78.57%) | 14/14 (100.00%) |
| variable expression | 0/1 (0.00%) | 0/1 (0.00%) |
| environment substring | 0/1 (0.00%) | 1/1 (100.00%) |
| unicode whitespace | 56/56 (100.00%) | 56/56 (100.00%) |
| homoglyph | 11/14 (78.57%) | 14/14 (100.00%) |
| zero-width characters | 14/14 (100.00%) | 14/14 (100.00%) |
| command split across lines | 21/55 (38.18%) | 55/55 (100.00%) |
| long verification prefix | 56/56 (100.00%) | 56/56 (100.00%) |
| UTF-16LE base64 -enc | 2/2 (100.00%) | 2/2 (100.00%) |
| shortened URL | 25/25 (100.00%) | 25/25 (100.00%) |
| decimal IP URL | 25/25 (100.00%) | 25/25 (100.00%) |
| hex IP URL | 25/25 (100.00%) | 25/25 (100.00%) |
| ClickFix cmd/curl.exe | 0/7 (0.00%) | 7/7 (100.00%) |

## E2E

Resultado: 22/22 passaram.

| Cenário | Resultado | Observação |
| --- | --- | --- |
| Escrita em iframe cross-origin | PASSOU |  |
| Escrita em srcdoc | PASSOU |  |
| Escrita em about:blank | PASSOU |  |
| Escrita em popup window.open | PASSOU |  |
| document.write em iframe novo | PASSOU |  |
| Escrita originada em Shadow DOM | PASSOU |  |
| Evento copy com DataTransfer.setData | PASSOU |  |
| execCommand('copy') com textarea oculto | PASSOU |  |
| navigator.clipboard.write com ClipboardItem | PASSOU |  |
| Escrita durante Fullscreen | PASSOU |  |
| Colagem em input: Colar mesmo assim reinsere o texto exato | PASSOU |  |
| Colagem em input: Cancelar mantém o campo intacto | PASSOU |  |
| Colagem em textarea: Colar mesmo assim reinsere o texto exato | PASSOU |  |
| Colagem em textarea: Cancelar mantém o campo intacto | PASSOU |  |
| Colagem em contenteditable: Colar mesmo assim reinsere o texto exato | PASSOU |  |
| Colagem em contenteditable: Cancelar mantém o campo intacto | PASSOU |  |
| Colagem em shadow: Colar mesmo assim reinsere o texto exato | PASSOU |  |
| Colagem em shadow: Cancelar mantém o campo intacto | PASSOU |  |
| Medição local desativada por padrão | PASSOU |  |
| Confirmação benigna sem persistir texto/evento | PASSOU |  |
| Medição por origem e exportação JSON sem texto | PASSOU |  |
| Botão legítimo Copiar npm install lodash sem alerta | PASSOU |  |

## Desempenho

Executado em 2026-11-23T04:15:37.977Z com Node.js v24.21.0; medidas locais, 5000/1000/300 iterações (100 caracteres/10 KiB/1 MiB).
Para entradas acima de 100 KiB, `classify()` examina somente os primeiros e últimos 50 KiB.
| Tamanho | Média (ms) | p99 (ms) |
| --- | ---: | ---: |
| 100 caracteres | 0.0115 | 0.0754 |
| 10,240 caracteres | 0.6246 | 1.0092 |
| 1,048,576 caracteres | 7.5691 | 14.9918 |

## Amostras reais

- simuladas: 7 amostras; baseline 0/7 alertas (7 none); depois 7/7 alertas (0 none). Detalhes: `reports/real-baseline.md` e `reports/real-after.md`.
Comparação detalhada por amostra em `reports/real-baseline.md` e `reports/real-after.md`; os textos não são copiados para os relatórios.
Ctrl+C após selecionar texto numa página é diagnosticado pelo conteúdo da seleção no evento `copy`; cópias feitas fora do navegador não são observáveis.

## Compatibilidade

Chromium e Edge usam MV3 com service worker; Firefox usa event page (`background.scripts`), ID Gecko `clip-guard@local.example`, mínimo desktop 140.0 e mínimo Android 142.0. `src/compat.js` seleciona `browser` ou `chrome` e fornece `clipGuardApi` a cada contexto da extensão.
Firefox 160.0.1: E2E 24/24 em duas suítes, incluindo Ctrl+C manual e localização; Microsoft Edge 157.0.4341.46 (Chromium) E2E 56/56 em três suítes. `world: MAIN`, `all_frames`, `match_about_blank` e `match_origin_as_fallback` são mantidos. Firefox não injeta content scripts em iframes vazios no `document_start`; versões abaixo de 140 ignoram a declaração de dados Gecko. Chromium ignora os metadados Gecko.
`web-ext lint`: 0 erros, 2 avisos aceitáveis (`KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` para desktop <140 e `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` para Android <142), pois o mínimo pedido é 128. Publicação AMO e outras versões não foram testadas.
