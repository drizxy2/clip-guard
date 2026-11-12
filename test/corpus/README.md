# Amostras locais opcionais

Copie os templates e use o esquema `text`, `source`, `category` e `notes`.
`real-sim.json` deve conter somente amostras neutralizadas: use o domínio
`example.invalid` e substitua o payload final por `echo`. Nunca inclua nem
commite amostras reais; os arquivos `real-sim.json` e `real-benign.json` são
ignorados pelo Git. `npm run eval` os avalia quando existirem, sem registrar
seus textos em relatórios.
