import { useNotifications } from "../../Context/NotificationContext";
import { useNavigate } from "react-router-dom";

const NotificationDropdown = () => {
  const { notifications, setUnread } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n) => {
    setUnread(0);
    if (n.url) navigate(n.url);
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 shadow-xl rounded-lg z-50">
      <div className="p-3 border-b font-semibold">Notifications</div>

      <div className="max-h-80 overflow-auto">
        {notifications.length === 0 && (
          <div className="p-4 text-center text-sm">No notifications</div>
        )}

        {notifications.map((n, i) => (
          <div
            key={i}
            onClick={() => handleClick(n)}
            className="p-3 border-b hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className="text-sm">{n.message}</div>
            <div className="text-xs opacity-60">
              {new Date(n.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationDropdown;