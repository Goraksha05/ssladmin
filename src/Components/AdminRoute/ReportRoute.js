import AdminLayout from "../AdminLayout";
import AdminUserReport from ".";
import AdminRoute from "./AdminRoute";

<Route path="/admin" element={<AdminLayout />}>
  <Route path="users-report" element={
    <AdminRoute>
      <AdminUserReport />
    </AdminRoute>
  } />
</Route>

