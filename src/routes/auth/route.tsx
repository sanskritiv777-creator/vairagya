import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for the /auth subtree. Without this <Outlet />, /auth/callback
 * could never mount — which is what made Google's redirect dead-end.
 */
export const Route = createFileRoute("/auth")({
  ssr: false,
  component: () => <Outlet />,
});
