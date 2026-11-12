# Resumo de avaliação do Clip Guard

Gerado em 2026-11-12T13:40:13.609Z por `npm run eval`. As métricas usam o classificador atual, sem ajustar suas regras.

## Dev

Amostras: 125 benignas (6 ambíguas), 56 simuladas.
- Falsos positivos, benignas totais: 6/125 (4.80%).
- FP em benignas não ambíguas: 0/119 (0.00%).
- FP em benignas ambíguas: 6/6 (100.00%).
- Falsos negativos: 0/56 (0.00%).

## Holdout

Amostras: 50 benignas (2 ambíguas), 23 simuladas.
- Falsos positivos, benignas totais: 2/50 (4.00%).
- FP em benignas não ambíguas: 0/48 (0.00%).
- FP em benignas ambíguas: 2/2 (100.00%).
- Falsos negativos: 0/23 (0.00%).

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

## E2E

Resultado: 21/21 passaram.

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
| Medição por origem e exportação JSON sem texto | PASSOU |  |
| Botão legítimo Copiar npm install lodash sem alerta | PASSOU |  |

## Desempenho

Executado em 2026-11-12T13:40:13.469Z com Node.js v24.21.0; medidas locais, 5000/1000/300 iterações (100 caracteres/10 KiB/1 MiB).
Para entradas acima de 100 KiB, `classify()` examina somente os primeiros e últimos 50 KiB.
| Tamanho | Média (ms) | p99 (ms) |
| --- | ---: | ---: |
| 100 caracteres | 0.0109 | 0.0458 |
| 10,240 caracteres | 0.6603 | 1.1651 |
| 1,048,576 caracteres | 7.4956 | 12.3740 |

## Amostras reais

Nenhum arquivo real opcional foi encontrado.
Os textos das amostras não são copiados para este relatório.
