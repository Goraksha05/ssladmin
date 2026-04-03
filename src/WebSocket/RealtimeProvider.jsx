import React, { createContext, useContext, useEffect } from "react";
import { initializeSocket, disconnectSocket } from "./WebSocketClient";

const RealtimeContext = createContext();

export const RealtimeProvider = ({ children }) => {

  useEffect(() => {
    initializeSocket();

    return () => disconnectSocket();
  }, []);

  return (
    <RealtimeContext.Provider value={{}}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtimeContext = () => useContext(RealtimeContext);