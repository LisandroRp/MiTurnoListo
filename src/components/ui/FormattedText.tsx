import { ReactNode } from "react";

import { cx } from "@/components/ui/utils";

function renderInline(value: string, depth = 0): ReactNode {
  if (depth >= 4) return value;
  const matches = value.matchAll(/(\*\*|__)(.+?)\1/g);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    const index = match.index;
    parts.push(value.slice(cursor, index));
    const content = renderInline(match[2], depth + 1);
    parts.push(match[1] === "**"
      ? <strong key={index}>{content}</strong>
      : <span key={index} className="underline">{content}</span>);
    cursor = index + match[0].length;
  }
  parts.push(value.slice(cursor));
  return parts;
}

export function FormattedText({ value, className, align = "left" }: { value: string; className?: string; align?: "left" | "center" }) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const start = index;
    if (/^- /.test(lines[index])) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^- /.test(lines[index])) {
        items.push(<li key={index}>{renderInline(lines[index].slice(2))}</li>);
        index++;
      }
      blocks.push(<ul key={start} className={cx("list-disc space-y-1", align === "center" ? "list-inside" : "pl-5")}>{items}</ul>);
    } else {
      const paragraph: string[] = [];
      while (index < lines.length && !/^- /.test(lines[index])) {
        paragraph.push(lines[index]);
        index++;
      }
      blocks.push(<p key={start} className="whitespace-pre-line">{renderInline(paragraph.join("\n"))}</p>);
    }
  }
  return <div className={cx("space-y-1 break-words", align === "center" ? "text-center" : "text-left", className)}>{blocks}</div>;
}
