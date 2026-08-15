"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSession } from "@/lib/supabase/session";

/** Bootstraps the anonymous Supabase session on first app load. */
export function SessionBootstrap() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    bootstrapSession()
      .then((result) => {
        if (result.ok) router.refresh();
      })
      .catch(() => {
        // Non-fatal — pages will retry via ensureUser.
      });
  }, [router]);

  return null;
}
