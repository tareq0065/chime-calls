import { useContext } from "react";
import { MeetingContext } from "./MeetingProvider";

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("MeetingContext not found");
  return ctx;
}
