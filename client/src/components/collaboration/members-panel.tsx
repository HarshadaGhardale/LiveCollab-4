import { Users, Shield, Edit2, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import type { Presence } from "@shared/schema";

interface MembersPanelProps {
  members: Presence[];
  currentUserId: string;
  roomOwnerId?: string;
  onClose?: () => void;
}

export function MembersPanel({ members, currentUserId, roomOwnerId, onClose }: MembersPanelProps) {
  const getRoleColor = (role: string) => {
    if (role === "owner") return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    if (role === "editor") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const getRoleIcon = (userId: string) => {
    if (userId === roomOwnerId) return <Shield className="h-3 w-3" />;
    return <Edit2 className="h-3 w-3" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-64 bg-card border-l border-border flex flex-col overflow-hidden"
      data-testid="panel-members"
    >
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Members</h2>
          <Badge variant="secondary" className="ml-auto text-xs">
            {members.length}
          </Badge>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {members.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center p-4">
              No members in this room yet
            </div>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <motion.div
                  key={member.oderId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                  data-testid={`member-item-${member.oderId}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      style={{ backgroundColor: member.avatarColor }}
                      className="text-white text-xs font-medium"
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {member.username}
                      </span>
                      {member.oderId === currentUserId && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className={`text-xs cursor-help ${getRoleColor(
                              member.oderId === roomOwnerId ? "owner" : "editor"
                            )}`}
                          >
                            {member.oderId === roomOwnerId ? "Owner" : "Editor"}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {member.oderId === roomOwnerId ? "Room owner" : "Can edit"}
                        </TooltipContent>
                      </Tooltip>
                      {member.activePanel && (
                        <span className="text-xs text-muted-foreground">
                          on {member.activePanel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Online indicator */}
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="h-10 px-4 flex items-center justify-center border-t bg-muted/30 text-xs text-muted-foreground">
        All members are online
      </div>
    </motion.div>
  );
}
