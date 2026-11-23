# Testes E2E de bloqueio do clipboard

Resultado: 16/16 passaram.

| Cenário | Resultado | Observação |
| --- | --- | --- |
| Bloqueia try-write-text, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Bloqueia try-write, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Bloqueia try-exec-copy, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Bloqueia try-exec-cut, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Bloqueia try-event-copy, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Bloqueia try-event-cut, mantém clipboard, exibe aviso e registra evento | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-write-text | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-write | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-exec-copy | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-exec-cut | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-event-copy | PASSOU |  |
| Cópia benigna sem atraso perceptível por benign-event-cut | PASSOU |  |
| Permitir mesmo assim grava o ClipboardItem retido | PASSOU |  |
| Esc mantém a gravação bloqueada | PASSOU |  |
| Iframe bloqueia payload e informa o contexto | PASSOU |  |
| Modo só aviso permite a colagem e avisa | PASSOU |  |
