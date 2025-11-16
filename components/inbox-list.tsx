import { ChevronLeft, Plus, Settings } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface Inbox {
  id: string
  name: string
  unreadCount: number
}

interface InboxListProps {
  inboxes: Inbox[]
  selectedInboxId: string
  onSelectInbox: (inboxId: string) => void
  onCollapse: () => void
  onNewInbox: () => void
}

export function InboxList({ inboxes, selectedInboxId, onSelectInbox, onCollapse, onNewInbox }: InboxListProps) {
  return (
    <div className="w-80 border-r border-border bg-sidebar flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-sidebar-foreground">Contract Inboxes</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCollapse}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onNewInbox}
        >
          <Plus className="h-3 w-3 mr-1.5" />
          New inbox
        </Button>
      </div>

      {/* Inbox List */}
      <div className="flex-1 overflow-y-auto">
        {inboxes.map((inbox) => (
          <button
            key={inbox.id}
            onClick={() => onSelectInbox(inbox.id)}
            className={cn(
              "w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-sidebar-accent transition-colors border-l-2",
              selectedInboxId === inbox.id
                ? "border-l-sidebar-primary bg-sidebar-accent"
                : "border-l-transparent"
            )}
          >
            <span className={cn(
              "text-sm truncate",
              selectedInboxId === inbox.id ? "font-medium text-sidebar-foreground" : "text-sidebar-foreground/80"
            )}>
              {inbox.name}
            </span>
            {inbox.unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                {inbox.unreadCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder.svg?height=32&width=32" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-sidebar-foreground truncate">John Doe</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
