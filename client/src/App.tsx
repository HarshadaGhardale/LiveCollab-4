import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuthStore } from "@/lib/stores";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { lazy, Suspense } from "react";
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Profile = lazy(() => import("@/pages/profile"));
const Room = lazy(() => import("@/pages/room"));
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSocket, connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/auth/reset-password/:token" component={ResetPassword} />
      <Route path="/dashboard">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <ProtectedRoute component={Dashboard} />
        </Suspense>
      </Route>
      <Route path="/profile">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <ProtectedRoute component={Profile} />
        </Suspense>
      </Route>
      <Route path="/room/:slug">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <ProtectedRoute component={Room} />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function SocketListener() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    // Ensure socket is connected
    connectSocket();
    const socket = getSocket();

    const handleInvite = (data: { roomId: string; roomName: string; slug: string; inviterName: string }) => {
      toast({
        title: "Room Invitation",
        description: `${data.inviterName} invited you to join "${data.roomName}"`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/room/${data.slug}`)}
          >
            Join
          </Button>
        ),
      });
    };

    socket.on("room:invite", handleInvite);

    return () => {
      socket.off("room:invite", handleInvite);
    };
  }, [user, toast, setLocation]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <SocketListener />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
