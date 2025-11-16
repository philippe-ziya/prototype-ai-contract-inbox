"use client"

import { Menu } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ContractListSkeletonProps {
  isColumn1Collapsed: boolean
  onExpandColumn1: () => void
  inboxName: string
}

export function ContractListSkeleton({ isColumn1Collapsed, onExpandColumn1, inboxName }: ContractListSkeletonProps) {
  return (
    <div className="flex-1 border-r border-border bg-background flex flex-col min-w-0">
      {/* Header */}
      <div className="border-b border-border">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            {isColumn1Collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={onExpandColumn1}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-semibold text-foreground truncate flex-1">{inboxName}</h1>
            <div className="flex items-center -space-x-2 flex-shrink-0">
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-xs">JD</AvatarFallback>
              </Avatar>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-xs">SM</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </div>

      {/* Loading Message */}
      <div className="p-4 text-center border-b border-border bg-muted/30">
        <p className="text-sm text-muted-foreground font-medium">
          Finding relevant contracts...
        </p>
      </div>

      {/* Skeleton Cards */}
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="p-4 border-b border-border">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 flex-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
