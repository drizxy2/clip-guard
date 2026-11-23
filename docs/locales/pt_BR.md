# Clip Guard

Clip Guard é uma extensão experimental que alerta sobre comandos de shell suspeitos antes que sejam gravados na área de transferência ou colados em uma página. As heurísticas podem gerar falsos positivos ou deixar ameaças passar; a extensão não substitui as proteções do sistema operacional.

## Instalação

Baixe e extraia a [versão mais recente](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave e outros navegadores Chromium:** abra `chrome://extensions` ou `edge://extensions`, ative o modo do desenvolvedor, clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
- **Firefox:** até o complemento ser assinado e publicado no AMO, carregue-o temporariamente em `about:debugging#/runtime/this-firefox`, selecionando o `manifest.json` extraído. Extensões temporárias são removidas ao fechar o Firefox.

## Proteção e privacidade

O modo de bloqueio impede gravações ou colagens suspeitas até você decidir. O modo só aviso permite a ação e exibe um alerta. O Clip Guard não faz chamadas de rede e nunca salva o texto da área de transferência. Se as medições locais opcionais forem ativadas, somente origem, nível, motivos e data são registrados. O texto aguardando sua decisão permanece temporariamente na memória.

A interface acompanha o idioma do navegador. Consulte o [README do projeto](../../README.md) para detalhes técnicos.
