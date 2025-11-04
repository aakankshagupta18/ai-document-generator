import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Play, Circle, Loader2, Plus, ChevronDown, ChevronUp, Edit2, Save, X, Trash2, Bookmark, BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowStep {
  id: string;
  title: string;
  prompt: string;
  status: 'pending' | 'running' | 'complete';
  progress?: number;
  output?: string;
}

interface WorkflowPanelProps {
  onWorkflowComplete: (content: string) => void;
}

interface WorkflowTemplate {
  name: string;
  icon: string;
  steps: Array<{ title: string; prompt: string }>;
  isCustom?: boolean;
  id?: string;
}

const defaultTemplates: WorkflowTemplate[] = [
  {
    name: 'Default',
    icon: '📄',
    steps: [
      { title: 'Introduction', prompt: 'Write an introduction about: {prompt}' },
      { title: 'Main Content', prompt: 'Create the main content section covering: {prompt}' },
      { title: 'Conclusion', prompt: 'Write a conclusion summarizing: {prompt}' }
    ]
  },
  {
    name: 'Research Paper',
    icon: '📚',
    steps: [
      { title: 'Introduction Topic', prompt: 'Generate a compelling introduction topic for: {prompt}' },
      { title: 'Supporting Paragraphs', prompt: 'Create 2-3 supporting paragraphs for the introduction about: {prompt}' },
      { title: 'Main Body Section 1', prompt: 'Write the first main body section discussing: {prompt}' },
      { title: 'Main Body Section 2', prompt: 'Write the second main body section exploring: {prompt}' },
      { title: 'Conclusion', prompt: 'Summarize and conclude about: {prompt}' }
    ]
  },
  {
    name: 'Blog Post',
    icon: '✍️',
    steps: [
      { title: 'Attention-Grabbing Hook', prompt: 'Create an engaging opening hook for a blog post about: {prompt}' },
      { title: 'Main Point 1', prompt: 'Write the first key point about: {prompt}' },
      { title: 'Main Point 2', prompt: 'Write the second key point about: {prompt}' },
      { title: 'Main Point 3', prompt: 'Write the third key point about: {prompt}' },
      { title: 'Call to Action', prompt: 'End with a compelling call to action related to: {prompt}' }
    ]
  },
  {
    name: 'Business Plan',
    icon: '💼',
    steps: [
      { title: 'Executive Summary', prompt: 'Write an executive summary for: {prompt}' },
      { title: 'Problem Statement', prompt: 'Define the problem being solved: {prompt}' },
      { title: 'Solution Overview', prompt: 'Describe the proposed solution: {prompt}' },
      { title: 'Market Analysis', prompt: 'Provide market analysis for: {prompt}' },
      { title: 'Financial Projections', prompt: 'Outline financial projections for: {prompt}' }
    ]
  }
];

const STORAGE_KEY = 'workflow_custom_templates';

export function WorkflowPanel({ onWorkflowComplete }: WorkflowPanelProps) {
  const [workflow, setWorkflow] = useState<WorkflowStep[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingPrompt, setEditingPrompt] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepPrompt, setNewStepPrompt] = useState('');
  const [customTemplates, setCustomTemplates] = useState<WorkflowTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIcon, setNewTemplateIcon] = useState('📝');

  // Load custom templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomTemplates(parsed);
      }
    } catch (error) {
      console.error('Failed to load custom templates:', error);
    }
  }, []);

  // Combine default and custom templates
  const allTemplates: WorkflowTemplate[] = [...defaultTemplates, ...customTemplates];

  const loadTemplate = useCallback((template: WorkflowTemplate) => {
    const steps: WorkflowStep[] = template.steps.map((step: { title: string; prompt: string }, idx: number) => ({
      id: `step_${idx + 1}`,
      title: step.title,
      prompt: step.prompt,
      status: 'pending' as const
    }));
    setWorkflow(steps);
    setExpandedSteps(new Set(steps.map(s => s.id)));
    toast.success(`Loaded ${template.name} template`);
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, []);

  const startEditing = useCallback((step: WorkflowStep) => {
    setEditingStepId(step.id);
    setEditingTitle(step.title);
    setEditingPrompt(step.prompt);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingStepId(null);
    setEditingTitle('');
    setEditingPrompt('');
  }, []);

  const saveStep = useCallback((stepId: string) => {
    if (!editingTitle.trim() || !editingPrompt.trim()) {
      toast.error('Title and prompt are required');
      return;
    }
    setWorkflow(prev => prev!.map(s => 
      s.id === stepId 
        ? { ...s, title: editingTitle.trim(), prompt: editingPrompt.trim() }
        : s
    ));
    cancelEditing();
    toast.success('Step updated');
  }, [editingTitle, editingPrompt, cancelEditing]);

  const deleteStep = useCallback((stepId: string) => {
    setWorkflow(prev => {
      const filtered = prev!.filter(s => s.id !== stepId);
      if (filtered.length === 0) {
        return null;
      }
      return filtered;
    });
    toast.success('Step deleted');
  }, []);

  const addCustomStep = useCallback(() => {
    if (!newStepTitle.trim() || !newStepPrompt.trim()) {
      toast.error('Title and prompt are required');
      return;
    }
    if (!workflow) {
      toast.error('Please load a template first');
      return;
    }
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: newStepTitle.trim(),
      prompt: newStepPrompt.trim(),
      status: 'pending'
    };
    setWorkflow(prev => [...prev!, newStep]);
    setNewStepTitle('');
    setNewStepPrompt('');
    setShowAddStep(false);
    setExpandedSteps(prev => new Set([...prev, newStep.id]));
    toast.success('Custom step added');
  }, [newStepTitle, newStepPrompt, workflow]);

  const runAllSteps = useCallback(async () => {
    if (!workflow) return;
    
    setIsRunning(true);
    const results: string[] = [];
    
    for (const step of workflow) {
      // Update step to running
      setWorkflow(prev => prev!.map(s => 
        s.id === step.id ? { ...s, status: 'running' as const, progress: 0 } : s
      ));

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setWorkflow(prev => prev!.map(s => 
          s.id === step.id ? { ...s, progress } : s
        ));
      }

      // Generate content (simulated)
      const content = `[${step.title}]\nGenerated content for: ${step.prompt}\n\n`;
      results.push(content);

      // Mark complete
      setWorkflow(prev => prev!.map(s => 
        s.id === step.id 
          ? { ...s, status: 'complete' as const, progress: 100, output: content }
          : s
      ));
    }

    setIsRunning(false);
    
    // Combine results
    const finalContent = results.join('\n');
    onWorkflowComplete(`<div>${finalContent.replace(/\n/g, '<br>')}</div>`);
    toast.success('Workflow completed! 🎉');
  }, [workflow, onWorkflowComplete]);

  const runSingleStep = useCallback(async (stepId: string) => {
    if (!workflow) return;
    
    const step = workflow.find(s => s.id === stepId);
    if (!step || step.status === 'running') return;

    // Update step to running
    setWorkflow(prev => prev!.map(s => 
      s.id === stepId ? { ...s, status: 'running' as const, progress: 0 } : s
    ));

    // Simulate progress
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setWorkflow(prev => prev!.map(s => 
        s.id === stepId ? { ...s, progress } : s
      ));
    }

    // Generate content (simulated)
    const content = `[${step.title}]\nGenerated content for: ${step.prompt}\n\n`;

    // Mark complete
    setWorkflow(prev => prev!.map(s => 
      s.id === stepId 
        ? { ...s, status: 'complete' as const, progress: 100, output: content }
        : s
    ));

    toast.success(`Step "${step.title}" completed!`);
    
    // If this is the last step and all are complete, combine results
    const updated = workflow.map(s => s.id === stepId 
      ? { ...s, status: 'complete' as const, progress: 100, output: content }
      : s
    );
    const allComplete = updated.every(s => s.status === 'complete');
    if (allComplete) {
      const finalContent = updated.map(s => s.output || '').join('\n');
      onWorkflowComplete(`<div>${finalContent.replace(/\n/g, '<br>')}</div>`);
      toast.success('All steps completed! 🎉');
    }
  }, [workflow, onWorkflowComplete]);

  const saveCurrentAsTemplate = useCallback(() => {
    if (!workflow || workflow.length === 0) {
      toast.error('No workflow to save');
      return;
    }
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    
    const newTemplate: WorkflowTemplate = {
      name: newTemplateName.trim(),
      icon: newTemplateIcon,
      steps: workflow.map(s => ({
        title: s.title,
        prompt: s.prompt
      })),
      isCustom: true,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success(`Template "${newTemplate.name}" saved!`);
      setShowSaveTemplate(false);
      setNewTemplateName('');
      setNewTemplateIcon('📝');
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template');
    }
  }, [workflow, newTemplateName, newTemplateIcon, customTemplates]);

  const deleteCustomTemplate = useCallback((templateId: string, templateName: string) => {
    const updated = customTemplates.filter(t => t.id !== templateId);
    setCustomTemplates(updated);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success(`Template "${templateName}" deleted`);
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    }
  }, [customTemplates]);

  const progress = workflow 
    ? Math.round((workflow.filter(s => s.status === 'complete').length / workflow.length) * 100)
    : 0;

  return (
    <Card className="rounded-2xl h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {/* <Plus className="w-5 h-5" /> */}
            Workflow
          </CardTitle>
          {workflow && (
            <div className="text-xs text-gray-500">{workflow.filter(s => s.status === 'complete').length}/{workflow.length}</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
        {!workflow ? (
          <div className="space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 font-medium">Choose a template:</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSaveTemplate(true)}
                className="h-7 text-xs"
              >
                <BookmarkPlus className="w-3 h-3 mr-1" />
                New Template
              </Button>
            </div>
            {allTemplates.map((template: WorkflowTemplate) => (
              <div key={template.id || template.name} className="flex items-center gap-2">
                <button
                  onClick={() => loadTemplate(template)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left flex-1"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{template.steps.length} steps</div>
                  </div>
                </button>
                {template.isCustom && template.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete template "${template.name}"?`)) {
                        deleteCustomTemplate(template.id!, template.name);
                      }
                    }}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {showSaveTemplate && (
              <Card className="p-3 bg-purple-50 border-l-4 border-l-purple-500">
                <div className="space-y-2">
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="text-sm font-semibold"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={newTemplateIcon}
                      onChange={(e) => setNewTemplateIcon(e.target.value)}
                      placeholder="Icon emoji"
                      className="text-lg w-20"
                      maxLength={2}
                    />
                    <div className="text-xs text-gray-600 flex items-center">e.g., 📝 📚 ✍️</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const defaultTemplate: WorkflowTemplate = {
                          name: newTemplateName.trim() || 'My Template',
                          icon: newTemplateIcon || '📝',
                          steps: [],
                          isCustom: true,
                          id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        };
                        const updated = [...customTemplates, defaultTemplate];
                        setCustomTemplates(updated);
                        try {
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                          toast.success('Empty template created! Add steps after loading.');
                          loadTemplate(defaultTemplate);
                          setShowSaveTemplate(false);
                          setNewTemplateName('');
                          setNewTemplateIcon('📝');
                        } catch {
                          toast.error('Failed to create template');
                        }
                      }}
                      className="h-7 text-xs"
                      disabled={!newTemplateName.trim()}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Create Empty
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowSaveTemplate(false);
                        setNewTemplateName('');
                        setNewTemplateIcon('📝');
                      }}
                      className="h-7 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Progress</span>
                <span className="text-gray-900 font-semibold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {workflow.map((step, idx) => (
                <div key={step.id} className="relative">
                  {idx < workflow.length - 1 && (
                    <div className="absolute left-6 top-full w-0.5 h-4 bg-gray-300" />
                  )}
                  
                  <Card className={`p-3 transition-all ${
                    step.status === 'pending' ? 'bg-gray-50 border-l-4 border-l-gray-400' :
                    step.status === 'running' ? 'bg-amber-50 border-l-4 border-l-amber-500' :
                    'bg-green-50 border-l-4 border-l-green-500'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {step.status === 'pending' && <Circle className="w-5 h-5 text-gray-400" />}
                        {step.status === 'running' && <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
                        {step.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      </div>
                      
                      <div className="flex-1">
                        {editingStepId === step.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              placeholder="Step title"
                              className="text-sm font-semibold"
                            />
                            <Textarea
                              value={editingPrompt}
                              onChange={(e) => setEditingPrompt(e.target.value)}
                              placeholder="Step prompt"
                              className="text-xs min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveStep(step.id)}
                                className="h-7 text-xs"
                              >
                                <Save className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                className="h-7 text-xs"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-sm text-gray-900">{step.title}</div>
                            
                            {step.status === 'running' && step.progress !== undefined && (
                              <Progress value={step.progress} className="h-1 mt-2" />
                            )}
                            
                            {expandedSteps.has(step.id) && (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs text-gray-600 bg-white/70 p-2 rounded border">
                                  <div className="font-medium mb-1">Prompt:</div>
                                  {step.prompt}
                                </div>
                                {step.output && (
                                  <div className="text-xs text-green-700 bg-white p-2 rounded border border-green-200">
                                    <div className="font-medium mb-1">Output:</div>
                                    <div className="line-clamp-2">{step.output}</div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditing(step)}
                                    className="h-7 text-xs"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => runSingleStep(step.id)}
                                    disabled={step.status === 'running'}
                                    className="h-7 text-xs"
                                  >
                                    {step.status === 'running' ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Play className="w-3 h-3 mr-1" />
                                    )}
                                    Run
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteStep(step.id)}
                                    className="h-7 text-xs text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={editingStepId === step.id}
                      >
                        {expandedSteps.has(step.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </Card>
                </div>
              ))}

              {/* Add Custom Step Form */}
              {showAddStep && (
                <Card className="p-3 bg-blue-50 border-l-4 border-l-blue-500">
                  <div className="space-y-2">
                    <Input
                      value={newStepTitle}
                      onChange={(e) => setNewStepTitle(e.target.value)}
                      placeholder="Step title (e.g., Custom Section)"
                      className="text-sm font-semibold"
                    />
                    <Textarea
                      value={newStepPrompt}
                      onChange={(e) => setNewStepPrompt(e.target.value)}
                      placeholder="Step prompt (e.g., Write about: {prompt})"
                      className="text-xs min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={addCustomStep}
                        className="h-7 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Step
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddStep(false);
                          setNewStepTitle('');
                          setNewStepPrompt('');
                        }}
                        className="h-7 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Add Step Button */}
              {!showAddStep && (
                <Button
                  variant="outline"
                  onClick={() => setShowAddStep(true)}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Step
                </Button>
              )}

              {/* Save Template Form */}
              {showSaveTemplate && (
                <Card className="p-3 bg-purple-50 border-l-4 border-l-purple-500">
                  <div className="space-y-2">
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Template name"
                      className="text-sm font-semibold"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={newTemplateIcon}
                        onChange={(e) => setNewTemplateIcon(e.target.value)}
                        placeholder="Icon emoji"
                        className="text-lg w-20"
                        maxLength={2}
                      />
                      <div className="text-xs text-gray-600 flex items-center">e.g., 📝 📚 ✍️</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveCurrentAsTemplate}
                        className="h-7 text-xs"
                        disabled={!newTemplateName.trim()}
                      >
                        <Bookmark className="w-3 h-3 mr-1" />
                        Save Template
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowSaveTemplate(false);
                          setNewTemplateName('');
                          setNewTemplateIcon('📝');
                        }}
                        className="h-7 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0 pt-2 border-t">
              <Button
                onClick={runAllSteps}
                disabled={isRunning}
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run All
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSaveTemplate(true)}
                className="flex-1"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Save as Template
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setWorkflow(null);
                  setShowAddStep(false);
                  setEditingStepId(null);
                  setShowSaveTemplate(false);
                }}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

