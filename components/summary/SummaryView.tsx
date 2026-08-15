import { cn } from "@/lib/utils";
import type { SummaryFormat } from "@/lib/summarize/types";

interface Props {
  content: string;
  format: SummaryFormat;
  className?: string;
}

/**
 * Tiny markdown-ish renderer tuned for the 3 summary formats.
 * Handles: "## " headings, "- " bullets (with one indent level), blank-line
 * paragraphs. Renders **bold** inline. Anything else is shown as plain text.
 */
export function SummaryView({ content, format, className }: Props) {
  if (!content) {
    return (
      <p className={cn("text-sm text-muted-foreground italic", className)}>
        No summary yet.
      </p>
    );
  }

  if (format === "paragraph") {
    return (
      <div className={cn("text-sm leading-relaxed", className)}>
        {content
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((para, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {renderInline(para)}
            </p>
          ))}
      </div>
    );
  }

  // Outline + bullets — line-based parsing
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listItems: { indent: number; nodes: React.ReactNode[] } | null = null;
  let key = 0;

  const flush = () => {
    if (listItems) {
      out.push(
        <ul
          key={`ul-${key++}`}
          className={cn(
            "list-disc space-y-1 my-2",
            listItems.indent > 0 ? "ml-8" : "ml-5"
          )}
        >
          {listItems.nodes.map((node, i) => (
            <li key={i} className="leading-relaxed">
              {node}
            </li>
          ))}
        </ul>
      );
      listItems = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }

    if (line.startsWith("## ")) {
      flush();
      out.push(
        <h3
          key={`h-${key++}`}
          className="text-base font-semibold mt-4 mb-1 first:mt-0"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }

    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length >= 2 ? 1 : 0;
      if (!listItems || listItems.indent !== indent) {
        flush();
        listItems = { indent, nodes: [] };
      }
      listItems.nodes.push(renderInline(bulletMatch[2]));
      continue;
    }

    // Plain line — flush any list and render as a paragraph
    flush();
    out.push(
      <p key={`p-${key++}`} className="leading-relaxed my-2 text-sm">
        {renderInline(line)}
      </p>
    );
  }
  flush();

  return <div className={cn("text-sm", className)}>{out}</div>;
}

/** Render **bold** inline. Everything else is plain text. */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={k++}>{m[1]}</strong>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 0 ? text : <>{parts}</>;
}
