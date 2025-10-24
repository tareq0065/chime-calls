import React, { useEffect, useMemo, useRef } from "react";
import { useMeeting } from "../hooks";
import { VideoTileState } from "amazon-chime-sdk-js";

export function RemoteVideo({
  attendeeId,
  ...props
}: React.VideoHTMLAttributes<HTMLVideoElement> & { attendeeId?: string }) {
  const { audioVideo, remoteTiles } = useMeeting();
  const ref = useRef<HTMLVideoElement | null>(null);

  const tile: VideoTileState | undefined = useMemo(() => {
    if (!remoteTiles || remoteTiles.length === 0) return undefined;
    const chosen = attendeeId
      ? remoteTiles.find((t) => t.boundAttendeeId === attendeeId)
      : remoteTiles[0];
    console.log("[RemoteVideo] choose tile", {
      requestedAttendeeId: attendeeId,
      chosen: chosen
        ? {
            tileId: chosen.tileId,
            attendeeId: chosen.boundAttendeeId,
            active: chosen.active,
          }
        : null,
      remoteCount: remoteTiles.length,
    });
    return chosen;
  }, [remoteTiles, attendeeId]);

  useEffect(() => {
    const el = ref.current;
    const tid = tile?.tileId;

    // bind only if tileId is a number and we have an element
    if (audioVideo && typeof tid === "number" && el) {
      console.log("[RemoteVideo] bind", {
        tileId: tid,
        attendeeId: tile?.boundAttendeeId,
      });
      audioVideo.bindVideoElement(tid, el);

      return () => {
        console.log("[RemoteVideo] unbind", { tileId: tid });
        // guard unbind too
        if (typeof tid === "number") audioVideo.unbindVideoElement(tid);
        (el as any).srcObject = null;
      };
    }
    // fallback cleanup if we didn’t bind
    return () => {
      if (el) (el as any).srcObject = null;
    };
  }, [audioVideo, tile?.tileId]); // deliberately only depends on numeric id

  return <video ref={ref} autoPlay playsInline {...props} />;
}
