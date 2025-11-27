import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Presence } from "@shared/schema";

interface PresenceOverlayProps {
  presence: Map<string, Presence>;
  currentUserId: string;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function PresenceOverlay({ presence, currentUserId, containerRef }: PresenceOverlayProps) {
  const otherUsers = Array.from(presence.values()).filter((p) => p.oderId !== currentUserId);

  return (
    <>
      {/* Live cursors */}
      <AnimatePresence>
        {otherUsers.map((user) => {
          if (user.cursorX === undefined || user.cursorY === undefined) return null;

          return (
            <motion.div
              key={user.oderId}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute pointer-events-none z-50"
              style={{
                left: user.cursorX,
                top: user.cursorY,
                transform: "translate(-2px, -2px)",
              }}
            >
              {/* Cursor SVG */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-md"
              >
                <path
                  d="M5.65376 12.4563L0.979492 0.979462L12.4561 5.65371L7.7828 7.7828L5.65376 12.4563Z"
                  fill={user.avatarColor}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              {/* Username label */}
              <span
                className="absolute left-4 top-4 px-2 py-0.5 text-xs font-medium text-white rounded-full whitespace-nowrap"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.username}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </>
  );
}

interface ActiveUsersListProps {
  presence: Map<string, Presence>;
  currentUserId: string;
}

export function ActiveUsersList({ presence, currentUserId }: ActiveUsersListProps) {
  const users = Array.from(presence.values());
  const displayUsers = users.slice(0, 4);
  const remainingCount = users.length - displayUsers.length;

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1" data-testid="container-active-users">
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <Tooltip key={user.oderId}>
            <TooltipTrigger asChild>
              <Avatar 
                className="h-7 w-7 border-2 border-background"
                data-testid={`avatar-user-${user.oderId}`}
              >
                <AvatarFallback
                  style={{ backgroundColor: user.avatarColor }}
                  className="text-white text-xs font-medium"
                >
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              {user.username}
              {user.oderId === currentUserId && " (You)"}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {remainingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
              +{remainingCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {remainingCount} more {remainingCount === 1 ? "user" : "users"}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="ml-2 text-xs text-muted-foreground">
        {users.length} {users.length === 1 ? "user" : "users"} online
      </span>
    </div>
  );
}
