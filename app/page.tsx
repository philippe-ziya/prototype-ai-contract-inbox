"use client"

import { useState } from "react"
import { AppNavSidebar } from "@/components/app-nav-sidebar"
import { InboxList } from "@/components/inbox-list"
import { ContractList } from "@/components/contract-list"
import { ContractDetail } from "@/components/contract-detail"
import { InboxConfiguration } from "@/components/inbox-configuration"
import { InboxLoadingDialog } from "@/components/inbox-loading-dialog"
import { ContractListSkeleton } from "@/components/contract-list-skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"

interface Inbox {
  id: string
  name: string
  unreadCount: number
}

export interface Contract {
  id: string
  title: string
  authority: string
  value: string
  deadline: string
  matchScore: number
  snippet: string
  isNew: boolean
  isSaved: boolean
  isUnread: boolean
  isHidden: boolean
  hiddenBy?: string
  hiddenDate?: string
}

const initialInboxes: Inbox[] = [
  { id: "all-contracts", name: "All Contracts", unreadCount: 127 },
  { id: "kent-council", name: "Kent County Council", unreadCount: 12 },
  { id: "nhs-surrey", name: "NHS Surrey Heartlands", unreadCount: 8 },
  { id: "tfl", name: "Transport for London", unreadCount: 5 },
  { id: "building-maintenance", name: "Building Maintenance", unreadCount: 23 },
  { id: "it-services", name: "IT Services", unreadCount: 15 },
  { id: "professional-services", name: "Professional Services", unreadCount: 9 },
]

export default function ContractInboxPage() {
  const [isColumn1Collapsed, setIsColumn1Collapsed] = useState(false)
  const [selectedInboxId, setSelectedInboxId] = useState("all-contracts")
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "saved" | "hidden">("all")
  const [showInboxConfig, setShowInboxConfig] = useState(false)
  const [inboxes, setInboxes] = useState<Inbox[]>(initialInboxes)
  const [isCreatingInbox, setIsCreatingInbox] = useState(false)
  const [newInboxName, setNewInboxName] = useState("")
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const [contracts, setContracts] = useState<Contract[]>([
    {
      id: "1",
      title: "Building Maintenance Services Framework Agreement",
      authority: "Kent County Council",
      value: "£2.5M",
      deadline: "7 days",
      matchScore: 94,
      snippet: "Seeking contractors for comprehensive building maintenance across 50+ facilities including HVAC, electrical...",
      isNew: true,
      isSaved: false,
      isUnread: true,
      isHidden: false,
    },
    {
      id: "2",
      title: "Digital Health Records System Implementation",
      authority: "NHS Surrey Heartlands",
      value: "£850K",
      deadline: "14 days",
      matchScore: 89,
      snippet: "Major electronic health records system upgrade to support 12 GP practices and 3 community health centers...",
      isNew: true,
      isSaved: true,
      isUnread: true,
      isHidden: false,
    },
    {
      id: "3",
      title: "Professional Services for Transport Infrastructure Study",
      authority: "Transport for London",
      value: "£425K",
      deadline: "21 days",
      matchScore: 86,
      snippet: "Comprehensive feasibility study for new bus rapid transit corridor connecting major residential areas...",
      isNew: false,
      isSaved: false,
      isUnread: true,
      isHidden: false,
    },
    {
      id: "4",
      title: "IT Support and Helpdesk Services",
      authority: "Kent County Council",
      value: "£180K",
      deadline: "28 days",
      matchScore: 92,
      snippet: "24/7 IT support services for 500+ end users across multiple county council departments and facilities...",
      isNew: true,
      isSaved: false,
      isUnread: true,
      isHidden: false,
    },
    {
      id: "5",
      title: "Facilities Management Contract",
      authority: "NHS Surrey Heartlands",
      value: "£1.2M",
      deadline: "35 days",
      matchScore: 78,
      snippet: "Comprehensive facilities management for 5 hospital sites including cleaning, security, catering and grounds...",
      isNew: false,
      isSaved: true,
      isUnread: false,
      isHidden: false,
    },
  ])

  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId)
  }

  const handleCloseDetail = () => {
    setSelectedContractId(null)
  }

  const handleCreateInbox = (name: string, prompt: string, invites: string[]) => {
    setNewInboxName(name)
    setShowInboxConfig(false)
    setIsCreatingInbox(true)
  }

  const handleLoadingComplete = () => {
    const newInbox: Inbox = {
      id: newInboxName.toLowerCase().replace(/\s+/g, "-"),
      name: newInboxName,
      unreadCount: 47
    }
    setInboxes([...inboxes, newInbox])
    setSelectedInboxId(newInbox.id)
    setIsCreatingInbox(false)
    setIsLoadingContracts(true)
    
    setTimeout(() => {
      setIsLoadingContracts(false)
    }, 1500)
  }

  const handleSaveContract = (contractId: string) => {
    setContracts((prev) =>
      prev.map((contract) =>
        contract.id === contractId
          ? { ...contract, isSaved: !contract.isSaved }
          : contract
      )
    )

    const contract = contracts.find((c) => c.id === contractId)
    if (contract) {
      toast({
        title: contract.isSaved ? "Removed from saved" : "Contract saved",
        description: contract.isSaved ? undefined : "Saved for your team",
        action: {
          label: "Undo",
          onClick: () => handleSaveContract(contractId),
        },
      })
    }
  }

  const handleHideContract = (contractId: string, feedback?: string[]) => {
    const contract = contracts.find((c) => c.id === contractId)
    
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId
          ? {
              ...c,
              isHidden: true,
              hiddenBy: "You",
              hiddenDate: new Date().toISOString(),
            }
          : c
      )
    )

    // Close detail view if this contract was selected
    if (selectedContractId === contractId) {
      setSelectedContractId(null)
    }

    toast({
      title: "Contract hidden",
      description: contract ? `Hidden "${contract.title}"` : "Contract hidden from inbox",
      action: {
        label: "Undo",
        onClick: () => handleRestoreContract(contractId),
      },
      duration: 6000,
    })
  }

  const handleRestoreContract = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId
          ? { ...c, isHidden: false, hiddenBy: undefined, hiddenDate: undefined }
          : c
      )
    )

    toast({
      title: "Contract restored",
      description: "Contract restored to inbox",
    })
  }

  const showDetailAsModal = isMobile || (typeof window !== 'undefined' && window.innerWidth < 1512)

  if (showInboxConfig) {
    return (
      <InboxConfiguration
        onClose={() => setShowInboxConfig(false)}
        onCreateInbox={handleCreateInbox}
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppNavSidebar />

      {!isColumn1Collapsed && (
        <InboxList
          inboxes={inboxes}
          selectedInboxId={selectedInboxId}
          onSelectInbox={setSelectedInboxId}
          onCollapse={() => setIsColumn1Collapsed(true)}
          onNewInbox={() => setShowInboxConfig(true)}
        />
      )}

      {isLoadingContracts ? (
        <ContractListSkeleton
          isColumn1Collapsed={isColumn1Collapsed}
          onExpandColumn1={() => setIsColumn1Collapsed(false)}
          inboxName={newInboxName}
        />
      ) : (
        <ContractList
          contracts={contracts}
          selectedInboxId={selectedInboxId}
          isColumn1Collapsed={isColumn1Collapsed}
          onExpandColumn1={() => setIsColumn1Collapsed(false)}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
          onSaveContract={handleSaveContract}
          onHideContract={handleHideContract}
          onRestoreContract={handleRestoreContract}
        />
      )}

      {showDetailAsModal ? (
        <Dialog open={!!selectedContractId} onOpenChange={(open) => !open && handleCloseDetail()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
            <ContractDetail
              contract={contracts.find((c) => c.id === selectedContractId) || null}
              onClose={handleCloseDetail}
              isModal={true}
              onSaveContract={handleSaveContract}
              onHideContract={handleHideContract}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <ContractDetail
          contract={contracts.find((c) => c.id === selectedContractId) || null}
          onClose={handleCloseDetail}
          isModal={false}
          onSaveContract={handleSaveContract}
          onHideContract={handleHideContract}
        />
      )}

      <InboxLoadingDialog
        isOpen={isCreatingInbox}
        inboxName={newInboxName}
        contractCount={47}
        onComplete={handleLoadingComplete}
      />
    </div>
  )
}
