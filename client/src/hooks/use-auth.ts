import { useGetUserQuery, useLogoutMutation, api } from "@/lib/api";
import { useAppDispatch } from "@/lib/store";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { data: user, isLoading, error } = useGetUserQuery();
  const [logoutFn, { isLoading: isLoggingOut }] = useLogoutMutation();

  const logout = () => {
    logoutFn().then(() => {
      dispatch(api.util.resetApiState());
    });
  };

  const resolvedUser = error ? null : (user ?? null);

  return {
    user: resolvedUser,
    isLoading,
    isAuthenticated: !!resolvedUser,
    isAdmin: resolvedUser?.role === "admin",
    isPartner: resolvedUser?.role === "partner",
    logout,
    isLoggingOut,
  };
}
