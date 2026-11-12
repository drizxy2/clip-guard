# Avaliação do conjunto holdout

O classificador foi congelado antes de alterações em `reports/pre-holdout-classifier.js` (SHA-256 `7275cca95eb166c29a47509bbd8ce36ba170ff56e04ca9144e44980bce8b466a`). A pasta não contém metadados Git, portanto não foi possível criar o commit/tag `pre-holdout`; o snapshot imutável e seu hash registram a versão avaliada. A divisão estratificada usa seed `20261112`, registrada em `reports/split.md`.

O holdout foi avaliado uma vez com o classificador congelado, antes dos ajustes, e uma vez após todos os ajustes em dev. A avaliação final foi executada em 2026-11-12 e está registrada em `reports/holdout-final.json`; nenhuma alteração de classificador ocorreu depois dela.

| Métrica | Pré-ajustes (holdout) | Final (holdout) | Dev final |
| --- | ---: | ---: | ---: |
| Falsos positivos | 2/50 (4,00%) | 2/50 (4,00%) | 6/125 (4,80%) |
| FP em amostras ambíguas | 2/2 (100,00%) | 2/2 (100,00%) | 6/6 (100,00%) |
| Falsos negativos | 0/23 (0,00%) | 0/23 (0,00%) | 0/56 (0,00%) |

`test/corpus/real-sim.json` não existia no momento das avaliações.
