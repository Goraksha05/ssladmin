import { useQuery } from "@tanstack/react-query";
import apiRequest from "../utils/apiRequest";

export const useNotificationsQuery = () => {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiRequest.get("/api/notifications");
      return res.data;
    },
    staleTime: 1000 * 30,
  });
};