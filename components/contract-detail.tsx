import { useState } from "react"
import { ArrowLeft, Star, Eye, EyeOff, MoreHorizontal, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your company has completed 12 similar building maintenance contracts</li>
              <li>• Contract value ({contract.value}) is within your typical project range</li>
              <li>• Location matches your operational area</li>
              <li>• Required certifications match your company profile</li>
            </ul>
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Authority</p>
              <p className="text-sm font-medium">{contract.authority}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Value</p>
              <p className="text-sm font-medium">{contract.value}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Deadline</p>
              <p className="text-sm font-medium">{contract.deadline} (23 Jan 2025)</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">CPV Code</p>
              <p className="text-sm font-medium">50700000-2</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Published</p>
              <p className="text-sm font-medium">2 days ago</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Contract Type</p>
              <p className="text-sm font-medium">Framework Agreement</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Overview
              </TabsTrigger>
              <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Details
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Documents
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="prose prose-sm max-w-none">
                <h3 className="text-base font-semibold mb-3">Contract Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Kent County Council is seeking qualified contractors to provide comprehensive building maintenance services across its portfolio of 50+ facilities. This framework agreement will cover planned preventive maintenance, reactive repairs, and emergency call-outs for a period of 4 years with an optional 2-year extension.
                </p>
                <h3 className="text-base font-semibold mb-3">Scope of Work</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>HVAC systems maintenance and repair</li>
                  <li>Electrical installation testing and maintenance</li>
                  <li>Plumbing and drainage services</li>
                  <li>Building fabric repairs (roofing, windows, doors)</li>
                  <li>Fire safety system maintenance</li>
                  <li>Emergency response service (24/7 availability)</li>
                </ul>
                <h3 className="text-base font-semibold mb-3 mt-4">Requirements</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>Minimum 5 years experience in public sector building maintenance</li>
                  <li>ISO 9001 and ISO 14001 certification</li>
                  <li>£5M professional indemnity insurance</li>
                  <li>£10M public liability insurance</li>
                  <li>Proven track record of similar scale contracts</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="details" className="pt-4">
              <p className="text-sm text-muted-foreground">Additional contract details and specifications would appear here.</p>
            </TabsContent>

            <TabsContent value="documents" className="pt-4">
              <p className="text-sm text-muted-foreground">Tender documents, specifications, and attachments would appear here.</p>
            </TabsContent>

            <TabsContent value="activity" className="pt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Activity log and history would appear here.</p>
                {contract.isSaved && (
                  <div className="text-sm">
                    <span className="font-medium">You</span> saved this contract
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
