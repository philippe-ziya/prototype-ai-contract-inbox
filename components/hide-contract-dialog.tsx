import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface HideContractDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (feedback?: string[]) => void
  contractTitle: string
  inboxName: string
}

export function HideContractDialog({
  isOpen,
  onClose,
  onConfirm,
  contractTitle,
  inboxName,
}: HideContractDialogProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([])

  const feedbackOptions = [
    "Not relevant to our work",
    "Wrong location",
    "Wrong value range",
    "Wrong sector/buyer type",
    "Other reason",
  ]

  const handleToggleFeedback = (option: string) => {
    setSelectedFeedback((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    )
  }

  const handleConfirm = () => {
    onConfirm(selectedFeedback)
    setSelectedFeedback([])
  }

  const handleClose = () => {
    setSelectedFeedback([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hide this contract?</DialogTitle>
          <DialogDescription className="pt-2">
            <span className="font-medium text-foreground">{contractTitle}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will hide this contract for all members of <span className="font-medium">{inboxName}</span>
          </p>
          
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Help us improve future matches (optional):
            </p>
            {feedbackOptions.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={option}
                  checked={selectedFeedback.includes(option)}
                  onCheckedChange={() => handleToggleFeedback(option)}
                />
                <Label
                  htmlFor={option}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Hide contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
