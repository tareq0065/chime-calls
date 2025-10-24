import React, { useEffect, useRef } from "react";
import { useMeeting } from "../hooks";

export function LocalVideo(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const { audioVideo, localTileId } = useMeeting();
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const tid = localTileId;
    if (audioVideo && typeof tid === "number" && el) {
      audioVideo.bindVideoElement(tid, el);
      return () => {
        if (typeof tid === "number") audioVideo.unbindVideoElement(tid);
        (el as any).srcObject = null;
      };
    }
    return () => {
      if (el) (el as any).srcObject = null;
    };
  }, [audioVideo, localTileId]);

  return <video ref={ref} autoPlay playsInline {...props} />;
}
