import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useNotificationsQuery = () => {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await axios.get("/api/notifications");
      return res.data;
    },
    staleTime: 1000 * 30, // 30 sec (recommended)
  });
};