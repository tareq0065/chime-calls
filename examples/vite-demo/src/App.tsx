import React from "react";
import {
  MeetingProvider,
  CallModal,
  useMeeting,
  type UserInfo,
} from "@airoom/chime-calls";
import MediaDiag from "./MediaDiag";

function useSelfFromQuery(): UserInfo {
  const sp = new URLSearchParams(window.location.search);
  const id = sp.get("id") || "user-" + Math.random().toString(36).slice(2);
  return {
    id,
    name: sp.get("name") || undefined,
    username: sp.get("username") || undefined,
    location: sp.get("location") || undefined,
    avatarUrl: "https://placehold.co/600x400/000000/FFFFFF/png",
  };
}

export default function App() {
  const self = useSelfFromQuery();

  // Simple UI states for demo feedback
  const [status, setStatus] = React.useState<string>("Idle");
  const [callDuration, setCallDuration] = React.useState<string>("00:00");

  return (
    <MeetingProvider
      self={self}
      maxCallDurationSec={600} // 10 minutes auto-hangup
      events={{
        onIncomingCall: (room, from) => {
          console.log("📞 incoming", room, from);
          setStatus(`Incoming call from ${from?.name || from.id}`);
        },
        onCallStart: (room, peer, startTime) => {
          console.log("✅ Call started", room, peer, startTime);
          setStatus(`In call with ${peer?.name || peer.id}`);
        },
        onCallTimeElapsed: ({ minutes, seconds, totalSeconds }) => {
          const mm = String(minutes).padStart(2, "0");
          const ss = String(seconds).padStart(2, "0");
          setCallDuration(`${mm}:${ss}`);
        },
        onBusy: (room, by) => {
          console.log("🚫 Busy:", room, by);
          setStatus(`${by?.name || by.id} is busy`);
        },
        onCallEnd: (room, endTime) => {
          console.log("❌ Call ended", room, endTime);
          setStatus("Call ended");
          setCallDuration("00:00");
        },
      }}
    >
      <CallModal />
      <DemoControls status={status} callDuration={callDuration} />
    </MeetingProvider>
  );
}

function DemoControls({
  status,
  callDuration,
}: {
  status: string;
  callDuration: string;
}) {
  const { startCall, self } = useMeeting() as any;
  const [peerId, setPeerId] = React.useState("");

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 8 }}>
        You: <b>{self?.name || self?.username || self?.id}</b>
      </div>

      <input
        style={{
          padding: "6px 8px",
          marginRight: 8,
          border: "1px solid #ccc",
          borderRadius: 4,
        }}
        value={peerId}
        onChange={(e) => setPeerId(e.target.value)}
        placeholder="Enter peer id (e.g. bob)"
      />

      <button
        style={{
          padding: "6px 12px",
          borderRadius: 4,
          border: "none",
          background: "#0078ff",
          color: "white",
          cursor: "pointer",
        }}
        onClick={() => startCall({ id: peerId })}
      >
        Call
      </button>

      <div style={{ marginTop: 16 }}>
        <div>
          Status: <b>{status}</b>
        </div>
        <div>
          Duration: <b>{callDuration}</b>
        </div>
      </div>

      <MediaDiag />
    </div>
  );
}
