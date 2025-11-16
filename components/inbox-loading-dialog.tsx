"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface InboxLoadingDialogProps {
  isOpen: boolean
  inboxName: string
  contractCount?: number
  onComplete: () => void
}

const loadingSteps = [
  "Setting up semantic search...",
  "Matching contracts...",
  "Preparing results..."
]

export function InboxLoadingDialog({ isOpen, inboxName, contractCount = 47, onComplete }: InboxLoadingDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0)
      setShowSuccess(false)
      return
    }

    // Cycle through loading steps
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 800)

    // Show success after loading
    const successTimeout = setTimeout(() => {
      setShowSuccess(true)
    }, 2500)

    // Auto-complete after showing success
    const completeTimeout = setTimeout(() => {
      onComplete()
    }, 4500)

    return () => {
      clearInterval(stepInterval)
      clearTimeout(successTimeout)
      clearTimeout(completeTimeout)
    }
  }, [isOpen, onComplete])

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" hideClose>
        <div className="py-8 px-4 text-center">
          {!showSuccess ? (
            <>
              {/* Loading State */}
              <div className="flex justify-center mb-6">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Creating your inbox...</h2>
              <p className="text-muted-foreground mb-6">Analyzing contract opportunities</p>
              
              {/* Progress Steps */}
              <div className="space-y-2 text-sm">
                {loadingSteps.map((step, index) => (
                  <div
                    key={index}
                    className={cn(
                      "transition-all duration-300",
                      index <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <CheckCircle2 className="h-12 w-12 text-green-500 animate-in zoom-in duration-300" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Inbox created!</h2>
              <p className="text-lg text-muted-foreground mb-1">
                <span className="font-semibold text-foreground">"{inboxName}"</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Found {contractCount} contracts matching your search
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
