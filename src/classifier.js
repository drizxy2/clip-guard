const COMMAND_PATTERNS = [
  { name: "powershell/pwsh", pattern: /\b(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\b/i },
  { name: "cmd /c", pattern: /\bcmd(?:\.exe)?\s+\/c\b/i },
  { name: "mshta", pattern: /\bmshta(?:\.exe)?\b/i },
  { name: "rundll32", pattern: /\brundll32(?:\.exe)?\b/i },
  { name: "certutil", pattern: /\bcertutil(?:\.exe)?\b/i },
  { name: "bitsadmin", pattern: /\bbitsadmin(?:\.exe)?\b/i },
  { name: "substring de variável de ambiente", pattern: /%COMSPEC(?::[^%\r\n]*)?%\s*\/[ck]\b/i },
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
const MAX_CLASSIFY_LENGTH = 100 * 1024;
const EDGE_SCAN_LENGTH = 50 * 1024;
const KNOWN_COMMANDS = new Set([
  "powershell", "powershell.exe", "pwsh", "pwsh.exe", "cmd", "cmd.exe",
  "mshta", "mshta.exe", "rundll32", "rundll32.exe", "certutil", "certutil.exe",
  "bitsadmin", "bitsadmin.exe", "curl", "wget", "bash", "bash.exe", "iex",
  "invoke-expression", "downloadstring"
]);
const HOMOGLYPHS = new Map([
  ["а", "a"], ["с", "c"], ["е", "e"], ["і", "i"], ["ј", "j"],
  ["к", "k"], ["м", "m"], ["о", "o"], ["р", "p"], ["ѕ", "s"],
  ["х", "x"], ["у", "y"], ["Α", "a"], ["Β", "b"], ["Ε", "e"],
  ["Ι", "i"], ["Κ", "k"], ["Μ", "m"], ["Ν", "n"], ["Ο", "o"],
  ["Ρ", "p"], ["Τ", "t"], ["Χ", "x"], ["α", "a"], ["ο", "o"],
  ["ρ", "p"], ["τ", "t"], ["χ", "x"]
]);
const ENCODED_COMMAND = /(?:^|\s)-(?:enc|encodedcommand|e)\s+["']?([A-Za-z0-9+/]+={0,2})/gi;

function joinSplitCommands(text) {
  if (!/[\r\n]/.test(text)) return text;
  let normalized = text;
  for (const command of KNOWN_COMMANDS) {
    const pieces = [...command]
      .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(?:[ \\t]*\\r?\\n[ \\t]*)?");
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}_.-])${pieces}(?![\\p{L}\\p{N}_.-])`,
      "giu"
    );
    normalized = normalized.replace(pattern, (match) =>
      /[\r\n]/.test(match) ? command : match
    );
  }
  return normalized;
}

function normalizeText(text) {
  let normalized = text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/([\p{L}\p{N}])[\^"'`]+(?=[\p{L}\p{N}])/gu, "$1");

  normalized = normalized.replace(
    /(["'])([\p{L}\p{N}_-]+)\1(?:\s*\+\s*(["'])([\p{L}\p{N}_-]+)\3)+/gu,
    (expression) => [...expression.matchAll(/(["'])([\p{L}\p{N}_-]+)\1/gu)]
      .map((match) => match[2])
      .join("")
  );
  normalized = joinSplitCommands(normalized);

  return normalized.replace(/[\p{L}\p{N}_.-]+/gu, (token) => {
    const mapped = [...token].map((character) => HOMOGLYPHS.get(character) ?? character).join("");
    return KNOWN_COMMANDS.has(mapped.toLowerCase()) ? mapped : token;
  });
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
  const source = typeof text === "string" ? text : "";
  let value = source;
  if (source.length > MAX_CLASSIFY_LENGTH) {
    let first = source.slice(0, EDGE_SCAN_LENGTH);
    if (/[A-Za-z0-9+/=]/.test(source[EDGE_SCAN_LENGTH])) {
      ENCODED_COMMAND.lastIndex = 0;
      let incompleteEncodedCommand;
      for (const match of first.matchAll(ENCODED_COMMAND)) {
        if (match.index + match[0].length === first.length) incompleteEncodedCommand = match;
      }
      if (incompleteEncodedCommand) first = first.slice(0, incompleteEncodedCommand.index);
    }
    value = `${first}\n${source.slice(-EDGE_SCAN_LENGTH)}`;
  }
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
