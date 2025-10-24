# ChimeCalls

ChimeCalls is a lightweight 1:1 calling layer built on top of the Amazon Chime SDK.

It gives you:

- A minimal Node server that handles meeting/session lifecycle.
- A React UI layer you can drop into any app to start/join calls.
- Shared hooks and context for managing mic/camera state, permissions, call status, etc.
- A strict import style: `src` is the root, imports use `@/...`, and no file extensions.

Goal: add WhatsApp-style calling to your app without rebuilding WebRTC.

---

## ✨ Features

- **1-to-1 call flow**
  Caller can ring callee, callee can accept, both get joined into the same Chime meeting.

- **React Provider (`<MeetingProvider />`)**
  Manages call state, audio/video lifecycle, local tile attach, cleanup on leave.

- **Prebuilt UI components**
  - `<CallModal />` – outgoing / incoming call UI (ringing, accept, end).

- **Chime SDK integration**
  All the `audioVideo` setup lives in hooks so you don't touch the Chime SDK directly for basic flows.

- **TypeScript-first**

---

## 📦 Project Structure

`src` is the root of truth. All code (UI + server + hooks + types) lives under `src/`. We do **not** use long relative paths like `../../..`.

```txt
src/
  server/              # Call server logic (create/join/end, signaling helpers)
    createServer.ts
    ...

  ui/                  # React UI layer (ready-to-use call components)
    CallModal.tsx
    MeetingProvider.tsx
    ...

  hooks/               # Reusable call state/media hooks
    useMeeting.ts
    ...

  permissions/
    PermissionsGate.tsx
    ...

  types/
    *.ts               # Shared types/interfaces

  index.ts             # Package entry exports
```

- Everything imports from `@/` which maps to `src/`.
- Example: `@/hooks/useMeeting` → `src/hooks/useMeeting.ts`.

---

## 🚀 Quick Start

### 1. Install

This package assumes React (18+ / 19), TypeScript, and a Node server that can talk to AWS Chime.

```bash
npm install @tareq0065/chime-calls
```

or

```bash
yarn add @tareq0065/chime-calls
```

(When developing locally in a monorepo, you can use `npm link` / `workspace:*` for this package.)

---

### 2. Server setup

The server is responsible for:

- creating a Chime meeting for a "room"
- registering attendees (caller / callee)
- returning join info
- ending/cleanup

Example usage:

```ts
import { createServer } from "@/server/createServer";

async function main() {
  const app = await createServer({
    // region, auth, etc.
  });

  app.listen(8080, () => {
    console.log("ChimeCalls server running on :8080");
  });
}

main();
```

Your client will hit this server via routes like:

- `/api/calls/start` (caller starts call)
- `/api/calls/join` (callee accepts)
- `/api/calls/end` (hang up)

You own auth and notification delivery.

---

### 3. Frontend provider

Wrap your app (or the part that needs calling) in `MeetingProvider`.

```tsx
import React from "react";
import {
  MeetingProvider,
  CallModal,
  useMeeting,
  type UserInfo,
} from "@tareq0065/chime-calls";
import MediaDiag from "./MediaDiag";

function useSelfFromQuery(): UserInfo {
  const sp = new URLSearchParams(window.location.search);
  const id = sp.get("id") || "user-" + Math.random().toString(36).slice(2);
  return {
    id,
    name: sp.get("name") || undefined,
    username: sp.get("username") || undefined,
    location: sp.get("location") || undefined,
    avatarUrl: sp.get("avatar") || undefined,
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
```

`MeetingProvider`:

- Manages call state (idle, ringing, incoming, in-call, leaving, ended)
- Manages Chime `audioVideo`
- Starts/stops local mic/camera
- Cleans up when leaving

---

### 4. Call UI

Render the provided modal UI to handle outgoing / incoming / active call screens:

```tsx
import { CallModal } from "@/ui/CallModal";

function CallUI() {
  return <CallModal />;
}
```

`CallModal` uses the shared meeting state under the hood.

---

### 5. Hooks

Main hook: `useMeeting()`.

```tsx
import { useMeeting } from "@/hooks/useMeeting";

export function CallButton({ targetUserId }: { targetUserId: string }) {
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

  return (
    <>
      {state === "idle" && (
        <button onClick={() => startCall(targetUserId)}>
          Call {targetUserId}
        </button>
      )}

      {state === "in-call" && <button onClick={hangup}>End Call</button>}
    </>
  );
}
```

Possible `state` values:

- `"idle"` – not in a call
- `"ringing"` – you started a call, waiting for callee
- `"incoming"` – someone is calling you
- `"in-call"` – connected
- `"leaving"` / `"ended"`

The hook also exposes the `audioVideo` ref from Chime, so you don't have to manually wire the raw Chime SDK for basic use.

---

### 6. PermissionsGate

Some areas of UI should only render once media permissions are available. Wrap them:

```tsx
import { PermissionsGate } from "@/permissions/PermissionsGate";

export function VideoTileArea() {
  return <PermissionsGate>{/* local / remote tiles, etc. */}</PermissionsGate>;
}
```

You can extend `PermissionsGate` with your own camera/mic permission logic.

---

## 🔁 Call lifecycle (high level)

1. **Caller presses Call**
   - Frontend calls `/api/calls/start` with `{ targetUserId }`.
   - Server creates or finds a Chime meeting for that 1:1 room and returns meeting + attendee info for the caller.
   - UI state becomes `"ringing"`.

2. **Callee gets incoming call**
   - You notify them (WebSocket/push/etc.).
   - UI shows `<CallModal />` in `"incoming"` state with Accept / Decline.

3. **Callee accepts**
   - Callee calls `/api/calls/join`.
   - Server adds them to the same meeting.
   - Both now share the same Chime meeting.
   - UI state becomes `"in-call"`.

4. **Hang up**
   - Either side calls `hangup()`.
   - Provider stops local media tracks, tells `/api/calls/end`, and moves to `"ended"`.

---

## 🔐 Responsibilities / Boundaries

- You own auth and user identity. We assume you already know `callerUserId` and `calleeUserId`.
- You own notification delivery (socket / push for incoming call).
- This package gives you:
  - Chime meeting/session lifecycle helpers on the server.
  - React provider + hooks to attach to that meeting.
  - Basic call UI primitives.

---

## ✅ Summary

- Single alias: `@/` → `src/`.
- `<MeetingProvider />` manages call lifecycle + Chime media.
- `<CallModal />` and `useMeeting()` give you UX for calling/answering/hanging up.
- Server helpers wrap Chime meeting creation/join/end for caller + callee.
- You wire in auth, user lookup, and notifications.

This is your starter kit for WhatsApp-style direct calling, built on top of Amazon Chime, without rebuilding the whole WebRTC stack yourself.
