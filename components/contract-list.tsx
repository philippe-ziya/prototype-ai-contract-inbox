import { useState } from "react"
import { Menu, Star, EyeOff } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { HideContractDialog } from "@/components/hide-contract-dialog"
import { cn } from "@/lib/utils"
import type { Contract } from "@/app/page"

interface ContractListProps {
  contracts: Contract[]
  selectedInboxId: string
  isColumn1Collapsed: boolean
  onExpandColumn1: () => void
  activeFilter: "all" | "unread" | "saved" | "hidden"
  onFilterChange: (filter: "all" | "unread" | "saved" | "hidden") => void
  selectedContractId: string | null
  onSelectContract: (contractId: string) => void
  onSaveContract: (contractId: string) => void
  onHideContract: (contractId: string, feedback?: string[]) => void
  onRestoreContract: (contractId: string) => void
}

export function ContractList({
  contracts,
  selectedInboxId,
  isColumn1Collapsed,
  onExpandColumn1,
  activeFilter,
  onFilterChange,
  selectedContractId,
  onSelectContract,
  onSaveContract,
  onHideContract,
  onRestoreContract,
}: ContractListProps) {
  const [contractToHide, setContractToHide] = useState<Contract | null>(null)

  const inboxName = selectedInboxId === "all-contracts" ? "All Contracts" : "Kent County Council"
  
  const filteredContracts = contracts.filter((contract) => {
    if (activeFilter === "unread") return contract.isUnread && !contract.isHidden
    if (activeFilter === "saved") return contract.isSaved && !contract.isHidden
    if (activeFilter === "hidden") return contract.isHidden
    return !contract.isHidden // "all" shows non-hidden contracts
  })

  const newCount = contracts.filter(c => c.isNew && !c.isHidden).length
  const unreadCount = contracts.filter(c => c.isUnread && !c.isHidden).length
  const savedCount = contracts.filter(c => c.isSaved && !c.isHidden).length
  const hiddenCount = contracts.filter(c => c.isHidden).length

  const handleSaveClick = (e: React.MouseEvent, contractId: string) => {
    e.stopPropagation()
    onSaveContract(contractId)
  }

  const handleHideClick = (e: React.MouseEvent, contract: Contract) => {
    e.stopPropagation()
    setContractToHide(contract)
  }

  const handleHideConfirm = (feedback?: string[]) => {
    if (contractToHide) {
      onHideContract(contractToHide.id, feedback)
      setContractToHide(null)
    }
  }

  const handleRestoreClick = (e: React.MouseEvent, contractId: string) => {
    e.stopPropagation()
    onRestoreContract(contractId)
  }

  return (
    <>
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
                  <AvatarImage src="/placeholder.svg?height=24&width=24" />
                  <AvatarFallback className="text-xs">JD</AvatarFallback>
                </Avatar>
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=24&width=24" />
                  <AvatarFallback className="text-xs">SM</AvatarFallback>
                </Avatar>
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=24&width=24" />
                  <AvatarFallback className="text-xs">+2</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="flex gap-2">
              {(["all", "unread", "saved", "hidden"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => onFilterChange(filter)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    activeFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)} ({
                    filter === "all" ? 127 : 
                    filter === "unread" ? unreadCount : 
                    filter === "saved" ? savedCount : 
                    hiddenCount
                  })
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contract List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContracts.map((contract) => (
            <button
              key={contract.id}
              onClick={() => onSelectContract(contract.id)}
              className={cn(
                "w-full p-4 text-left border-b border-border hover:bg-accent transition-all duration-200",
                selectedContractId === contract.id && "bg-accent",
                contract.isSaved && "border-l-2 border-l-amber-500"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {contract.isNew && !contract.isHidden && (
                    <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 flex-shrink-0">
                      NEW
                    </Badge>
                  )}
                  {contract.isHidden && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">
                      HIDDEN
                    </Badge>
                  )}
                  <h3 className={cn(
                    "text-sm leading-tight",
                    contract.isUnread && !contract.isHidden ? "font-semibold text-foreground" : "font-normal text-foreground/80",
                    contract.isHidden && "text-muted-foreground"
                  )}>
                    {contract.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!contract.isHidden ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleSaveClick(e, contract.id)}
                        aria-label={contract.isSaved ? "Remove from saved" : "Save for team"}
                      >
                        <Star className={cn(
                          "h-4 w-4",
                          contract.isSaved ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
                        )} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleHideClick(e, contract)}
                        aria-label="Hide for team"
                      >
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleRestoreClick(e, contract.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{contract.authority}</span>
                <span>|</span>
                <span>{contract.value}</span>
                <span>|</span>
                <span>{contract.deadline}</span>
              </div>
              {!contract.isHidden && (
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs px-2 py-0 bg-chart-2/20 text-chart-2 border-0">
                    {contract.matchScore}% match
                  </Badge>
                </div>
              )}
              {contract.isHidden && contract.hiddenBy && (
                <p className="text-xs text-muted-foreground">
                  Hidden by {contract.hiddenBy} on {new Date(contract.hiddenDate!).toLocaleDateString()}
                </p>
              )}
              {!contract.isHidden && (
                <p className="text-xs text-muted-foreground line-clamp-1">{contract.snippet}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Hide Confirmation Dialog */}
      <HideContractDialog
        isOpen={!!contractToHide}
        onClose={() => setContractToHide(null)}
        onConfirm={handleHideConfirm}
        contractTitle={contractToHide?.title || ""}
        inboxName={inboxName}
      />
    </>
  )
}
