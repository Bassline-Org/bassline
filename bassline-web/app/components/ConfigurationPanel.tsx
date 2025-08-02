import { X, RotateCcw } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Slider } from '~/components/ui/slider'
import type { AppSettings, BlendMode } from '~/propagation-core/types'

interface ConfigurationPanelProps {
  appSettings: AppSettings
  onUpdatePropagation: (updates: Partial<AppSettings['propagation']>) => void
  onUpdateVisual: (updates: Partial<AppSettings['visual']>) => void
  onUpdateBehavior: (updates: Partial<AppSettings['behavior']>) => void
  onReset: () => void
  onClose: () => void
}

export function ConfigurationPanel({
  appSettings,
  onUpdatePropagation,
  onUpdateVisual,
  onUpdateBehavior,
  onReset,
  onClose
}: ConfigurationPanelProps) {
  return (
    <Card className="absolute right-4 top-4 w-[480px] max-h-[80vh] overflow-hidden flex flex-col z-50">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Customize default behaviors and appearance</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onReset}
              title="Reset to defaults"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto">
        <Tabs defaultValue="propagation" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="propagation">Propagation</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
          </TabsList>
          
          <TabsContent value="propagation" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-blend-mode">Default Blend Mode</Label>
              <Select
                value={appSettings.propagation.defaultBlendMode}
                onValueChange={(value: BlendMode) => 
                  onUpdatePropagation({ defaultBlendMode: value })
                }
              >
                <SelectTrigger id="default-blend-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept-last">Accept Last</SelectItem>
                  <SelectItem value="merge">Merge</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Default blend mode for new contacts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="boundary-blend-mode">Boundary Blend Mode</Label>
              <Select
                value={appSettings.propagation.defaultBoundaryBlendMode || appSettings.propagation.defaultBlendMode}
                onValueChange={(value: BlendMode) => 
                  onUpdatePropagation({ defaultBoundaryBlendMode: value })
                }
              >
                <SelectTrigger id="boundary-blend-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept-last">Accept Last</SelectItem>
                  <SelectItem value="merge">Merge</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Default blend mode for boundary contacts (optional)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-propagate">Auto-propagate on Connect</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically propagate existing values when creating connections
                </p>
              </div>
              <Switch
                id="auto-propagate"
                checked={appSettings.propagation.autoPropagateOnConnect}
                onCheckedChange={(checked) => 
                  onUpdatePropagation({ autoPropagateOnConnect: checked })
                }
              />
            </div>
          </TabsContent>
          
          <TabsContent value="visual" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-edges">Show Connection Lines</Label>
                <p className="text-sm text-muted-foreground">
                  Display edges between connected contacts
                </p>
              </div>
              <Switch
                id="show-edges"
                checked={appSettings.visual.showEdges}
                onCheckedChange={(checked) => 
                  onUpdateVisual({ showEdges: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edge-opacity">Edge Opacity</Label>
              <div className="flex items-center space-x-3">
                <Slider
                  id="edge-opacity"
                  min={0}
                  max={100}
                  step={5}
                  value={[appSettings.visual.edgeOpacity * 100]}
                  onValueChange={([value]) => 
                    onUpdateVisual({ edgeOpacity: value / 100 })
                  }
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {Math.round(appSettings.visual.edgeOpacity * 100)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="node-labels">Node Labels</Label>
                <p className="text-sm text-muted-foreground">
                  Show labels on contacts and gadgets
                </p>
              </div>
              <Switch
                id="node-labels"
                checked={appSettings.visual.nodeLabelsVisible}
                onCheckedChange={(checked) => 
                  onUpdateVisual({ nodeLabelsVisible: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compact-view">Compact Node View</Label>
                <p className="text-sm text-muted-foreground">
                  Use smaller, more compact node representations
                </p>
              </div>
              <Switch
                id="compact-view"
                checked={appSettings.visual.compactNodeView}
                onCheckedChange={(checked) => 
                  onUpdateVisual({ compactNodeView: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-fat-edges">Fat Edge Indicators</Label>
                <p className="text-sm text-muted-foreground">
                  Show thicker edges for arrays, sets, and objects
                </p>
              </div>
              <Switch
                id="show-fat-edges"
                checked={appSettings.visual.showFatEdges}
                onCheckedChange={(checked) => 
                  onUpdateVisual({ showFatEdges: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fat-edge-scale">Fat Edge Scale</Label>
              <div className="flex items-center space-x-3">
                <Slider
                  id="fat-edge-scale"
                  min={1}
                  max={3}
                  step={0.5}
                  value={[appSettings.visual.fatEdgeScale]}
                  onValueChange={([value]) => 
                    onUpdateVisual({ fatEdgeScale: value })
                  }
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {appSettings.visual.fatEdgeScale.toFixed(1)}x
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="animate-propagation">Animate Propagation</Label>
                <p className="text-sm text-muted-foreground">
                  Show visual feedback during propagation (future feature)
                </p>
              </div>
              <Switch
                id="animate-propagation"
                checked={appSettings.visual.animatePropagatation}
                onCheckedChange={(checked) => 
                  onUpdateVisual({ animatePropagatation: checked })
                }
                disabled
              />
            </div>
          </TabsContent>
          
          <TabsContent value="behavior" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multi-select">Multi-select with Drag</Label>
                <p className="text-sm text-muted-foreground">
                  Enable box selection by dragging
                </p>
              </div>
              <Switch
                id="multi-select"
                checked={appSettings.behavior.multiSelectWithDrag}
                onCheckedChange={(checked) => 
                  onUpdateBehavior({ multiSelectWithDrag: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="double-click">Double-click to Edit</Label>
                <p className="text-sm text-muted-foreground">
                  Edit contacts by double-clicking (vs single-click)
                </p>
              </div>
              <Switch
                id="double-click"
                checked={appSettings.behavior.doubleClickToEdit}
                onCheckedChange={(checked) => 
                  onUpdateBehavior({ doubleClickToEdit: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="merge-preview">Show Merge Preview</Label>
                <p className="text-sm text-muted-foreground">
                  Preview merge results before applying
                </p>
              </div>
              <Switch
                id="merge-preview"
                checked={appSettings.behavior.showMergePreview}
                onCheckedChange={(checked) => 
                  onUpdateBehavior({ showMergePreview: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="contradiction-alerts">Contradiction Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Show notifications when contradictions occur
                </p>
              </div>
              <Switch
                id="contradiction-alerts"
                checked={appSettings.behavior.showContradictionAlerts}
                onCheckedChange={(checked) => 
                  onUpdateBehavior({ showContradictionAlerts: checked })
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}