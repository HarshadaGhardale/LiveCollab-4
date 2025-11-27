import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Users, 
  LogOut, 
  Loader2, 
  Clock, 
  ArrowRight,
  Hash,
  Lock
} from "lucide-react";
import { insertRoomSchema, type InsertRoom, type RoomWithMemberCount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/stores";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function RoomCard({ room }: { room: RoomWithMemberCount }) {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className="group hover-elevate cursor-pointer" data-testid={`card-room-${room.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-medium truncate flex items-center gap-2">
                {room.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                {room.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <Hash className="h-3 w-3" />
                <span className="truncate">{room.slug}</span>
              </CardDescription>
            </div>
            {room.isOwner && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full shrink-0">
                Owner
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatRelativeTime(room.lastActiveAt)}
            </span>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button 
            className="w-full"
            variant="outline"
            onClick={() => setLocation(`/room/${room.slug}`)}
            data-testid={`button-join-room-${room.id}`}
          >
            Enter room
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function RoomCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
}

function CreateRoomDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<InsertRoom>({
    resolver: zodResolver(insertRoomSchema),
    defaultValues: {
      name: "",
      slug: "",
      isPrivate: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: InsertRoom) => {
      const response = await apiRequest("POST", "/api/rooms", values);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room created!",
        description: "Your collaboration room is ready.",
      });
      setOpen(false);
      form.reset();
      setLocation(`/room/${data.slug}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create room",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-room">
          <Plus className="h-4 w-4 mr-2" />
          Create Room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new room</DialogTitle>
          <DialogDescription>
            Set up a collaboration space for your team
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Project Brainstorm"
                      data-testid="input-room-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room URL (optional)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/room/</span>
                      <Input
                        placeholder="project-brainstorm"
                        data-testid="input-room-slug"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      Private room
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Only invited members can join
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-room-private"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-create-room"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-create-room"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create room"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function JoinRoomDialog() {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleJoin = () => {
    if (!slug.trim()) {
      toast({
        title: "Enter a room code",
        description: "Please enter a valid room code to join",
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    setLocation(`/room/${slug.trim()}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-join-room">
          <Hash className="h-4 w-4 mr-2" />
          Join Room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a room</DialogTitle>
          <DialogDescription>
            Enter the room code to join an existing collaboration space
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label htmlFor="room-code" className="text-sm font-medium">
              Room code
            </label>
            <Input
              id="room-code"
              placeholder="project-brainstorm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              data-testid="input-join-room-slug"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-join-room"
            >
              Cancel
            </Button>
            <Button onClick={handleJoin} data-testid="button-submit-join-room">
              Join room
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const [, setLocation] = useLocation();

  const { data: rooms, isLoading } = useQuery<RoomWithMemberCount[]>({
    queryKey: ["/api/rooms"],
  });

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between border-b sticky top-0 bg-background z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">CollabSpace</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 pl-3 border-l">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                style={{ backgroundColor: user?.avatarColor || "#3B82F6" }}
                className="text-white text-sm font-medium"
              >
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">
              {user?.username}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold">
                Welcome back, {user?.username}
              </h1>
              <p className="text-muted-foreground mt-1">
                Select a room to continue collaborating
              </p>
            </div>
            <div className="flex gap-3">
              <JoinRoomDialog />
              <CreateRoomDialog />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <>
                  <RoomCardSkeleton />
                  <RoomCardSkeleton />
                  <RoomCardSkeleton />
                </>
              ) : rooms && rooms.length > 0 ? (
                rooms.map((room) => <RoomCard key={room.id} room={room} />)
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full"
                >
                  <Card className="p-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No rooms yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      Create your first collaboration room or join an existing one
                    </p>
                    <div className="flex justify-center gap-3">
                      <JoinRoomDialog />
                      <CreateRoomDialog />
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
