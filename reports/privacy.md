# Privacidade e desempenho

## Dados

- `state.lastWrite` mantém somente hash SHA-256, origem, nível, motivos, instante e sinal contextual em memória; não contém o texto nem preview.
- O texto bruto fica apenas em memória durante uma confirmação de colagem pendente. Um preview truncado a 80 caracteres é incluído somente na mensagem em memória para esse diálogo.
- A opção de medição local fica desligada por padrão. Quando ativada, `chrome.storage.local` contém `fpMeasurementEnabled` e `fpMeasurementLog`, agrupado por origem com registros somente `{level, reasons, date}`. Nenhum texto, hash ou preview é incluído nesses registros.
- A implementação não usa APIs de rede. `npm test` verifica automaticamente que os arquivos JavaScript em `src/` não contêm `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` ou `navigator.sendBeacon`.

## Desempenho

`npm run perf` mede média e p99 de `classify()` em entradas de 100 caracteres, 10 KiB e 1 MiB. Para textos acima de 100 KiB, a função examina apenas os primeiros e últimos 50 KiB. Os resultados e o ambiente de execução estão em `reports/perf.md`; são medidas locais, não um benchmark de produção.
