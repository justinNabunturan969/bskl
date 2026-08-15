import { Mic } from "lucide-react";

import { RecordingPanel } from "@/components/recording/recordingPanel";

export default function RecordPage() {

  return (

    <div className="container mx-auto p-4 md:p-8 max-w-3xl">

      <div className="mb-6">

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">

          <Mic className="h-6 w-6" /> Record

        </h1>

        <p className="text-muted-foreground">

          Capture lectures or meetings. Add multiple clips, then save when ready.

        </p>

      </div>

      <RecordingPanel />

    </div>

  );

} 