# Divisão determinística dos corpora

- Seed: 20261112.
- Estratégia: embaralhamento Fisher-Yates com seed fixa, estratificado por categoria.
- Proporção alvo: 70% dev / 30% holdout; categorias com ao menos duas amostras aparecem nos dois conjuntos.

- benign: 125/50 amostras (dev/holdout) de 175.
- malicious-sim: 56/23 amostras (dev/holdout) de 79.
