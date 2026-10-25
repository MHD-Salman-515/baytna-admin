"use client";

import { useCallback, useEffect, useState } from "react";

/** Whole-second countdown for the OTP resend button. */
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const start = useCallback((seconds: number) => setSecondsLeft(Math.max(0, Math.ceil(seconds))), []);
  return { secondsLeft, start };
}
