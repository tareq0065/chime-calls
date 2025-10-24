/* eslint-disable @typescript-eslint/no-explicit-any */
import { PermissionsGate } from "@/permissions/PermissionsGate";

if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis as any;
}

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  LogLevel,
  VideoTileState,
  type AudioVideoFacade,
  type AudioVideoObserver,
} from "amazon-chime-sdk-js";
import type { UserInfo } from "./types.ts";

export type JoinInfo = { Meeting: any; Attendee: any };
export type CallState =
  | "idle"
  | "joining"
  | "inCall"
  | "leaving"
  | "ended"
  | "error";

export type CallEvents = {
  onIncomingCall?: (room: string, from: UserInfo) => void;
  onCallStart?: (room: string, peer: UserInfo, startTime: Date) => void;
  onCallEnd?: (room?: string, endTime?: Date) => void;
  onCallMute?: () => void;
  onCallUnmute?: () => void;
  onCallVideoStart?: () => void;
  onCallVideoStopped?: () => void;
  onDeclined?: (room: string, by: UserInfo) => void;
  onBusy?: (room: string, by: UserInfo) => void;
  onCallTimeElapsed?: (elapsed: {
    minutes: number;
    seconds: number;
    totalSeconds: number;
  }) => void;
};

type MeetingContextShape = {
  state: CallState;
  audioVideo: AudioVideoFacade | null;
  isMicOn: boolean;
  isCamOn: boolean;
  localTileId: number | null;
  remoteTiles: VideoTileState[];
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  leave: () => Promise<void>;
  self: UserInfo | null;
  incomingCall: { room: string; from: UserInfo } | null;
  currentPeer: UserInfo | null;
  currentRoom: string | null;
  startCall: (to: UserInfo) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  join: (info: JoinInfo) => Promise<void>;
  elapsedSeconds: number;
};

export const MeetingContext = createContext<MeetingContextShape | null>(null);

export type MeetingProviderProps = {
  self: UserInfo;
  apiBase?: string;
  ringtoneSrc?: string;
  events?: CallEvents;
  children: React.ReactNode;
  autoStartVideo?: boolean;
  maxCallDurationSec?: number;
  /** NEW (optional): ask for camera up-front too (mobile often better as false) */
  requireVideoPermission?: boolean;
};

const defaultTone = new URL(
  "../assets/ringtone.mp3",
  import.meta.url,
).toString();

export function MeetingProvider({
  self,
  apiBase = "",
  ringtoneSrc = defaultTone,
  events,
  children,
  autoStartVideo = true,
  maxCallDurationSec,
  requireVideoPermission = false,
}: MeetingProviderProps) {
  const [state, setState] = useState<CallState>("idle");
  const [audioVideo, setAudioVideo] = useState<AudioVideoFacade | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [localTileId, setLocalTileId] = useState<number | null>(null);
  const [remoteTiles, setRemoteTiles] = useState<VideoTileState[]>([]);
  const [incomingCall, setIncomingCall] = useState<{
    room: string;
    from: UserInfo;
  } | null>(null);
  const [currentPeer, setCurrentPeer] = useState<UserInfo | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [permissionsReady, setPermissionsReady] = useState(false);

  const meetingRef = useRef<DefaultMeetingSession | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const eventsRef = useRef<CallEvents | undefined>(events);
  const isStartingRef = useRef(false);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const stopRingtone = useCallback(() => {
    const el = ringtoneRef.current;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {}
  }, []);

  const bindObservers = useCallback(() => {
    const av = meetingRef.current?.audioVideo;
    if (!av) return;

    const obs: AudioVideoObserver = {
      // @ts-ignore
      audioSessionStarted: () => console.log("[AV] audioSessionStarted"),
      // @ts-ignore
      audioSessionDropped: () => console.warn("[AV] audioSessionDropped"),
      connectionDidBecomePoor: () =>
        console.warn("[AV] connectionDidBecomePoor"),
      connectionDidBecomeGood: () =>
        console.log("[AV] connectionDidBecomeGood"),
      videoTileDidUpdate: (tile: VideoTileState) => {
        if (tile.localTile) {
          setLocalTileId(tile.tileId ?? null);
          return;
        }
        setRemoteTiles((prev) => {
          const others = prev.filter(
            (t) => t.boundAttendeeId !== tile.boundAttendeeId,
          );
          if (!tile.tileId) return others;
          return [...others, tile];
        });
      },
      videoTileWasRemoved: (tileId: number) => {
        setRemoteTiles((prev) => prev.filter((t) => t.tileId !== tileId));
        if (localTileId === tileId) setLocalTileId(null);
      },
      metricsDidReceive: (m) => {
        const down = (m.globalMetricReport as any)?.availableReceiveBandwidth;
        const up = (m.globalMetricReport as any)?.availableSendBandwidth;
        console.log("[AV] metrics down/up kbps", down, up);
      },
    };

    av.addObserver(obs);
  }, [localTileId]);

  /** Join a meeting */
  const join = useCallback(
    async (joinInfo: JoinInfo) => {
      if (state === "joining" || state === "inCall") return;
      setState("joining");
      try {
        console.log("[JOIN] create session");
        const logger = new ConsoleLogger("chime", LogLevel.ERROR);
        const deviceController = new DefaultDeviceController(logger);
        const config = new MeetingSessionConfiguration(
          joinInfo.Meeting,
          joinInfo.Attendee,
        );
        const session = new DefaultMeetingSession(
          config,
          logger,
          deviceController,
        );
        meetingRef.current = session;
        const av = session.audioVideo;

        if (remoteAudioElRef.current) {
          av.bindAudioElement(remoteAudioElRef.current);
        }

        setAudioVideo(av);
        bindObservers();

        console.log("[JOIN] list mics");
        const mics = await av.listAudioInputDevices();
        if (mics.length) {
          await av.startAudioInput(mics[0].deviceId!);
          console.log("[JOIN] mic started");
        }
        console.log("[JOIN] av.start()");
        await av.start();
        console.log("[JOIN] AV started");

        // Defer camera on mobile; start immediately on desktop if enabled
        const cams = await av.listVideoInputDevices();
        if (!isMobile && autoStartVideo && cams.length) {
          await av.startVideoInput(cams[0].deviceId!);
          av.startLocalVideoTile();
          setIsCamOn(true);
          eventsRef.current?.onCallVideoStart?.();
          console.log("[JOIN] video started");
        }

        setStartTime(new Date());
        setElapsed(0);
        setState("inCall");

        if (currentRoom && currentPeer) {
          eventsRef.current?.onCallStart?.(
            currentRoom,
            currentPeer,
            new Date(),
          );
        }
      } catch (e) {
        console.error("[JOIN] error", e);
        setState("error");
      }
    },
    [bindObservers, state, currentRoom, currentPeer, autoStartVideo, isMobile],
  );

  const leave = useCallback(async () => {
    const av = meetingRef.current?.audioVideo;
    const dc = meetingRef.current?.deviceController as any;
    setState("leaving");

    try {
      await av?.stopLocalVideoTile();
      await av?.stopVideoInput();
      await av?.stopAudioInput();

      try {
        await dc?.chooseVideoInputDevice?.(null);
        await dc?.chooseAudioInputDevice?.(null);
      } catch {}

      av?.stop();

      if (currentPeer && currentRoom) {
        try {
          await fetch(`${apiBase.replace(/\/+$/, "")}/api/calls/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room: currentRoom,
              userId: self?.id,
              otherUserId: currentPeer.id,
            }),
          });
        } catch (err) {
          console.warn("Failed to notify end_call", err);
        }
      }

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const s = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          s.getTracks().forEach((t) => t.stop());
        }
      } catch {}
    } finally {
      const endTime = new Date();
      const endedRoom = currentRoom || undefined;

      setState("ended");
      setIsMicOn(false);
      setIsCamOn(false);
      setLocalTileId(null);
      setRemoteTiles([]);
      setAudioVideo(null);
      meetingRef.current = null;
      setCurrentRoom(null);

      eventsRef.current?.onCallEnd?.(endedRoom, endTime);
    }
  }, [currentRoom, currentPeer, apiBase, self?.id]);

  // Live timer
  useEffect(() => {
    if (state !== "inCall" || !startTime) return;
    const t = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsed(diff);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      eventsRef.current?.onCallTimeElapsed?.({
        minutes,
        seconds,
        totalSeconds: diff,
      });
      if (maxCallDurationSec && diff >= maxCallDurationSec) {
        console.warn("[CALL] auto-ending call at limit", diff);
        leave();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state, startTime, maxCallDurationSec, leave]);

  const toggleMic = useCallback(async () => {
    const av = meetingRef.current?.audioVideo;
    if (!av) return;
    if (isMicOn) {
      av.realtimeMuteLocalAudio();
      setIsMicOn(false);
      eventsRef.current?.onCallMute?.();
    } else {
      const devices = await av.listAudioInputDevices();
      if (devices.length) await av.startAudioInput(devices[0].deviceId!);
      av.realtimeUnmuteLocalAudio();
      setIsMicOn(true);
      eventsRef.current?.onCallUnmute?.();
    }
  }, [isMicOn]);

  const toggleCam = useCallback(async () => {
    const av = meetingRef.current?.audioVideo;
    if (!av) return;
    if (isCamOn) {
      await av.stopLocalVideoTile();
      await av.stopVideoInput();
      setIsCamOn(false);
      eventsRef.current?.onCallVideoStopped?.();
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const devices = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          devices?.getTracks()?.forEach((t) => t.stop());
        }
      } catch {}
    } else {
      const cams = await av.listVideoInputDevices();
      if (cams.length) {
        await av.startVideoInput(cams[0].deviceId!);
        av.startLocalVideoTile();
        setIsCamOn(true);
        eventsRef.current?.onCallVideoStart?.();
      }
    }
  }, [isCamOn]);

  // SSE
  useEffect(() => {
    if (!self?.id) return;
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      const u = new URL("/api/events", window.location.origin);
      if (apiBase) u.href = `${apiBase.replace(/\/+$/, "")}/api/events`;
      u.searchParams.set("userId", self.id);
      es = new EventSource(u.toString());

      es.onopen = () => console.log("[SSE] open for", self.id);
      es.onmessage = async (ev) => {
        if (!ev?.data) return;
        try {
          const msg = JSON.parse(ev.data || "{}");
          if (msg.type === "incoming_call") {
            // build best-possible peer info
            const from: UserInfo = {
              id: msg.from?.id ?? msg.fromUserId,
              name: msg.from?.name,
              username: msg.from?.username,
              avatarUrl: msg.from?.avatarUrl,
              location: msg.from?.location,
            };

            setIncomingCall({ room: msg.room, from });
            setCurrentRoom(msg.room);
            setCurrentPeer(from);

            try {
              await ringtoneRef.current?.play();
            } catch (e) {
              console.warn("[AUDIO] Ringtone blocked until user interacts", e);
            }

            eventsRef.current?.onIncomingCall?.(msg.room, from);
          }
          if (msg.type === "accepted") {
            // no-op for caller
          }
          if (msg.type === "busy") {
            setIncomingCall(null);
            setCurrentPeer(null);
            setCurrentRoom(null);
            setState("ended");
            eventsRef.current?.onBusy?.(msg.room, msg.by);
            stopRingtone();
          }
          if (msg.type === "end_call") {
            try {
              if (navigator.mediaDevices?.getUserMedia) {
                const s = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: true,
                });
                s?.getTracks()?.forEach((t) => t.stop());
              }
            } catch {}
            setState("ended");
            setIncomingCall(null);
            setCurrentPeer(null);
            setCurrentRoom(null);
            stopRingtone();
            eventsRef.current?.onCallEnd?.(msg.room, new Date());
          }
        } catch (e) {
          console.warn("[SSE] parse error", e);
        }
      };
      es.onerror = () => {
        if (!closed) {
          try {
            es?.close();
          } catch {}
          setTimeout(connect, 1000);
        }
      };
    };
    connect();
    return () => {
      closed = true;
      try {
        es?.close();
      } catch {}
    };
  }, [self?.id, apiBase, stopRingtone]);

  /** Caller flow */
  const startCall = useCallback(
    async (to: UserInfo) => {
      if (!self?.id || isStartingRef.current) return;
      isStartingRef.current = true;
      try {
        const url = `${apiBase.replace(/\/+$/, "")}/api/calls/start`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromUserId: self.id,
            toUserId: to.id,
            from: self,
            to,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "start_failed");

        setCurrentRoom(data.room || null);
        setCurrentPeer(to);

        if (data?.JoinInfo?.Meeting && data?.JoinInfo?.Attendee) {
          await join(data.JoinInfo);
        }
      } finally {
        setTimeout(() => (isStartingRef.current = false), 2000);
      }
    },
    [self, apiBase, join],
  );

  /** Callee flow */
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !self?.id) return;

    console.log("[ACCEPT] start for room", incomingCall.room);
    stopRingtone();
    setState("joining");

    try {
      const url = `${apiBase.replace(/\/+$/, "")}/api/calls/accept`;
      console.log("[ACCEPT] POST", url);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: incomingCall.room,
          userId: self.id,
          otherUserId: incomingCall.from.id,
        }),
      });
      const data = await resp.json().catch(() => ({}) as any);
      console.log("[ACCEPT] response ok?", resp.ok, data);
      if (!resp.ok) throw new Error(data?.error || "accept_failed");

      setCurrentPeer(incomingCall.from);
      setCurrentRoom(incomingCall.room);

      // Preflight mic only (non-blocking). Join always proceeds.
      const canGUM = !!navigator.mediaDevices?.getUserMedia;
      if (canGUM) {
        try {
          console.log("[ACCEPT] preflight getUserMedia (audio only)");
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (e) {
          console.warn("[ACCEPT] preflight GUM failed; proceeding", e);
        }
      }

      if (data?.JoinInfo?.Meeting && data?.JoinInfo?.Attendee) {
        console.log("[ACCEPT] joining meeting…");
        await join(data.JoinInfo);
        console.log("[ACCEPT] join done");
      } else {
        throw new Error("invalid_join_info");
      }

      setIncomingCall(null);
    } catch (e) {
      console.error("[ACCEPT] failed:", e);
      setState("idle");
    }
  }, [incomingCall, self, apiBase, join, stopRingtone]);

  const declineCall = useCallback(async () => {
    if (!incomingCall || !self?.id) return;
    const url = `${apiBase.replace(/\/+$/, "")}/api/calls/decline`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: incomingCall.room,
        userId: self.id,
        otherUserId: incomingCall.from.id,
        by: self,
      }),
    });
    setIncomingCall(null);
    setCurrentPeer(null);
    stopRingtone();
  }, [incomingCall, self, apiBase, stopRingtone]);

  const value = useMemo<MeetingContextShape>(
    () => ({
      state,
      audioVideo,
      isMicOn,
      isCamOn,
      localTileId,
      remoteTiles,
      toggleMic,
      toggleCam,
      leave,
      self,
      incomingCall,
      currentPeer,
      currentRoom,
      startCall,
      acceptCall,
      declineCall,
      join,
      elapsedSeconds: elapsed,
    }),
    [
      state,
      audioVideo,
      isMicOn,
      isCamOn,
      localTileId,
      remoteTiles,
      toggleMic,
      toggleCam,
      leave,
      self,
      incomingCall,
      currentPeer,
      currentRoom,
      startCall,
      acceptCall,
      declineCall,
      join,
      elapsed,
    ],
  );

  return (
    <MeetingContext.Provider value={value}>
      <audio
        ref={remoteAudioElRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />

      <audio
        ref={ringtoneRef}
        src={ringtoneSrc}
        playsInline
        preload="auto"
        style={{ display: "none" }}
      />

      {/* Permission prompt overlay (no audio overlay anymore) */}
      {!permissionsReady && (
        <PermissionsGate
          requireVideo={!!requireVideoPermission}
          onReady={() => setPermissionsReady(true)}
        />
      )}

      {children}
    </MeetingContext.Provider>
  );
}
