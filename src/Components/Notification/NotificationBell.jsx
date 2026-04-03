import { useNotifications } from "../../Context/NotificationContext";

const NotificationBell = ({ onClick }) => {
  const { unread } = useNotifications();

  return (
    <div className="relative cursor-pointer" onClick={onClick}>
      🔔
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 rounded-full">
          {unread}
        </span>
      )}
    </div>
  );
};

export default NotificationBell;