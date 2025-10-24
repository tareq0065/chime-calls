import React from "react";
import { useMediaPermissions } from "@/permissions/useMediaPermissions";

export const PermissionsGate: React.FC<{
  requireVideo?: boolean;
  onReady: () => void;
}> = ({ requireVideo = false, onReady }) => {
  const { mic, cam, checking, request } = useMediaPermissions();

  const needsPrompt =
    (mic !== "granted" && mic !== "unknown") ||
    (requireVideo && cam !== "granted" && cam !== "unknown");

  const handleContinue = async () => {
    try {
      await request({ audio: true, video: !!requireVideo });
    } catch (e) {
      // even if it fails, let user proceed; join() will prompt again as needed
      console.warn("[PermGate] request failed, proceeding:", e);
    }
    onReady();
  };

  if (!needsPrompt) return null;

  return <></>;
};
