/**
 * Converts untrusted scalar text into a single printable line without changing
 * visible Unicode characters. Length limits remain the caller's responsibility.
 */
export function normalizeSingleLineText(value: string): string {
  const printableSegments: string[] = [];
  let segmentStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) {
      if (segmentStart < index) printableSegments.push(value.slice(segmentStart, index));
      printableSegments.push(" ");
      segmentStart = index + 1;
    }
  }

  if (segmentStart < value.length) printableSegments.push(value.slice(segmentStart));
  return printableSegments.join("").replace(/\s+/g, " ").trim();
}
