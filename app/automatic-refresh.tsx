"use client";

import {useEffect, useTransition} from "react";
import {useRouter} from "next/navigation";
import {lifecycleRefreshDelay} from "../lib/predictive-compass/lifecycle-refresh";

export function AutomaticRefresh({kickoff = null, ready = false, interval}: {kickoff?: string | null; ready?: boolean; interval?: number}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden || pending) return;
      timer = setTimeout(() => startTransition(() => router.refresh()), interval ?? lifecycleRefreshDelay(kickoff, ready));
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {clearTimeout(timer); document.removeEventListener("visibilitychange", schedule);};
  }, [router, kickoff, ready, interval, pending]);
  return null;
}
