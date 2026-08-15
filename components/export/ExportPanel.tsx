"use client";

import { useState, useTransition } from "react";
import { Download, FileText, FileType, FileCode, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  type ExportPayload,
  exportToMarkdown,
  exportToPdf,
  exportToDocx,
} from "@/lib/export";
import type { SummaryFormat } from "@/lib/summarize/types";

interface Props {
  title: string;
  context: string;
  createdAt: string;
  transcriptText: string | null;
  summaryContent: string | null;
  summaryFormat: SummaryFormat | null;
}

type FormatKey = "md" | "pdf" | "docx";

interface FormatOption {
  key: FormatKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMATS: FormatOption[] = [
  {
    key: "md",
    label: "Markdown",
    description: "Plain text, easy to edit or paste anywhere.",
    icon: FileCode,
  },
  {
    key: "pdf",
    label: "PDF",
    description: "Print-ready document with title page and pagination.",
    icon: FileText,
  },
  {
    key: "docx",
    label: "DOCX",
    description: "Editable Word document, ready to share or annotate.",
    icon: FileType,
  },
];

export function ExportPanel({
  title,
  context,
  createdAt,
  transcriptText,
  summaryContent,
  summaryFormat,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [activeFormat, setActiveFormat] = useState<FormatKey | null>(null);

  const payload: ExportPayload = {
    title,
    context,
    createdAt,
    transcriptText,
    summaryContent,
    summaryFormat,
  };

  const hasContent = !!transcriptText || !!summaryContent;

  function handleExport(key: FormatKey) {
    if (!hasContent) {
      toast.error("Nothing to export yet — record or generate a summary first.");
      return;
    }
    setActiveFormat(key);
    startTransition(async () => {
      try {
        if (key === "md") {
          exportToMarkdown(payload);
        } else if (key === "pdf") {
          exportToPdf(payload);
        } else {
          await exportToDocx(payload);
        }
        toast.success(
          `Exported as ${FORMATS.find((f) => f.key === key)?.label ?? key}`
        );
      } catch (err: any) {
        toast.error(err?.message || "Export failed");
      } finally {
        setActiveFormat(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4 text-primary" />
          Export
        </CardTitle>
        <CardDescription>
          {hasContent
            ? "Download this note as a file you can share or archive."
            : "Waiting for transcript or summary before export is available."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-3">
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            const isBusy = pending && activeFormat === fmt.key;
            return (
              <Button
                key={fmt.key}
                variant="outline"
                onClick={() => handleExport(fmt.key)}
                disabled={pending || !hasContent}
                className="h-auto flex flex-col items-start gap-1 py-3 px-3 text-left whitespace-normal"
                aria-label={`Export as ${fmt.label}`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {fmt.label}
                </span>
                <span className="text-xs font-normal text-muted-foreground leading-snug">
                  {fmt.description}
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
