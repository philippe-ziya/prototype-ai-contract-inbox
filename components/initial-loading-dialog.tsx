'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Loader2, Database, CheckCircle2 } from 'lucide-react'
import type { ProcessingState } from '@/types'

interface InitialLoadingDialogProps {
  open: boolean
  processingState: ProcessingState
  progress?: { current: number; total: number }
  contractCount?: number
}

export function InitialLoadingDialog({
  open,
  processingState,
  progress,
  contractCount = 0,
}: InitialLoadingDialogProps) {
  const getStepStatus = (step: ProcessingState) => {
    const states: ProcessingState[] = ['loading', 'embedding', 'complete']
    const currentIndex = states.indexOf(processingState)
    const stepIndex = states.indexOf(step)

    if (currentIndex > stepIndex) return 'complete'
    if (currentIndex === stepIndex) return 'active'
    return 'pending'
  }

  const steps = [
    {
      state: 'loading' as ProcessingState,
      label: 'Loading contract data',
      description: 'Reading contract information from CSV',
    },
    {
      state: 'embedding' as ProcessingState,
      label: 'Loading AI embeddings',
      description: 'Loading pre-generated semantic search data',
    },
    {
      state: 'complete' as ProcessingState,
      label: 'Initializing search',
      description: 'Setting up semantic search capabilities',
    },
  ]

  const progressPercentage =
    progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md p-0 gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="border-b border-border p-6 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Database className="h-8 w-8 text-primary" />
            {processingState !== 'complete' && processingState !== 'error' && (
              <Loader2 className="h-4 w-4 absolute -top-1 -right-1 animate-spin text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">Setting Up Your Inbox</h2>
            <p className="text-sm text-muted-foreground">
              {processingState === 'complete'
                ? 'Ready to explore contracts'
                : 'Preparing your contract inbox...'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const status = getStepStatus(step.state)

              return (
                <div key={step.state} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {status === 'complete' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : status === 'active' ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        status === 'active'
                          ? 'text-foreground'
                          : status === 'complete'
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/60'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress Bar for Embedding State */}
          {processingState === 'embedding' && progress && progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Loading embeddings</span>
                <span className="font-medium">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {/* Information Box */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium">What's happening?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Loading {contractCount > 0 ? contractCount : 'contract'} records from the database</li>
              <li>• Pre-generated AI embeddings enable instant semantic search</li>
              <li>• This only happens once - future visits will be instant</li>
            </ul>
          </div>

          {/* Completion Message */}
          {processingState === 'complete' && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Setup complete! Loading your inbox...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
