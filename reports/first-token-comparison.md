# Comparação do sinal de primeiro token

Baseline capturado antes da alteração em `reports/first-token-baseline.md`; nenhum texto de amostra é repetido aqui.

## Métricas

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

## Casos que mudaram de nível

| Conjunto | # | Categoria | Identificação | Antes | Depois |
| --- | ---: | --- | --- | --- | --- |
| dev benign | 1 | ambiguous |  | low | none |
| dev benign | 2 | ambiguous |  | low | none |
| dev benign | 3 | ambiguous |  | low | none |
| dev benign | 4 | ambiguous |  | low | none |
| dev benign | 5 | ambiguous |  | low | none |
| dev benign | 6 | ambiguous |  | low | none |
| holdout benign | 1 | ambiguous |  | low | none |
| holdout benign | 2 | ambiguous |  | low | none |

## Regressão corrigida

A redução por abertura natural/comum rebaixava os dois exemplos indicados; sem essa regra, ambos são high novamente.

| Caso | Nível antes da regra | Com rebaixamento | Corrigido |
| --- | --- | --- | --- |
| dev malicious #13 (`cmd-chain`) | high | low | high |
| dev malicious #20 (`curl-pipe`) | high | low | high |
