"use client"

import { useState, useEffect } from "react"
import { AppNavSidebar } from "@/components/app-nav-sidebar"
import { InboxList } from "@/components/inbox-list"
import { ContractList } from "@/components/contract-list"
import { ContractDetail } from "@/components/contract-detail"
import { InboxConfiguration } from "@/components/inbox-configuration"
import { InboxLoadingDialog } from "@/components/inbox-loading-dialog"
import { InitialLoadingDialog } from "@/components/initial-loading-dialog"
import { ContractListSkeleton } from "@/components/contract-list-skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"
import { useContractStorage } from "@/hooks/useContractStorage"
import { useInboxStorage } from "@/hooks/useInboxStorage"
import { useSemanticSearch } from "@/hooks/useSemanticSearch"
import type { Contract, Inbox } from "@/types"

export default function ContractInboxPage() {
  // UI State
  const [isColumn1Collapsed, setIsColumn1Collapsed] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "saved" | "hidden">("all")
  const [showInboxConfig, setShowInboxConfig] = useState(false)
  const [isCreatingInbox, setIsCreatingInbox] = useState(false)
  const [newInboxName, setNewInboxName] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [globalThreshold, setGlobalThreshold] = useState(30)
  const [debugMode, setDebugMode] = useState({
    showRawScores: false,
    showExplanations: false,
    showFilterReasons: false,
  })
  const [learningEnabled, setLearningEnabled] = useState(true)
  const isMobile = useIsMobile()
  const { toast } = useToast()

  // Data hooks
  const {
    contracts: allContracts,
    loading: contractsLoading,
    processingState,
    embeddingProgress,
    saveContract: saveToStorage,
    hideContract: hideInStorage,
    markAsRead,
    unhideContract,
  } = useContractStorage()

  const {
    inboxes,
    activeInbox,
    activeInboxId,
    setActiveInboxId,
    addInbox,
    removeInbox,
    refreshInboxes,
  } = useInboxStorage()

  // Semantic search for active inbox
  const {
    contracts: searchResults,
    searching,
    search,
  } = useSemanticSearch(activeInbox?.prompt || null, activeInbox, !!activeInbox)

  // Sync globalThreshold with active inbox's threshold when switching inboxes
  useEffect(() => {
    if (activeInbox?.learningMetrics?.dynamicMinScore !== undefined) {
      setGlobalThreshold(activeInbox.learningMetrics.dynamicMinScore)
    } else if (activeInbox && !activeInbox.isAllContractsInbox) {
      // If inbox exists but has no threshold set, use default
      setGlobalThreshold(30)
    }
  }, [activeInbox])

  // Determine which contracts to display
  // - If "All Contracts" special inbox: show all 623 contracts with 100% match (bypass search)
  // - If regular inbox with search results: show semantic search results with actual match scores
  // - Otherwise: show empty array (if search returns no results, inbox should be empty)
  const baseContracts = activeInbox?.isAllContractsInbox
    ? allContracts.map(c => ({ ...c, matchScore: 100 }))
    : activeInbox && searchResults.length > 0
    ? searchResults
    : []

  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId)

    // Mark as read with inbox context for learning
    const contract = baseContracts.find(c => c.id === contractId)
    const context = activeInbox && contract?.matchScore !== undefined
      ? { inboxId: activeInbox.id, matchScore: contract.matchScore }
      : undefined

    markAsRead(contractId, context)
  }

  const handleCloseDetail = () => {
    setSelectedContractId(null)
  }

  const handleCreateInbox = async (name: string, prompt: string, invites: string[]) => {
    setNewInboxName(name)
    setShowInboxConfig(false)
    setIsCreatingInbox(true)

    try {
      const newInbox = await addInbox(name, prompt)
      setIsCreatingInbox(false)

      toast({
        title: "Inbox created",
        description: `"${name}" is now tracking relevant contracts`,
      })
    } catch (error) {
      console.error("Error creating inbox:", error)
      setIsCreatingInbox(false)

      toast({
        title: "Error",
        description: "Failed to create inbox",
        variant: "destructive",
      })
    }
  }

  const handleSaveContract = async (contractId: string) => {
    const contract = baseContracts.find((c) => c.id === contractId)
    const wasSaved = contract?.isSaved

    try {
      // Pass inbox context for learning (only when saving, not unsaving)
      const context = !wasSaved && activeInbox && contract?.matchScore !== undefined
        ? { inboxId: activeInbox.id, matchScore: contract.matchScore }
        : undefined

      await saveToStorage(contractId, context)

      toast({
        title: wasSaved ? "Removed from saved" : "Contract saved",
        description: wasSaved ? undefined : "Saved for your team",
        action: {
          label: "Undo",
          onClick: () => handleSaveContract(contractId),
        },
      })
    } catch (error) {
      console.error("Error saving contract:", error)
      toast({
        title: "Error",
        description: "Failed to save contract",
        variant: "destructive",
      })
    }
  }

  const handleHideContract = async (contractId: string, feedback?: string[]) => {
    const contract = baseContracts.find((c) => c.id === contractId)
    const reason = feedback?.join(", ")

    try {
      // Pass inbox context for learning
      const context = activeInbox && contract?.matchScore !== undefined
        ? { inboxId: activeInbox.id, matchScore: contract.matchScore }
        : undefined

      await hideInStorage(contractId, reason, context)

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
    } catch (error) {
      console.error("Error hiding contract:", error)
      toast({
        title: "Error",
        description: "Failed to hide contract",
        variant: "destructive",
      })
    }
  }

  const handleRestoreContract = async (contractId: string) => {
    try {
      if (!activeInbox) {
        console.warn('[ContractInboxPage] Cannot restore contract without active inbox')
        return
      }

      await unhideContract(contractId, activeInbox.id)

      toast({
        title: "Contract restored",
        description: "Contract restored to inbox",
      })
    } catch (error) {
      console.error("Error restoring contract:", error)
      toast({
        title: "Error",
        description: "Failed to restore contract",
        variant: "destructive",
      })
    }
  }

  const handleRerunInbox = () => {
    if (!activeInbox?.prompt) {
      toast({
        title: "Error",
        description: "Cannot re-run inbox without a search prompt",
        variant: "destructive",
      })
      return
    }

    // Trigger a new search with the current inbox prompt
    search(activeInbox.prompt)

    toast({
      title: "Re-running inbox",
      description: `Searching for contracts matching "${activeInbox.name}"`,
    })
  }

  const handleDeleteInbox = () => {
    if (!activeInbox) return
    if (activeInbox.isAllContractsInbox) {
      toast({
        title: "Cannot delete",
        description: "The default inbox cannot be deleted",
        variant: "destructive",
      })
      return
    }

    // Show confirmation dialog
    setShowDeleteConfirm(true)
  }

  const confirmDeleteInbox = async () => {
    if (!activeInbox) return

    try {
      await removeInbox(activeInbox.id)

      toast({
        title: "Inbox deleted",
        description: `"${activeInbox.name}" has been deleted`,
      })

      setShowDeleteConfirm(false)

      // Switch to "All Contracts" inbox (first in list)
      const allContractsInbox = inboxes.find(i => i.isAllContractsInbox)
      if (allContractsInbox) {
        setActiveInboxId(allContractsInbox.id)
      }
    } catch (error) {
      console.error("Error deleting inbox:", error)
      toast({
        title: "Error",
        description: "Failed to delete inbox",
        variant: "destructive",
      })
    }
  }

  const handleWidenSearch = async () => {
    if (!activeInbox || !activeInbox.prompt) {
      toast({
        title: "Error",
        description: "Cannot widen search without an active inbox",
        variant: "destructive",
      })
      return
    }

    try {
      // Get current threshold from learning metrics or default to 50
      const currentThreshold = activeInbox.learningMetrics?.dynamicMinScore ?? 50

      // Lower threshold by 10, minimum 30
      const newThreshold = Math.max(30, currentThreshold - 10)

      if (newThreshold === currentThreshold) {
        toast({
          title: "Already at minimum",
          description: "Search is already at the minimum threshold (30%)",
        })
        return
      }

      // Update inbox learning metrics
      const { updateInbox } = await import('@/lib/inbox-storage')
      await updateInbox(activeInbox.id, {
        learningMetrics: {
          ...activeInbox.learningMetrics,
          inboxId: activeInbox.id,
          minRelevanceScore: activeInbox.learningMetrics?.minRelevanceScore ?? 0,
          maxIrrelevanceScore: activeInbox.learningMetrics?.maxIrrelevanceScore ?? 100,
          dynamicMinScore: newThreshold,
          thresholdAdjustments: {
            expandedCount: (activeInbox.learningMetrics?.thresholdAdjustments?.expandedCount ?? 0) + 1,
            narrowedCount: activeInbox.learningMetrics?.thresholdAdjustments?.narrowedCount ?? 0,
            lastAdjustment: new Date().toISOString(),
          },
          promptRefinements: activeInbox.learningMetrics?.promptRefinements ?? [],
          pendingPromptUpdate: activeInbox.learningMetrics?.pendingPromptUpdate ?? false,
          totalFeedback: activeInbox.learningMetrics?.totalFeedback ?? 0,
          savedContracts: activeInbox.learningMetrics?.savedContracts ?? 0,
          hiddenContracts: activeInbox.learningMetrics?.hiddenContracts ?? 0,
          viewedContracts: activeInbox.learningMetrics?.viewedContracts ?? 0,
          authorityBoosts: activeInbox.learningMetrics?.authorityBoosts ?? {},
          classificationBoosts: activeInbox.learningMetrics?.classificationBoosts ?? {},
          confidenceLevel: activeInbox.learningMetrics?.confidenceLevel ?? 0,
          lastUpdated: new Date().toISOString(),
        },
      })

      // Re-trigger search with new threshold
      search(activeInbox.prompt)

      toast({
        title: "Search widened",
        description: `Lowered match threshold to ${newThreshold}%`,
      })
    } catch (error) {
      console.error("Error widening search:", error)
      toast({
        title: "Error",
        description: "Failed to widen search",
        variant: "destructive",
      })
    }
  }

  const handleGlobalThresholdChange = async (newThreshold: number) => {
    if (!activeInbox) return

    setGlobalThreshold(newThreshold)

    // Update the inbox learning metrics with new threshold
    if (!activeInbox.isAllContractsInbox && activeInbox.prompt) {
      try {
        const { updateInbox } = await import('@/lib/inbox-storage')
        await updateInbox(activeInbox.id, {
          learningMetrics: {
            ...activeInbox.learningMetrics,
            inboxId: activeInbox.id,
            minRelevanceScore: activeInbox.learningMetrics?.minRelevanceScore ?? 0,
            maxIrrelevanceScore: activeInbox.learningMetrics?.maxIrrelevanceScore ?? 100,
            dynamicMinScore: newThreshold,
            thresholdAdjustments: {
              expandedCount: activeInbox.learningMetrics?.thresholdAdjustments?.expandedCount ?? 0,
              narrowedCount: activeInbox.learningMetrics?.thresholdAdjustments?.narrowedCount ?? 0,
              lastAdjustment: new Date().toISOString(),
            },
            promptRefinements: activeInbox.learningMetrics?.promptRefinements ?? [],
            pendingPromptUpdate: activeInbox.learningMetrics?.pendingPromptUpdate ?? false,
            totalFeedback: activeInbox.learningMetrics?.totalFeedback ?? 0,
            savedContracts: activeInbox.learningMetrics?.savedContracts ?? 0,
            hiddenContracts: activeInbox.learningMetrics?.hiddenContracts ?? 0,
            viewedContracts: activeInbox.learningMetrics?.viewedContracts ?? 0,
            authorityBoosts: activeInbox.learningMetrics?.authorityBoosts ?? {},
            classificationBoosts: activeInbox.learningMetrics?.classificationBoosts ?? {},
            confidenceLevel: activeInbox.learningMetrics?.confidenceLevel ?? 0,
            lastUpdated: new Date().toISOString(),
          },
        })

        // Refresh inboxes to get updated threshold before search
        await refreshInboxes()

        // Re-trigger search with new threshold
        search(activeInbox.prompt)

        toast({
          title: "Threshold updated",
          description: `Match threshold set to ${newThreshold}%`,
        })
      } catch (error) {
        console.error("Error updating threshold:", error)
        toast({
          title: "Error",
          description: "Failed to update threshold",
          variant: "destructive",
        })
      }
    }
  }

  // Calculate result stats for settings panel
  const resultStats = {
    totalContracts: allContracts.length,
    matchingAtThreshold: baseContracts.length,
  }

  // Show loading state while contracts are being loaded/embedded
  const isLoading = contractsLoading || searching || processingState === 'embedding'

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
          selectedInboxId={activeInboxId || ""}
          onSelectInbox={setActiveInboxId}
          onCollapse={() => setIsColumn1Collapsed(true)}
          onNewInbox={() => setShowInboxConfig(true)}
        />
      )}

      {isLoading ? (
        <ContractListSkeleton
          isColumn1Collapsed={isColumn1Collapsed}
          onExpandColumn1={() => setIsColumn1Collapsed(false)}
          inboxName={activeInbox?.name || "Loading..."}
        />
      ) : (
        <ContractList
          contracts={baseContracts as any}
          selectedInboxId={activeInboxId || ""}
          inboxName={activeInbox?.name || "All Contracts"}
          isColumn1Collapsed={isColumn1Collapsed}
          onExpandColumn1={() => setIsColumn1Collapsed(false)}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
          onSaveContract={handleSaveContract}
          onHideContract={handleHideContract}
          onRestoreContract={handleRestoreContract}
          onRerunInbox={handleRerunInbox}
          onDeleteInbox={handleDeleteInbox}
          onWidenSearch={handleWidenSearch}
          currentThreshold={activeInbox?.learningMetrics?.dynamicMinScore ?? globalThreshold}
          isAllContractsInbox={activeInbox?.isAllContractsInbox ?? false}
          globalThreshold={globalThreshold}
          onGlobalThresholdChange={handleGlobalThresholdChange}
          debugMode={debugMode}
          onDebugModeChange={setDebugMode}
          learningEnabled={learningEnabled}
          onLearningEnabledChange={setLearningEnabled}
          resultStats={resultStats}
        />
      )}

      {showDetailAsModal ? (
        <Dialog open={!!selectedContractId} onOpenChange={(open) => !open && handleCloseDetail()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
            <DialogTitle className="sr-only">
              {baseContracts.find((c) => c.id === selectedContractId)?.title || "Contract Details"}
            </DialogTitle>
            <ContractDetail
              contract={baseContracts.find((c) => c.id === selectedContractId) as any || null}
              onClose={handleCloseDetail}
              isModal={true}
              onSaveContract={handleSaveContract}
              onHideContract={handleHideContract}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <ContractDetail
          contract={baseContracts.find((c) => c.id === selectedContractId) as any || null}
          onClose={handleCloseDetail}
          isModal={false}
          onSaveContract={handleSaveContract}
          onHideContract={handleHideContract}
        />
      )}

      <InboxLoadingDialog
        isOpen={isCreatingInbox}
        inboxName={newInboxName}
        contractCount={baseContracts.length}
        onComplete={() => setIsCreatingInbox(false)}
      />

      <InitialLoadingDialog
        open={contractsLoading && processingState !== 'idle' && processingState !== 'error'}
        processingState={processingState}
        progress={embeddingProgress}
        contractCount={allContracts.length}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inbox?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{activeInbox?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteInbox} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
