\# TAREFAS-2 (clip-guard) — executar tudo de ponta a ponta, sem pedir confirmação

Só me consulte se algo falhar após 2 tentativas ou se surgir decisão de design não coberta aqui. Faça as etapas na ordem e salve um relatório por etapa em reports/.



\## A. Conjunto reservado (anti-circularidade)

\- Divida os corpora existentes: test/corpus/dev-\*.json (70%) e test/corpus/holdout-\*.json (30%), sorteio com seed fixa registrada. Congele o classificador atual (commit/tag `pre-holdout`) e avalie SOMENTE no holdout, sem ajustar nada. Salve reports/holdout.md (FP, FP em ambíguos separado, FN).

\- Se existir test/corpus/real-sim.json (amostras neutralizadas que o usuário pode adicionar), avalie nele também, separadamente.

\- Só depois ajuste o classificador usando o conjunto dev; reavalie no holdout apenas UMA vez ao final e reporte as duas medições lado a lado.



\## B. Evasões

\- Trate no classificador, sem inflar FP: concatenação simples de strings ('po'+'wer'+'shell'), homógrafos, divisão em múltiplas linhas, substring de variável de ambiente. Para o que continuar indetectável, mantenha em reports/evasion.md como limitação conhecida, com a taxa por tipo antes/depois.



\## C. Cenários e2e (scripts/e2e.js, Playwright com o navegador disponível)

Cada um com resultado passou/falhou em reports/e2e.md: escrita de iframe cross-origin, srcdoc, about:blank, popup (window.open), document.write em iframe novo, Shadow DOM, evento 'copy' com setData, execCommand('copy') com textarea oculto, navigator.clipboard.write com ClipboardItem, escrita em Fullscreen; paste em input, textarea, contenteditable e campo em Shadow DOM, conferindo que "Colar mesmo assim" reinsere o texto exato (quebras de linha, seleção substituída) e que "Cancelar" mantém o campo intacto; botão legítimo "Copiar npm install lodash" sem alerta. Liste o que NÃO é coberto em reports/coverage.md.



\## D. Privacidade e desempenho

\- Não persistir preview: persistir só hash SHA-256 + motivos. Preview truncado apenas em memória durante o diálogo.

\- Teste automatizado que falha se src/ contiver fetch, XMLHttpRequest, WebSocket, sendBeacon ou navigator.sendBeacon.

\- Medir tempo médio e p99 de classify() para 100 chars, 10 KB e 1 MB (acima de 100 KB, classificar só os primeiros e últimos 50 KB). Salve em reports/perf.md.



\## E. Modo de medição local de FP

Opção na extensão (desligada por padrão) que registra, por origem, apenas {nível, motivos, data} em chrome.storage.local, nunca o texto, e uma página de opções com a tabela exportável em JSON. Serve para o usuário medir falsos positivos no uso real.



\## F. README e build

Atualize o README (limitações, incluindo que a página pode forjar mensagens da ponte e gerar alertas falsos, mas não suprimi-los; resultados antes/depois; como reproduzir: npm test, npm run eval, npm run e2e). Rode tudo e imprima o SHA-256 de CADA arquivo do dist e do zip, uma linha por arquivo, sem nada em branco.



\## Entrega final

1\) tabela dev vs holdout (FP, FP ambíguos, FN); 2) evasão por tipo antes/depois; 3) resultado de cada cenário e2e; 4) desempenho; 5) todos os SHA-256; 6) decisões de design; 7) pendências.

