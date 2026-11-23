const REASON_KEYS = new Map([
  ["PowerShell/pwsh", "reasonPowershell"],
  ["cmd /c", "reasonCmd"],
  ["mshta", "reasonMshta"],
  ["rundll32", "reasonRundll32"],
  ["certutil transferência/decodificação", "reasonCertutil"],
  ["bitsadmin", "reasonBitsadmin"],
  ["substring de variável de ambiente", "reasonEnvironmentSubstring"],
  ["curl/wget para shell", "reasonCurlPipe"],
  ["bash -c", "reasonBash"],
  ["PowerShell encoded command", "reasonEncoded"],
  ["PowerShell oculto", "reasonHidden"],
  ["PowerShell IEX/DownloadString", "reasonIex"],
  ["download em diretório gravável + execução indireta", "reasonDownloadExecution"],
  ["variáveis de ambiente do cmd com encadeamento", "reasonEnvironmentChain"],
  ["host numérico sem esquema", "reasonNumericHost"],
  ["base64 longo", "reasonBase64"],
  ["frase de verificação com comando", "reasonVerification"],
  ["quebra de linha final", "reasonTrailingNewline"],
  ["documento em fullscreen", "reasonFullscreen"],
  ["iframe cross-origin", "reasonCrossOriginFrame"],
  ["interação recente", "reasonRecentInteraction"],
  ["iframe", "reasonIframe"]
]);

const METHOD_KEYS = new Map([
  ["navigator.clipboard.writeText", "methodWriteText"],
  ["navigator.clipboard.write", "methodWrite"],
  ["document.execCommand('copy')", "methodExecCopy"],
  ["document.execCommand('cut')", "methodExecCopy"],
  ["DataTransfer.setData", "methodCopyEvent"],
  ["copy event selection", "methodCopyEvent"],
  ["cut event selection", "methodCopyEvent"],
  ["paste event", "methodManualPaste"],
  ["beforeinput insertFromPaste", "methodManualPaste"],
  ["drop event", "methodManualPaste"]
]);

export function message(getMessage, key, substitutions) {
  const value = getMessage(key, substitutions);
  if (!value) throw new Error(`Missing i18n message: ${key}`);
  return value;
}

export function translateReason(reason, getMessage) {
  const directKey = REASON_KEYS.get(reason);
  if (directKey) return message(getMessage, directKey);
  const firstToken = reason.match(/^primeiro token de comando \(([^)]+)\)$/);
  if (firstToken) return message(getMessage, "reasonFirstToken", firstToken[1]);
  const chain = reason.match(/^encadeamento (.+)$/);
  if (chain) return message(getMessage, "reasonChain", chain[1]);
  return reason;
}

export function translateMethod(method, getMessage) {
  const key = METHOD_KEYS.get(method);
  return key ? message(getMessage, key) : method;
}
