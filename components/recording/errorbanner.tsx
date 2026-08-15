"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
      {onDismiss && (
        <Button variant="ghost" size="icon" onClick={onDismiss} className="h-7 w-7" aria-label="Dismiss error">
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
