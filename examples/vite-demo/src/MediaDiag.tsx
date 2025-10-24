import React, { useEffect, useState } from "react";

export default function MediaDiag() {
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    (async () => {
      const nav: any = navigator;
      const origin = window.location.origin;
      const secure =
        window.isSecureContext ||
        origin.startsWith("https://") ||
        origin.startsWith("http://localhost");

      const hasMD = !!nav.mediaDevices;
      const hasGUM = !!nav.mediaDevices?.getUserMedia;
      const hasEnum = !!nav.mediaDevices?.enumerateDevices;

      let permMic: any = "n/a";
      let permCam: any = "n/a";
      if ("permissions" in navigator) {
        try {
          // @ts-ignore
          const pm = await (navigator as any).permissions.query({
            name: "microphone",
          });
          permMic = pm.state;
        } catch {}
        try {
          // @ts-ignore
          const pc = await (navigator as any).permissions.query({
            name: "camera",
          });
          permCam = pc.state;
        } catch {}
      }

      let enumResult: any[] | string = "enumerateDevices() not available";
      if (hasEnum) {
        try {
          enumResult = (await nav.mediaDevices.enumerateDevices()).map(
            (d: MediaDeviceInfo) => ({
              kind: d.kind,
              label: d.label || "(no label)",
              deviceId: d.deviceId?.slice(0, 6) + "...",
              groupId: d.groupId?.slice(0, 6) + "...",
            }),
          );
        } catch (e: any) {
          enumResult = `enumerateDevices error: ${e?.name || e?.message || e}`;
        }
      }

      let gumError: string | null = null;
      if (hasGUM) {
        try {
          const s = await nav.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          s.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        } catch (e: any) {
          gumError = `${e?.name || "GUMError"}: ${e?.message || e}`;
        }
      }

      setInfo({
        origin,
        secureContext: secure,
        hasNavigatorMediaDevices: hasMD,
        hasGetUserMedia: hasGUM,
        hasEnumerateDevices: hasEnum,
        permissionMicrophone: permMic,
        permissionCamera: permCam,
        enumerateDevices: enumResult,
        gumError,
        userAgent: navigator.userAgent,
      });
    })();
  }, []);

  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        fontSize: 12,
        padding: 12,
        background: "#111",
        color: "#eee",
        borderRadius: 8,
      }}
    >
      {JSON.stringify(info, null, 2)}
    </pre>
  );
}
