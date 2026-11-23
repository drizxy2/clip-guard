# Desempenho do classificador

Executado em 2026-11-23T04:15:37.977Z com Node.js v24.21.0; medidas locais, 5000/1000/300 iterações (100 caracteres/10 KiB/1 MiB).
Para entradas acima de 100 KiB, `classify()` examina somente os primeiros e últimos 50 KiB.

| Tamanho | Média (ms) | p99 (ms) |
| --- | ---: | ---: |
| 100 caracteres | 0.0115 | 0.0754 |
| 10,240 caracteres | 0.6246 | 1.0092 |
| 1,048,576 caracteres | 7.5691 | 14.9918 |
