import React, { useMemo } from "react";
import { useMeeting } from "./hooks";
import { RemoteVideo } from "./components/RemoteVideo";
import { LocalVideo } from "./components/LocalVideo";
import {
  CameraOffIcon,
  CameraOnIcon,
  CloseIcon,
  MicrophoneOnIcon,
  PhoneIcon,
} from "./components/icons";

const circleBtn: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  border: "none",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  lineHeight: 0,
};

function formatTime(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallModal({
  open,
  zIndex = 9999,
}: {
  open?: boolean;
  zIndex?: number;
}) {
  const {
    state,
    incomingCall,
    currentPeer,
    toggleMic,
    toggleCam,
    leave,
    acceptCall,
    declineCall,
    isMicOn,
    isCamOn,
    elapsedSeconds,
  } = useMeeting();

  const visible =
    typeof open === "boolean"
      ? open
      : !!incomingCall || state === "inCall" || state === "joining";

  const peer = incomingCall?.from || currentPeer;
  const inCall = state === "inCall";
  console.log("peer:", peer);

  const formattedTime = useMemo(
    () => formatTime(elapsedSeconds || 0),
    [elapsedSeconds],
  );

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(0,0,0,0.88)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: "#0b0b0b",
          color: "#fff",
          borderRadius: 20,
          padding: 24,
          textAlign: "center",
          boxShadow: "0 16px 60px rgba(0,0,0,0.6)",
          position: "relative",
        }}
      >
        {/* Video Area */}
        {inCall ? (
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 280,
              borderRadius: 12,
              overflow: "hidden",
              background: "#111",
            }}
          >
            {/* Remote video full */}
            <RemoteVideo
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
              }}
            />

            {/* Local video pip */}
            <LocalVideo
              muted
              style={{
                position: "absolute",
                width: 120,
                height: 90,
                bottom: 8,
                right: 8,
                borderRadius: 8,
                background: "#222",
                border: "2px solid #333",
                objectFit: "cover",
              }}
            />
          </div>
        ) : (
          // Avatar / call preview before accept
          <div
            style={{
              display: "grid",
              placeItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "#111",
                overflow: "hidden",
                border: "2px solid #1f2937",
              }}
            >
              {peer?.avatarUrl ? (
                <img
                  src={peer.avatarUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 36,
                  }}
                >
                  <PhoneIcon
                    style={{
                      width: 36,
                      height: 36,
                      color: "#22c55e",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Peer info */}
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
          {peer?.name}
        </div>

        {peer?.username && (
          <div style={{ opacity: 0.8, marginTop: 4 }}>@{peer.username}</div>
        )}

        {peer?.location && (
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 14 }}>
            {peer.location}
          </div>
        )}

        <div
          style={{
            opacity: 0.6,
            marginTop: 12,
            fontSize: 13,
            minHeight: 18,
          }}
        >
          {incomingCall
            ? "Incoming call…"
            : state === "joining"
              ? "Connecting…"
              : inCall
                ? "In call"
                : ""}
        </div>
        {inCall && (
          <div
            style={{
              fontSize: 16,
              color: "#9ca3af",
              minWidth: 60,
              textAlign: "center",
            }}
          >
            {formattedTime}
          </div>
        )}

        {/* Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 20,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Incoming call controls */}
          {incomingCall ? (
            <>
              {/* Decline */}
              <button
                onClick={declineCall}
                style={{ ...circleBtn, background: "#ef4444" }}
                title="Decline"
              >
                <CloseIcon
                  style={{ width: 28, height: 28, color: "#fff" }}
                  strokeWidth={2}
                />
              </button>

              {/* Accept */}
              <button
                onClick={acceptCall}
                style={{ ...circleBtn, background: "#22c55e" }}
                title="Accept"
              >
                <PhoneIcon
                  style={{ width: 28, height: 28, color: "#fff" }}
                  strokeWidth={2}
                />
              </button>
            </>
          ) : (
            <>
              {/* Mic toggle */}
              <button
                onClick={toggleMic}
                style={{
                  ...circleBtn,
                  background: isMicOn ? "#22c55e" : "#9ca3af",
                }}
                title={isMicOn ? "Mute" : "Unmute"}
              >
                <MicrophoneOnIcon
                  style={{
                    width: 28,
                    height: 28,
                    color: "#fff",
                  }}
                />
              </button>

              {/* Camera toggle */}
              <button
                onClick={toggleCam}
                style={{
                  ...circleBtn,
                  background: isCamOn ? "#22c55e" : "#9ca3af",
                }}
                title={isCamOn ? "Turn camera off" : "Turn camera on"}
              >
                {isCamOn ? (
                  <CameraOnIcon
                    style={{
                      width: 28,
                      height: 28,
                      color: "#fff",
                    }}
                    strokeWidth={1.5}
                  />
                ) : (
                  <CameraOffIcon
                    style={{
                      width: 28,
                      height: 28,
                      color: "#fff",
                    }}
                    strokeWidth={1.5}
                  />
                )}
              </button>

              {/* Hang up / End call */}
              <button
                onClick={leave}
                style={{ ...circleBtn, background: "#ef4444" }}
                title="End call"
              >
                <CloseIcon
                  style={{ width: 28, height: 28, color: "#fff" }}
                  strokeWidth={2}
                />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
