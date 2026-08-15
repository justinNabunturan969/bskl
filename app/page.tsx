import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mic, FileText, Languages, Wifi, Shield, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">BSKL</span>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard">Open app</Link>
          </Button>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Record. Transcribe. <span className="text-primary">Understand.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Turn lectures and meetings into study-ready notes and meeting minutes.
              Free, no sign-up, multilingual, and your data stays yours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/dashboard">Try it now — no sign-up</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Free for students. No email, no account, no data sold.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-16 max-w-5xl mx-auto">
            {[
              { icon: Mic, title: "Live & batch recording", desc: "Record in the moment or upload pre-recorded audio in any format." },
              { icon: FileText, title: "AI-generated notes", desc: "Outline, bullets, or paragraph — all from one transcript." },
              { icon: Languages, title: "Multilingual playback", desc: "Auto-detects Tagalog, English, Cebuano and more in TTS." },
              { icon: Wifi, title: "Offline-first", desc: "Record and queue processing — syncs when you're back online." },
              { icon: Shield, title: "Your data, your control", desc: "Soft-delete with 30-day recovery. Nothing is lost without warning." },
              { icon: Sparkles, title: "100% free stack", desc: "No paid APIs, no subscriptions. Built on open-source models." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border bg-card p-5 space-y-2">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        BSKL — BrainScribe Knowledge Lab · A thesis project
      </footer>
    </main>
  );
}