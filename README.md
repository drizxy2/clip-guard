# clip-guard

Protótipo local de extensão Chromium Manifest V3 para alertar sobre gravações suspeitas de comandos de shell na área de transferência e pedir confirmação antes de colar conteúdo correspondente.

## Carregar no Chromium

1. Execute `npm test`, `npm run eval`, `npm run e2e` e `npm run build`.
2. Abra `chrome://extensions` (ou `edge://extensions`) e ative o modo de desenvolvedor.
3. Use **Carregar sem compactação** e selecione a pasta `dist/`.
4. Para a página de demonstração, abra `test/pages/clickfix-demo.html` por um servidor local em uma origem segura, ou use um arquivo local se o navegador permitir clipboard nessa origem. Clique nos dois botões para comparar os alertas.

O botão de demonstração simula somente `cmd /c echo test && calc`; não execute esse texto.

## Desenvolvimento e reprodução

- Requer Node.js 18 ou superior; não há dependências externas em runtime. Playwright é usado somente no teste e2e.
- `npm test` executa os testes `node:test`, incluindo avaliação por mutação, verificação de privacidade/rede e geração de `reports/evasion.md`.
- `npm run eval` recalcula dev, holdout, evasão, E2E e desempenho e escreve `reports/SUMMARY.md`; amostras opcionais `real-sim.json` e `real-benign.json` geram métricas sem incluir texto.
- `npm run import-local -- <arquivo.json>` importa o JSON exportado nas opções e gera `reports/local-fp.md`, agrupado por origem, nível e motivos, sem texto.
- `npm run e2e` reconstrói a extensão e testa os cenários no Microsoft Edge instalado; requer Playwright e Edge.
- `npm run perf` mede `classify()` em 100 caracteres, 10 KiB e 1 MiB e escreve `reports/perf.md`.
- `npm run generate:corpus` regenera os corpora independentes em `test/corpus/`.
- `test/corpus/README.md` documenta o formato neutralizado de amostras locais; os arquivos `real-*.json` são ignorados pelo Git.
- `npm run build` valida o manifesto, gera `dist/`, cria `dist/clip-guard.zip` e imprime SHA-256 por arquivo e para o ZIP.
- `reports/privacy.md`, `reports/coverage.md`, `reports/e2e.md`, `reports/evasion.md`, `reports/dev.md` e `reports/holdout.md` detalham as verificações e resultados.

## Heurísticas e resultados

A classificação normaliza Unicode NFKC, remove caracteres zero-width e separadores `^`/aspas inseridos dentro de tokens, e inspeciona em memória argumentos PowerShell `-enc`/`-EncodedCommand` Base64 de até 64 KiB decodificados. Também considera famílias de utilitários de shell, opções de PowerShell, encadeamento de comandos, Base64 longo, frases de verificação e sinais de contexto (fullscreen, iframe cross-origin e interação recente). Contexto só aumenta a pontuação se já houver evidência textual. Pipes de instaladores por `curl`/`wget` ficam em nível baixo por serem ambíguos; o corpus benigno inclui exemplos de instalação, documentação, código, dados e texto multilíngue.

O conjunto de desenvolvimento contém 125 amostras benignas e 56 simuladas maliciosas: após os ajustes, houve 6/125 falsos positivos (4,80%, todos ambíguos) e 0/56 falsos negativos. No holdout reservado (50 benignas/23 simuladas maliciosas), a medição congelada e a avaliação final única foram ambas 2/50 FP (4,00%), 2/2 FP ambíguos e 0/23 FN; não houve ajuste no holdout. `reports/holdout.md` apresenta os resultados lado a lado. Os resultados de evasão antes/depois no conjunto dev estão em `reports/evasion.md`; concatenação simples (11/14→14/14), homógrafos (11/14→14/14), comandos divididos em linhas (21/55→55/55) e substring de variável de ambiente (0/1→1/1) foram tratados. Expressões de variável dinâmica permanecem uma limitação medida (0/1).

`reports/perf.md` registra medições locais: média/p99 de 0,0204/0,1904 ms para 100 caracteres, 0,9167/2,9596 ms para 10 KiB e 8,5493/13,4978 ms para 1 MiB. Entradas acima de 100 KiB são limitadas aos primeiros e últimos 50 KiB. Os tempos são específicos do ambiente local Node.js 24.21.0/Windows e não representam benchmark de produção.

## Privacidade

O texto integral não é persistido nem enviado à rede. A detecção mantém temporariamente em memória hash SHA-256, origem, nível e motivos; o texto só permanece em memória enquanto uma confirmação de colagem está pendente. Um preview de até 80 caracteres só é enviado ao diálogo de confirmação. A medição local é opcional e desligada por padrão; quando ativada, armazena em `chrome.storage.local` apenas nível, motivos e data agrupados pela origem.

## Limitações conhecidas

- A extensão não vê colagens fora do navegador, como no diálogo Executar do Windows (`Win+R`) ou em terminais externos.
- Não cobre todas as formas de escrita no clipboard, páginas especiais/restritas do navegador, escritas iniciadas em workers, contextos sem permissão ou todas as APIs/métodos que contornem os hooks.
- O alerta de colagem depende de a página ainda estar aberta e de o texto colado corresponder ao último conteúdo suspeito observado pelo hook.
- Uma extensão MV3 não tem canal secreto entre os mundos MAIN e ISOLATED: a página pode forjar mensagens da ponte e provocar alertas falsos, mas não consegue suprimi-los por essa ponte.
- Classificação heurística pode gerar falsos positivos e falsos negativos. O protótipo não substitui controles do sistema operacional nem análise de segurança. Expressões de variável dinâmica seguem como evasão não detectada no corpus medido.
- O conteúdo `-enc` maior que 64 KiB decodificados não é inspecionado.
- A re-inserção após confirmação usa `setRangeText` para inputs/textarea e `execCommand("insertText")` para conteúdo editável; comportamentos especiais de alguns editores não são garantidos.
- O teste e2e depende de um Chromium automatizável e Playwright/Puppeteer. O teste unitário e o build não exigem navegador.
