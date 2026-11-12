const COMMAND_PATTERNS = [
  { name: "powershell/pwsh", pattern: /\b(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\b/i },
  { name: "cmd /c", pattern: /\bcmd(?:\.exe)?\s+\/c\b/i },
  { name: "mshta", pattern: /\bmshta(?:\.exe)?\b/i },
  { name: "rundll32", pattern: /\brundll32(?:\.exe)?\b/i },
  { name: "certutil", pattern: /\bcertutil(?:\.exe)?\b/i },
  { name: "bitsadmin", pattern: /\bbitsadmin(?:\.exe)?\b/i },
  { name: "curl/wget para shell", pattern: /\b(?:curl|wget)\b[^\r\n]*(?:\||\|\|?)[ \t]*(?:\/(?:usr\/)?bin\/)?(?:sh|bash|powershell|pwsh)\b/i, points: 2 },
  { name: "bash -c", pattern: /\bbash(?:\.exe)?\s+-c\b/i }
];

const POWERSHELL_FLAGS = [
  { name: "PowerShell encoded command", pattern: /-(?:enc|encodedcommand)\b/i },
  { name: "PowerShell oculto", pattern: /-(?:w|windowstyle)\s+hidden\b/i },
  { name: "PowerShell IEX/DownloadString", pattern: /\b(?:iex|invoke-expression|downloadstring)\b/i }
];

const VERIFICATION_PHRASE = /\b(?:i am not a robot|verification\s+(?:id|code|check)|human verification)\b/i;
const SHELL_COMMAND = /\b(?:powershell|pwsh|cmd(?:\.exe)?\s+\/c|mshta|rundll32|certutil|bitsadmin|bash\s+-c)\b/i;
const BASE64_LONG = /\b[A-Za-z0-9+/]{60,}={0,2}\b/;
const CHAIN_OPERATORS = ["&&", "||", "|", ";"];
const MAX_DECODED_BYTES = 64 * 1024;
const ENCODED_COMMAND = /(?:^|\s)-(?:enc|encodedcommand|e)\s+["']?([A-Za-z0-9+/]+={0,2})/gi;

function normalizeText(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/([\p{L}\p{N}])[\^"'`]+(?=[\p{L}\p{N}])/gu, "$1");
}

function decodeEncodedCommands(text) {
  const decoded = [];
  ENCODED_COMMAND.lastIndex = 0;
  for (const match of text.matchAll(ENCODED_COMMAND)) {
    const encoded = match[1];
    if (encoded.length > Math.ceil(MAX_DECODED_BYTES / 3) * 4) continue;

    let binary;
    try {
      binary = globalThis.atob(encoded);
    } catch {
      continue;
    }
    if (binary.length > MAX_DECODED_BYTES) continue;

    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const oddByteZeros = bytes.length % 2 === 0
      ? bytes.filter((_, index) => index % 2 === 1 && bytes[index] === 0).length
      : 0;
    const utf16le = bytes.length % 2 === 0 &&
      (bytes[1] === 0 || oddByteZeros > bytes.length / 4);
    const content = new TextDecoder(utf16le ? "utf-16le" : "utf-8").decode(bytes);
    if (content.trim()) decoded.push(content);
  }
  return decoded;
}

export function classify(text, context = {}) {
  const value = typeof text === "string" ? text : "";
  const normalized = normalizeText(value);
  const decodedCommands = decodeEncodedCommands(normalized);
  const scanValues = [normalized, ...decodedCommands].map((scanValue) =>
    scanValue.replace(/\r?\n/g, " ").replace(/\bhttps?:\/\/[^\s"'<>]+/gi, " ")
  );
  const reasons = [];
  let score = 0;
  let hasContentEvidence = false;
  const add = (reason, points, evidence = true) => {
    if (reasons.includes(reason)) return;
    reasons.push(reason);
    score += points;
    hasContentEvidence ||= evidence;
  };

  for (const scanValue of scanValues) {
    for (const { name, pattern, points = 4 } of COMMAND_PATTERNS) {
      if (pattern.test(scanValue)) add(name, points);
    }

    for (const { name, pattern } of POWERSHELL_FLAGS) {
      if (pattern.test(scanValue)) add(name, 1);
    }

    if (BASE64_LONG.test(scanValue)) add("base64 longo", 2);

    if (VERIFICATION_PHRASE.test(scanValue) && SHELL_COMMAND.test(scanValue)) {
      add("frase de verificação com comando", 2);
    }
  }

  if (hasContentEvidence) {
    for (const operator of CHAIN_OPERATORS) {
      if (scanValues.some((scanValue) => scanValue.includes(operator))) {
        add(`encadeamento ${operator}`, 1);
      }
    }
  }

  if (/\r?\n$/.test(value) && hasContentEvidence) add("quebra de linha final", 0.25, false);

  const signals = [
    [context.fullscreen === true, "documento em fullscreen"],
    [context.crossOriginIframe === true, "iframe cross-origin"],
    [
      Number.isFinite(context.msSinceClick) &&
        context.msSinceClick >= 0 &&
        context.msSinceClick <= 5000,
      "interação recente"
    ]
  ];

  if (hasContentEvidence) {
    for (const [active, reason] of signals) {
      if (active) add(reason, 1, false);
    }
  }

  let level = "none";
  if (hasContentEvidence && score >= 1) level = "low";
  if (hasContentEvidence && score >= 4 && value.length >= 20) level = "high";

  return { score, level, reasons };
}
