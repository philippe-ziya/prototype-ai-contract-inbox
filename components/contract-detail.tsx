import { useState } from "react"
import { ArrowLeft, Star, Eye, EyeOff, MoreHorizontal, X, ExternalLink } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HideContractDialog } from "@/components/hide-contract-dialog"
import type { Contract } from "@/app/page"
import { cn } from "@/lib/utils"

interface ContractDetailProps {
  contract: Contract | null
  onClose: () => void
  isModal: boolean
  onSaveContract: (contractId: string) => void
  onHideContract: (contractId: string, feedback?: string[]) => void
}

export function ContractDetail({ 
  contract, 
  onClose, 
  isModal,
  onSaveContract,
  onHideContract,
}: ContractDetailProps) {
  const [showHideDialog, setShowHideDialog] = useState(false)

  if (!contract) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Eye className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Select a contract to view details</h2>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>127 unread contracts worth £8.2M total</p>
            <p>15 unique contracting authorities</p>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveClick = () => {
    onSaveContract(contract.id)
  }

  const handleHideConfirm = (feedback?: string[]) => {
    onHideContract(contract.id, feedback)
    setShowHideDialog(false)
  }

  return (
    <>
      <div className="flex-1 bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-4 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isModal && (
              <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
                <X className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-lg font-semibold truncate">{contract.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button 
              size="sm"
              variant={contract.isSaved ? "default" : "outline"}
              onClick={handleSaveClick}
              className={cn(
                contract.isSaved && "bg-amber-500 hover:bg-amber-600 text-white"
              )}
            >
              <Star className={cn(
                "h-4 w-4 mr-1.5",
                contract.isSaved && "fill-white"
              )} />
              {contract.isSaved ? "Saved" : "Save"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowHideDialog(true)}
            >
              <EyeOff className="h-4 w-4 mr-1.5" />
              Hide
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Match Score Card */}
          {contract.matchScore !== undefined && (
            <div className="bg-chart-2/10 border border-chart-2/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-chart-2 text-white text-sm px-3 py-1">
                  {contract.matchScore}% match
                </Badge>
                <div className="flex-1 ml-4 bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-chart-2 h-full" style={{ width: `${contract.matchScore}%` }} />
                </div>
              </div>
              <h3 className="text-sm font-semibold mb-2">Why this matches</h3>
              {contract.explanation ? (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {contract.explanation}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Match explanation loading...
                </p>
              )}
            </div>
          )}

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Authority</p>
              <p className="text-sm font-medium">{contract.authority}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Buyer Classification</p>
              <p className="text-sm font-medium">{contract.buyerClassification}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Value</p>
              <p className="text-sm font-medium">
                {contract.value
                  ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(contract.value)
                  : 'Not specified'
                }
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Deadline</p>
              <p className="text-sm font-medium">{contract.deadline || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Close Date</p>
              <p className="text-sm font-medium">
                {new Date(contract.closeDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Published Date</p>
              <p className="text-sm font-medium">
                {new Date(contract.publishDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Contract URL */}
          <div className="mb-6">
            <a
              href={contract.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              View on Contracts Finder
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-base font-semibold mb-3">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {contract.description}
            </p>
          </div>
        </div>
      </div>

      {/* Hide Confirmation Dialog */}
      <HideContractDialog
        isOpen={showHideDialog}
        onClose={() => setShowHideDialog(false)}
        onConfirm={handleHideConfirm}
        contractTitle={contract.title}
        inboxName="Kent County Council"
      />
    </>
  )
}
