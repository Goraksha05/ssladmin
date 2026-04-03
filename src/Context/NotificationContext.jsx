import { createContext, useContext, useState, useEffect } from "react";
import { useNotificationsQuery } from "../hooks/useNotificationsQuery";
import { subscribe } from "../WebSocket/WebSocketClient";

const Ctx = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const { 
    data, 
    // isLoading, 
    // error 
  } = useNotificationsQuery();

  useEffect(() => {
    const unsubscribe = subscribe("admin:notification", (payload) => {
      setNotifications(prev => [payload, ...prev]);
      setUnread(prev => prev + 1);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (data?.data) {
      setNotifications(prev => {
        const ids = new Set(prev.map(n => n._id));
        return [
          ...prev,
          ...data.data.filter(n => !ids.has(n._id))
        ];
      });
      setUnread(data.unreadCount);
    }
  }, [data]);

  return (
    <Ctx.Provider
      value={{
        notifications: notifications || [],
        unread: unread || 0,
        setUnread,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useNotifications = () => useContext(Ctx);