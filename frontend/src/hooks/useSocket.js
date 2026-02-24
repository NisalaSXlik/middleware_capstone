import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:8003";

export function useSocket(userId, role, onEvent) {
  const socketRef  = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    socketRef.current = io(WS_URL, {
      query: { userId, role },
      transports: ["websocket"],
    });

    socketRef.current.on("connect",    () => setConnected(true));
    socketRef.current.on("disconnect", () => setConnected(false));
    socketRef.current.on("order:update", onEvent);

    return () => {
      socketRef.current?.disconnect();
      setConnected(false);
    };
  }, [userId]);

  return { socketRef, connected };
}
