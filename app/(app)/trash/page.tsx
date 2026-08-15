import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

function TrashPageInner() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" /> Trash
          </CardTitle>
          <CardDescription>Soft-deleted recordings — coming in Phase 10</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recover recordings within 30 days of deletion.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrashPage() {
  return (
    <Suspense fallback={null}>
      <TrashPageInner />
    </Suspense>
  );
}