# Cobertura após rearmamento de document.write

Diagnóstico pós-rearme executado em 2026-11-12T13:29:17.037Z com Edge/Playwright. Após document.open()/write()/close(), referências às funções embrulhadas foram comparadas com as capturadas antes; ALERT/PASTE_REQUEST foram observados por postMessage e a prevenção de paste foi verificada no evento.

| Hook/listener | Referência do wrapper persistiu | Detecção funcional depois de document.write |
| --- | --- | --- |
| navigator.clipboard.writeText | sim | sim |
| navigator.clipboard.write | sim | sim |
| Document.execCommand | sim | sim |
| DataTransfer.setData during copy | sim | sim |
| listener de paste | n/a | preventDefault ativo |
| listener de copy | n/a | ativo |

Mensagens MAIN observadas: HELLO, HELLO, HELLO, HELLO, ALERT, ALERT, ALERT, ALERT, ALERT, PASTE_REQUEST.

## Cobertura restante

- Não cobre páginas especiais/restritas do navegador, escritas iniciadas em workers ou contextos sem permissão de clipboard.
- O conteúdo de páginas pode forjar mensagens da ponte e provocar alertas falsos; a ponte não deve permitir que a página suprima os alertas.
