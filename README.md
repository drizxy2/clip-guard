# Clip Guard

**Clip Guard** é uma extensão de navegador que detecta conteúdo suspeito de linha de comando antes que ele seja gravado no clipboard ou colado em uma página.

O projeto oferece interceptação para navegadores baseados em Chromium e Firefox, com proteção em **modo bloqueio** e uma opção mais permissiva em **modo aviso**.

> Protótipo experimental: heurísticas podem gerar falsos positivos ou falsos negativos. O Clip Guard não substitui controles do sistema operacional ou análise de segurança.

## Compatibilidade

| Navegador | Status | Observações |
| --- | --- | --- |
| Microsoft Edge (Chromium) | Testado | Testes E2E automatizados neste navegador; a versão registrada é 157.0.4341.46. |
| Firefox Desktop 160.0.1 | Testado | Testes E2E automatizados; mínimo declarado 140.0. |
| Chrome / Chromium | Esperado funcionar, não testado | Usa o manifesto Chromium MV3; a execução E2E disponível neste projeto usa Edge. |
| Brave, Opera e Vivaldi | Esperado funcionar, não testado | Baseados em Chromium; não foram testados individualmente. |
| Safari | Suporte experimental, não testado | Requer macOS + Xcode e conversão da Web Extension; veja os passos abaixo. |
| Chrome para Android | Não suportado | Chrome para Android não oferece suporte a extensões. |
| Firefox para Android | Esperado funcionar, não testado | Mínimo declarado 142.0; esta plataforma não foi testada. |

Extensões não são executadas em páginas restritas do navegador, como `chrome://`, `edge://`, `about:` ou páginas de extensões. No Firefox, frames vazios `about:blank` podem não receber os scripts no início do documento. A extensão só observa operações de clipboard ocorridas dentro de páginas às quais os content scripts têm acesso; colagens em outros aplicativos ou fora do navegador não são detectáveis.

### Conversão experimental para Safari

Não foi possível gerar ou testar o app do Safari neste ambiente Windows. Em um Mac com Xcode instalado, gere primeiro o diretório Chromium e então execute:

```bash
npm run build
xcrun safari-web-extension-converter dist/chromium --project-location safari --app-name "Clip Guard"
```

Abra o projeto gerado no Xcode, revise as permissões e teste a extensão no Safari antes de considerar esse navegador compatível. Essa conversão é experimental e pode exigir ajustes de APIs ou do manifesto.

## Recursos

- Intercepta APIs comuns de clipboard e eventos `copy`, `cut`, `paste` e `drop`
- Analisa texto antes da gravação e antes da inserção em campos da página
- Bloqueia colagens suspeitas ou permite continuar com confirmação explícita
- Possui cobertura testada para frames, Shadow DOM e páginas que usam `document.write`, com limitações específicas do Firefox
- Suporta 20 idiomas; a interface acompanha o idioma do navegador
- Não envia o conteúdo analisado para servidores
- Fornece relatórios locais de avaliação, evasão, privacidade e desempenho

Guias rápidos de instalação e privacidade: [English](docs/locales/en.md), [中文](docs/locales/zh_CN.md), [हिन्दी](docs/locales/hi.md), [Español](docs/locales/es.md), [العربية](docs/locales/ar.md), [Français](docs/locales/fr.md), [বাংলা](docs/locales/bn.md), [Português (Brasil)](docs/locales/pt_BR.md), [Bahasa Indonesia](docs/locales/id.md), [اردو](docs/locales/ur.md), [Русский](docs/locales/ru.md), [Deutsch](docs/locales/de.md), [日本語](docs/locales/ja.md), [Nigerian Pidgin](docs/locales/pcm.md), [العربية المصرية](docs/locales/ar_EG.md), [मराठी](docs/locales/mr.md), [Tiếng Việt](docs/locales/vi.md), [తెలుగు](docs/locales/te.md), [Kiswahili](docs/locales/sw.md) e [Hausa](docs/locales/ha.md).

As traduções foram preparadas com assistência de IA e devem ser revisadas por falantes nativos, especialmente antes da publicação nas lojas.

## Como funciona

O texto é normalizado com NFKC, caracteres ocultos são removidos e variantes comuns de escrita, como homógrafos, caracteres de separação e comandos divididos em linhas, são consideradas pela heurística.

O classificador procura sinais como:

- PowerShell, CMD, MSHTA, Rundll32 e outros utilitários de shell
- Comandos encadeados e opções suspeitas
- Download seguido de execução indireta
- Comandos Base64 codificados
- Frases de verificação associadas a páginas ClickFix
- Contexto de iframe, fullscreen e interação recente

Nenhum comando é executado pelo conteúdo analisado. Os sinais são combinados em uma pontuação heurística; o primeiro token executável sozinho não determina o bloqueio.

## Modos de proteção

| Modo | Comportamento |
| --- | --- |
| **Bloquear** | Suspende a gravação ou colagem suspeita até uma decisão explícita do usuário |
| **Só avisar** | Permite a ação e exibe um aviso localizado |

No modo padrão, o usuário pode escolher **Manter bloqueado** ou **Colar mesmo assim**. Esc mantém o bloqueio.

## Instalação para usuários

Os pacotes das versões publicadas ficam na página [Releases](https://github.com/drizxy2/clip-guard/releases). Baixe e extraia `chromium.zip` para Edge, Chrome e outros navegadores Chromium, ou `firefox.zip` para Firefox.

### Chrome, Edge, Brave e outros navegadores Chromium

1. Abra `chrome://extensions` ou `edge://extensions` (em outros navegadores, procure por **Extensões** nas configurações).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
4. Confirme que Clip Guard está ativado. Para acesso rápido, abra o menu de extensões (ícone de peça de quebra-cabeça) e fixe Clip Guard na barra de ferramentas.

### Firefox

O pacote ainda não está assinado pela Mozilla. Para experimentar temporariamente, abra `about:debugging#/runtime/this-firefox`, clique em **Carregar extensão temporária** e selecione `manifest.json` dentro da pasta extraída. A extensão temporária é removida ao fechar o Firefox; uma instalação permanente exige publicar e assinar o complemento no Firefox Add-ons.

> A instalação direta e permanente no Chrome/Edge também exige publicar a extensão na loja correspondente. Até lá, o carregamento sem compactação é necessário; o navegador pode desativá-la em alguns ambientes gerenciados.

## Instalação local (desenvolvimento)

### Pré-requisitos

- Node.js 18 ou superior
- Microsoft Edge/Chromium ou Firefox para testes E2E

Instale as dependências e gere os pacotes:

```bash
npm install
npm run build
```

As instruções de carregamento são as mesmas acima; use a pasta `dist/chromium` para navegadores Chromium e `dist/firefox/manifest.json` para Firefox.

O Firefox Desktop requer a versão 140 ou superior. No Android, o mínimo declarado é 142; essa plataforma não foi testada.

## Página de demonstração

Sirva o diretório localmente e abra a página de demonstração:

```bash
npx serve .
```

Depois, acesse a página em uma origem segura, por exemplo:

```text
http://localhost:3000/test/pages/clickfix-demo.html
```

Os exemplos são payloads simulados e neutralizados. A demonstração não executa os comandos exibidos.

## Comandos disponíveis

| Comando | Descrição |
| --- | --- |
| `npm test` | Executa os testes unitários e de privacidade |
| `npm run eval` | Avalia os corpora, evasões e gera `reports/SUMMARY.md` |
| `npm run e2e` | Executa os cenários E2E no Edge/Chromium |
| `npm run e2e:firefox` | Executa os cenários E2E no Firefox |
| `npm run build` | Gera as distribuições Chromium e Firefox |
| `npm run lint:firefox` | Valida o pacote Firefox com `web-ext` |
| `npm run perf` | Mede o tempo de classificação local |
| `npm run import-local -- <arquivo>` | Importa dados locais exportados pelas opções |
| `npm run generate:corpus` | Regenera os corpora neutralizados |

## Privacidade

- Não usa chamadas de rede nem armazenamento remoto
- O texto bruto não é enviado ou persistido
- Durante o aviso, o texto retido permanece em memória até o usuário decidir
- O preview exibido é limitado
- Métricas locais são opcionais e desligadas por padrão
- Quando ativadas, usam nível, origem, motivos e data — sem texto ou preview
- Os relatórios de diagnóstico não incluem os textos das amostras

Detalhes em [`reports/privacy.md`](reports/privacy.md).

## Apoie o projeto

Gostou do Clip Guard? Apoie o projeto: https://buymeacoffee.com/miguelcost3

## Validação

Os resultados registrados localmente incluem:

- **Unitários:** 32/32
- **Chromium:** 56/56
- **Firefox:** 24/24
- **Falsos positivos no corpus combinado:** 0/175
- **Payloads simulados detectados:** 79/79

Esses números representam os cenários testados nesta versão. Outras versões de navegador e ambientes podem apresentar resultados diferentes.

Relatórios disponíveis:

- [`reports/SUMMARY.md`](reports/SUMMARY.md) — resumo da avaliação
- [`reports/evasion.md`](reports/evasion.md) — resistência a mutações
- [`reports/e2e.md`](reports/e2e.md) — cenários Chromium
- [`reports/firefox-e2e.md`](reports/firefox-e2e.md) — cenários Firefox
- [`reports/holdout.md`](reports/holdout.md) — comparação com corpus reservado
- [`reports/perf.md`](reports/perf.md) — medidas locais de desempenho
- [`reports/privacy.md`](reports/privacy.md) — dados tratados pela extensão

## Limitações conhecidas

- Não observa colagens feitas fora do navegador, como no diálogo Executar do Windows
- Não analisa arquivos ou formatos binários em operações de drag-and-drop
- O `beforeinput` depende de o navegador fornecer texto ou `dataTransfer`
- Expressões de variável dinâmica continuam fora da cobertura medida
- Páginas especiais ou restritas podem limitar os hooks da extensão
- Cópias iniciadas por aplicações externas ao navegador não são observáveis
- O Firefox não injeta content scripts em iframes vazios `about:blank` no `document_start`
- Extensões MV3 não possuem um canal secreto entre os mundos MAIN e ISOLATED
- Comandos construídos dinamicamente ou scripts complexos podem não ser reconstruídos

## Estrutura do projeto

```text
src/                 classificação, background, bridge e interface
build/               manifestos base por navegador
test/                testes unitários, corpora e página de demonstração
scripts/             build, avaliação, E2E e geração de relatórios
reports/             resultados gerados localmente
dist/                pacotes e fontes geradas
_locales/            traduções da interface
```

## Desenvolvimento

O fluxo recomendado é:

```bash
npm test
npm run eval
npm run build
npm run e2e
npm run e2e:firefox
npm run lint:firefox
```

Os pacotes gerados em `dist/` e os relatórios em `reports/` são artefatos locais. Os corpora reais podem ser importados em `test/corpus/`, mas os arquivos `real-*.json` são ignorados pelo Git.
