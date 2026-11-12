# Avaliação de evasão por mutação

Amostras-base: 56 simuladas do conjunto dev; nenhuma amostra holdout foi usada para ajuste.
As taxas antes/depois usam as mesmas mutações e o classificador congelado em `pre-holdout` como referência.

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

## Limitações conhecidas

- variable expression: 1/1 amostras indetectáveis após o ajuste.
A construção dinâmica de variáveis que não pertence às mutações obrigatórias continua fora do escopo de reconstrução sem executar o comando.
