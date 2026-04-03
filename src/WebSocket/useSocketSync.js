import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./WebSocketClient";

export const useSocketSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // USERS
    socket.on("user:updated", () => {
      queryClient.invalidateQueries(["users"]);
    });

    // REWARDS
    socket.on("reward:updated", () => {
      queryClient.invalidateQueries(["rewards"]);
    });

    // REPORTS
    socket.on("report:updated", () => {
      queryClient.invalidateQueries(["reports"]);
    });

    // NOTIFICATIONS
    socket.on("admin:notification", () => {
      queryClient.invalidateQueries(["notifications"]);
    });

    return () => {
      socket.off("user:updated");
      socket.off("reward:updated");
      socket.off("report:updated");
      socket.off("admin:notification");
    };

  }, [queryClient]);
};