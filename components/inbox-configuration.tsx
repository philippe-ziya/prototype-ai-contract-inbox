"use client"

import { useState } from "react"
import { ArrowLeft, Building2, CheckCircle2, Hammer, Laptop, Users } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface InboxConfigurationProps {
  onClose: () => void
  onCreateInbox: (name: string, prompt: string, invites: string[]) => void
}

const promptSuggestions = [
  {
    id: "construction",
    icon: Hammer,
    prompt: "Construction projects over £100k in the South East",
    explanation: "Based on your focus on commercial construction and regional presence",
    category: "Construction & Building"
  },
  {
    id: "highways",
    icon: Building2,
    prompt: "Highway maintenance and repair contracts for local councils",
    explanation: "Matches your expertise in public infrastructure and council relationships",
    category: "Infrastructure"
  },
  {
    id: "renovation",
    icon: Building2,
    prompt: "Public building renovation opportunities worth £50k-£500k",
    explanation: "Aligns with your project size range and renovation capabilities",
    category: "Renovation & Refurbishment"
  }
]

export function InboxConfiguration({ onClose, onCreateInbox }: InboxConfigurationProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [inboxName, setInboxName] = useState("")
  const [showInvites, setShowInvites] = useState(false)
  const [inviteEmails, setInviteEmails] = useState("")

  const activePrompt = customPrompt || (selectedPrompt ? promptSuggestions.find(p => p.id === selectedPrompt)?.prompt : null)

  const handleSelectPrompt = (id: string) => {
    setSelectedPrompt(id)
    setCustomPrompt("")
    const suggestion = promptSuggestions.find(p => p.id === id)
    if (suggestion) {
      setInboxName(generateInboxName(suggestion.prompt))
    }
  }

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value)
    setSelectedPrompt(null)
    if (value) {
      setInboxName(generateInboxName(value))
    }
  }

  const generateInboxName = (prompt: string) => {
    if (prompt.toLowerCase().includes("construction")) return "SE Construction Contracts"
    if (prompt.toLowerCase().includes("highway")) return "Highway Maintenance"
    if (prompt.toLowerCase().includes("renovation")) return "Building Renovations"
    return "New Contract Inbox"
  }

  const handleCreate = () => {
    if (!activePrompt) return
    const emails = inviteEmails.split(",").map(e => e.trim()).filter(Boolean)
    onCreateInbox(inboxName || generateInboxName(activePrompt), activePrompt, emails)
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Create new contract inbox</h1>
          <p className="text-muted-foreground">
            Based on <span className="font-medium text-foreground">BuildCo Construction Ltd</span>'s business, here are some recommended searches
          </p>
        </div>

        {/* Company Context */}
        <Card className="p-4 mb-8 border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">BuildCo Construction Ltd</p>
              <p className="text-xs text-muted-foreground">Commercial Construction • South East UK</p>
            </div>
          </div>
        </Card>

        {/* AI Prompt Suggestions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Recommended contract searches</h2>
          <div className="space-y-3">
            {promptSuggestions.map((suggestion) => {
              const Icon = suggestion.icon
              const isSelected = selectedPrompt === suggestion.id
              return (
                <Card
                  key={suggestion.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:border-primary/50",
                    isSelected && "border-primary bg-primary/5"
                  )}
                  onClick={() => handleSelectPrompt(suggestion.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-medium text-base leading-snug">{suggestion.prompt}</p>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-sm text-muted-foreground font-medium">OR</span>
          </div>
        </div>

        {/* Custom Prompt */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Write your own custom prompt</h2>
          <Textarea
            placeholder="Describe the contracts you're looking for in plain English..."
            value={customPrompt}
            onChange={(e) => handleCustomPromptChange(e.target.value)}
            className="min-h-[120px] resize-none"
            maxLength={500}
          />
          <div className="flex items-start justify-between mt-2">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Examples:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• IT support contracts for NHS trusts in London</li>
                <li>• Building maintenance under £50k across the UK</li>
                <li>• Professional consulting services for education sector</li>
              </ul>
            </div>
            <span className="text-xs text-muted-foreground">{customPrompt.length}/500</span>
          </div>
        </div>

        {/* Name Your Inbox */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold">Name your inbox</h2>
            <Badge variant="secondary" className="text-xs">Optional</Badge>
          </div>
          <Input
            placeholder="Auto-generated based on your prompt"
            value={inboxName}
            onChange={(e) => setInboxName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">You can change this later</p>
        </div>

        {/* Team Members */}
        <div className="mb-8">
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showInvites}
              onChange={(e) => setShowInvites(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium">Invite team members now</span>
          </label>
          {showInvites ? (
            <>
              <Input
                placeholder="colleague@example.com, another@example.com"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                They'll be able to view, save, and hide contracts in this inbox
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can invite members later from inbox settings
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!activePrompt}
          >
            Create inbox
          </Button>
        </div>
      </div>
    </div>
  )
}
