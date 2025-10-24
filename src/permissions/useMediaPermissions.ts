/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";

export type MediaPermState = "granted" | "denied" | "prompt" | "unknown";

export function useMediaPermissions() {
  const [mic, setMic] = useState<MediaPermState>("unknown");
  const [cam, setCam] = useState<MediaPermState>("unknown");
  const [checking, setChecking] = useState(true);

  const query = useCallback(async () => {
    setChecking(true);
    try {
      const p: any = (navigator as any).permissions;
      if (p?.query) {
        try {
          const micQ = await p.query({ name: "microphone" as any });
          setMic(micQ.state as MediaPermState);
          micQ.onchange = () => setMic(micQ.state as MediaPermState);
        } catch {
          setMic("unknown");
        }
        try {
          const camQ = await p.query({ name: "camera" as any });
          setCam(camQ.state as MediaPermState);
          camQ.onchange = () => setCam(camQ.state as MediaPermState);
        } catch {
          setCam("unknown");
        }
      } else {
        setMic("unknown");
        setCam("unknown");
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    query();
  }, [query]);

  const request = useCallback(
    async (opts: { audio: boolean; video: boolean }) => {
      const canGUM = !!navigator.mediaDevices?.getUserMedia;
      if (!canGUM) throw new Error("getUserMedia_not_available");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: opts.audio,
        video: opts.video,
      });
      // Immediately release devices; Chime will acquire them later.
      stream.getTracks().forEach((t) => t.stop());
      await query(); // refresh states
    },
    [query],
  );

  return { mic, cam, checking, request };
}
