# Contexto inválido da extensão no Chrome

## Diagnóstico

O erro `Extension context invalidated` indica que o Chrome invalidou o contexto antigo de
content script após recarregar, atualizar, desativar ou remover a extensão. Páginas já abertas
podem continuar existindo com o código antigo carregado.

O conteúdo exibido no DevTools não é causado por uma política da rede escolar e não indica
que o Clip Guard tenha enviado dados para um servidor.

## Correção

- Operações de storage e `runtime.sendMessage` passam por um guard de contexto compartilhado.
- A invalidação desativa permanentemente novas chamadas, listeners e logs repetidos nesse
  contexto antigo.
- Erros síncronos e rejeições assíncronas com "Extension context invalidated" ou
  "context invalidated" entram no mesmo estado de teardown.
- O usuário deve atualizar a aba após recarregar ou atualizar a extensão.

## Interface rica

- O host fechado da interface é reanexado após alterações SPA no DOM.
- Paste e reinserção consideram targets compostos em Shadow DOM e editores `contenteditable`.
- Cancel mantém o campo sem alteração.
- "Colar mesmo assim" reinserta o texto exato.
