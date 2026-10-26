export type TextFormat = "bold" | "underline" | "list";

export function applyTextFormat(value: string, start: number, end: number, format: TextFormat) {
  if (format === "list") {
    const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const selectionEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextBreak < 0 ? value.length : nextBreak;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const remove = lines.every((line) => line.startsWith("- "));
    const replacement = lines.map((line) => remove ? line.slice(2) : line.startsWith("- ") ? line : `- ${line}`).join("\n");
    return { value: value.slice(0, lineStart) + replacement + value.slice(lineEnd), start: lineStart, end: lineStart + replacement.length };
  }

  const marker = format === "bold" ? "**" : "__";
  const selected = value.slice(start, end);
  if (start >= 2 && value.slice(start - 2, start) === marker && value.slice(end, end + 2) === marker) {
    const lines = value.slice(start - 2, end + 2).split("\n");
    const replacement = lines.every((line) => !line || (line.startsWith(marker) && line.endsWith(marker)))
      ? lines.map((line) => line ? line.slice(2, -2) : line).join("\n")
      : selected;
    return { value: value.slice(0, start - 2) + replacement + value.slice(end + 2), start: start - 2, end: start - 2 + replacement.length };
  }
  const replacement = selected.split("\n").map((line) => line ? `${marker}${line}${marker}` : line).join("\n");
  if (!selected) {
    return { value: value.slice(0, start) + marker + marker + value.slice(end), start: start + 2, end: start + 2 };
  }
  return { value: value.slice(0, start) + replacement + value.slice(end), start: start + 2, end: start + replacement.length - 2 };
}
