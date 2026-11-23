# Comparação das amostras ClickFix cmd

Resultados por variação; os textos das amostras são omitidos.

| # | Variação | Baseline | Depois | Motivos depois |
| ---: | --- | --- | --- | --- |
| 1 | FN inicial | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 2 | variação: http | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 3 | variação: rótulo decimal no domínio reservado | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 4 | variação: %temp% | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 5 | variação: -o | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 6 | variação: segundo for /f | none | **high** | download em diretório gravável + execução indireta, variáveis de ambiente do cmd com encadeamento, primeiro token de comando (curl), encadeamento && |
| 7 | variação: quebras de linha | none | **high** | download em diretório gravável + execução indireta, primeiro token de comando (curl) |

Baseline: 0/7 alertas; depois: 7/7 alertas.
