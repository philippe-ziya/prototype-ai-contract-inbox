'use client'

import { useState } from 'react'
import { Settings, X, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MatchingSettingsProps {
  globalThreshold: number
  onThresholdChange: (threshold: number) => void
  debugMode: {
    showRawScores: boolean
    showExplanations: boolean
    showFilterReasons: boolean
  }
  onDebugModeChange: (mode: {
    showRawScores: boolean
    showExplanations: boolean
    showFilterReasons: boolean
  }) => void
  learningEnabled: boolean
  onLearningEnabledChange: (enabled: boolean) => void
  resultStats?: {
    totalContracts: number
    matchingAtThreshold: number
    scoreDistribution?: { range: string; count: number }[]
  }
}

export function MatchingSettings({
  globalThreshold,
  onThresholdChange,
  debugMode,
  onDebugModeChange,
  learningEnabled,
  onLearningEnabledChange,
  resultStats,
}: MatchingSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localThreshold, setLocalThreshold] = useState(globalThreshold)

  const handleThresholdChange = (value: number[]) => {
    setLocalThreshold(value[0])
  }

  const handleApplyThreshold = () => {
    onThresholdChange(localThreshold)
  }

  const getThresholdColor = (threshold: number) => {
    if (threshold <= 30) return 'text-green-600'
    if (threshold <= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getThresholdLabel = (threshold: number) => {
    if (threshold <= 30) return 'Broad (more results)'
    if (threshold <= 50) return 'Moderate'
    return 'Strict (fewer results)'
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Matching Settings</SheetTitle>
          <SheetDescription>
            Experiment with matching thresholds and debug options
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Threshold Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Match Threshold</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn('text-lg font-bold', getThresholdColor(localThreshold))}>
                  {localThreshold}%
                </Badge>
              </div>
            </div>

            <Slider
              value={[localThreshold]}
              onValueChange={handleThresholdChange}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0% (All contracts)</span>
              <span className={getThresholdColor(localThreshold)}>
                {getThresholdLabel(localThreshold)}
              </span>
              <span>100% (Exact match)</span>
            </div>

            {localThreshold !== globalThreshold && (
              <Button onClick={handleApplyThreshold} className="w-full" size="sm">
                Apply Threshold ({localThreshold}%)
              </Button>
            )}

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground">
                  Lower thresholds show more results but may include less relevant contracts.
                  Higher thresholds are more selective but may miss relevant opportunities.
                </p>
              </div>
            </div>
          </div>

          {/* Results Preview */}
          {resultStats && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Results Preview</Label>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total contracts:</span>
                  <span className="font-semibold">{resultStats.totalContracts}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Matching at {globalThreshold}%:</span>
                  <span className="font-semibold text-primary">{resultStats.matchingAtThreshold}</span>
                </div>
                {resultStats.scoreDistribution && resultStats.scoreDistribution.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-2">Score Distribution:</p>
                    {resultStats.scoreDistribution.map((dist) => (
                      <div key={dist.range} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">{dist.range}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full"
                            style={{ width: `${(dist.count / resultStats.totalContracts) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{dist.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debug Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Debug Options</Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="raw-scores" className="text-sm font-medium">
                  Show Raw Scores
                </Label>
                <p className="text-xs text-muted-foreground">
                  Display cosine similarity values alongside match percentages
                </p>
              </div>
              <Switch
                id="raw-scores"
                checked={debugMode.showRawScores}
                onCheckedChange={(checked) =>
                  onDebugModeChange({ ...debugMode, showRawScores: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="explanations" className="text-sm font-medium">
                  Show AI Explanations
                </Label>
                <p className="text-xs text-muted-foreground">
                  Generate and display match explanations for all results
                </p>
              </div>
              <Switch
                id="explanations"
                checked={debugMode.showExplanations}
                onCheckedChange={(checked) =>
                  onDebugModeChange({ ...debugMode, showExplanations: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="filter-reasons" className="text-sm font-medium">
                  Show Filter Reasons
                </Label>
                <p className="text-xs text-muted-foreground">
                  Display why contracts were filtered out
                </p>
              </div>
              <Switch
                id="filter-reasons"
                checked={debugMode.showFilterReasons}
                onCheckedChange={(checked) =>
                  onDebugModeChange({ ...debugMode, showFilterReasons: checked })
                }
              />
            </div>
          </div>

          {/* Learning System */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Learning System</Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="learning" className="text-sm font-medium">
                  Enable Adaptive Learning
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically adjust thresholds based on your feedback
                </p>
              </div>
              <Switch
                id="learning"
                checked={learningEnabled}
                onCheckedChange={onLearningEnabledChange}
              />
            </div>

            {!learningEnabled && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Learning disabled. Threshold adjustments from save/hide actions will not be applied.
                </p>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setLocalThreshold(30)
                onThresholdChange(30)
                onDebugModeChange({
                  showRawScores: false,
                  showExplanations: false,
                  showFilterReasons: false,
                })
                onLearningEnabledChange(true)
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
