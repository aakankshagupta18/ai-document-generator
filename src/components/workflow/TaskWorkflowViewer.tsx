import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Task, TaskStatus, WorkflowStatus } from '@/types/task';
import type { DemoTimelineStep } from '@/mocks/demoWorkflow';

interface TaskWorkflowViewerProps {
  workflowId?: string | null;
  demoTimeline?: DemoTimelineStep[];
  onComplete?: (workflow: WorkflowStatus) => void;
}

export function TaskWorkflowViewer({
  workflowId = null,
  demoTimeline,
  onComplete,
}: TaskWorkflowViewerProps) {
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(
    demoTimeline?.length ? demoTimeline[0].workflow : null,
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [minScore] = useState<number>(0);
  const isDemoMode = Boolean(demoTimeline?.length);

  // Fetch workflow status
  const fetchWorkflowStatus = useCallback(async () => {
    if (!workflowId || isDemoMode) return;

    try {
      const response = await fetch(`/api/workflow/${workflowId}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch workflow status');
      
      const data: WorkflowStatus = await response.json();
      setWorkflow(data);

      // Auto-expand running tasks
      const runningTaskIds = new Set<string>();
      const findRunningTasks = (tasks: Task[]) => {
        tasks.forEach(task => {
          if (task.status === 'running') {
            runningTaskIds.add(task.id);
          }
          if (task.children) {
            findRunningTasks(task.children);
          }
        });
      };
      findRunningTasks(data.tasks);
      setExpandedTasks(prev => new Set([...prev, ...runningTaskIds]));

      // Check if completed
      if (data.status === 'completed' && onComplete) {
        onComplete(data);
      }
    } catch (error) {
      console.error('Error fetching workflow status:', error);
      toast.error('Failed to load workflow status');
    }
  }, [workflowId, onComplete]);

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!workflowId || isDemoMode) return;

    // Initial fetch
    fetchWorkflowStatus();

    // Set up SSE stream
    const eventSource = new EventSource(`/api/workflow/${workflowId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        
        // Update workflow state
        setWorkflow(prev => {
          if (!prev) return prev;
          
          const updateTask = (tasks: Task[]): Task[] => {
            return tasks.map(task => {
              if (task.id === update.taskId) {
                return { ...task, ...update };
              }
              if (task.children) {
                return { ...task, children: updateTask(task.children) };
              }
              return task;
            });
          };

          const updatedTasks = updateTask(prev.tasks);
          
          // Recalculate statistics
          const stats = calculateStatistics(updatedTasks);
          
          return {
            ...prev,
            tasks: updatedTasks,
            statistics: stats,
            overallProgress: stats.completed / stats.total * 100,
            status: stats.failed > 0 ? 'failed' : 
                   stats.completed === stats.total ? 'completed' : 'running'
          };
        });
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Fallback to polling if SSE fails
      const interval = setInterval(fetchWorkflowStatus, 2000);
      eventSource.close();
      
      return () => clearInterval(interval);
    };

    return () => {
      eventSource.close();
    };
  }, [workflowId, fetchWorkflowStatus]);

  // Demo timeline playback
  useEffect(() => {
    if (!isDemoMode || !demoTimeline?.length) return;

    setWorkflow(demoTimeline[0].workflow);
    let accumulated = 0;
    const timers = demoTimeline.map((step, index) => {
      if (index === 0) return null;
      accumulated += step.delay;
      return setTimeout(() => {
        setWorkflow(step.workflow);
      }, accumulated);
    });

    return () => {
      timers.forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [demoTimeline, isDemoMode]);

  const calculateStatistics = (tasks: Task[]): WorkflowStatus['statistics'] => {
    let total = 0;
    let completed = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    let totalScore = 0;
    let scoredCount = 0;

    const countTasks = (taskList: Task[]) => {
      taskList.forEach(task => {
        total++;
        if (task.status === 'completed') {
          completed++;
          if (task.score !== undefined) {
            totalScore += task.score;
            scoredCount++;
          }
        } else if (task.status === 'failed') {
          failed++;
        } else if (task.status === 'running') {
          running++;
        } else {
          pending++;
        }
        if (task.children) {
          countTasks(task.children);
        }
      });
    };

    countTasks(tasks);

    return {
      total,
      completed,
      failed,
      running,
      pending,
      averageScore: scoredCount > 0 ? totalScore / scoredCount : 0,
      estimatedTimeRemaining: 0 // TODO: Calculate from task durations
    };
  };

  // Auto-expand running tasks when workflow updates
  useEffect(() => {
    if (!workflow) return;

    const runningTaskIds = new Set<string>();
    const findRunningTasks = (tasks: Task[]) => {
      tasks.forEach((task) => {
        if (task.status === 'running') {
          runningTaskIds.add(task.id);
        }
        if (task.children) {
          findRunningTasks(task.children);
        }
      });
    };
    findRunningTasks(workflow.tasks);

    if (runningTaskIds.size > 0) {
      setExpandedTasks((prev) => new Set([...prev, ...runningTaskIds]));
    }
  }, [workflow]);

  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return '--';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getScoreColor = (score?: number): string => {
    if (score === undefined) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-amber-600';
    return 'text-red-600';
  };

  const filterTask = (task: Task): boolean => {
    if (filter !== 'all' && task.status !== filter) return false;
    if (task.score !== undefined && task.score < minScore) return false;
    return true;
  };

  const renderTask = (task: Task, level: number = 0): React.ReactNode => {
    if (!filterTask(task)) return null;

    const hasChildren = task.children && task.children.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id} className="mb-2">
        <Card className={`p-3 transition-all ${
          task.status === 'completed' ? 'bg-green-50 border-l-4 border-l-green-500' :
          task.status === 'running' ? 'bg-amber-50 border-l-4 border-l-amber-500' :
          task.status === 'failed' ? 'bg-red-50 border-l-4 border-l-red-500' :
          'bg-gray-50 border-l-4 border-l-gray-400'
        }`}>
          <div className="flex items-start gap-3">
            {/* Indent for nested tasks */}
            <div style={{ width: level * 24 }} />
            
            {/* Expand/Collapse button */}
            {hasChildren && (
              <button
                onClick={() => toggleTask(task.id)}
                className="mt-1 text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}

            {/* Status icon */}
            <div className="mt-1">{getStatusIcon(task.status)}</div>

            {/* Task content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-semibold text-sm text-gray-900 truncate">
                  {task.name}
                </div>
                {task.score !== undefined && (
                  <Badge 
                    variant="outline" 
                    className={`${getScoreColor(task.score)} border-current`}
                  >
                    Score: {(task.score * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>

              {/* Status and timing */}
              <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                <span className="capitalize">{task.status}</span>
                {task.startTime && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(task.startTime)}
                      {task.endTime && ` - ${formatTime(task.endTime)}`}
                      {task.duration && ` (${formatDuration(task.duration)})`}
                    </span>
                  </>
                )}
              </div>

              {/* Progress bar for running tasks */}
              {task.status === 'running' && task.progress !== undefined && (
                <Progress value={task.progress} className="h-1 mb-2" />
              )}

              {/* Output preview */}
              {task.output && isExpanded && (
                <div className="mt-2 p-2 bg-white rounded border text-xs text-gray-700">
                  <div className="font-medium mb-1">Output:</div>
                  {typeof task.output === 'string' ? (
                    <div className="line-clamp-3">{task.output}</div>
                  ) : (
                    <pre className="text-xs overflow-auto max-h-32">
                      {JSON.stringify(task.output, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Error message */}
              {task.error && (
                <div className="mt-2 p-2 bg-red-100 rounded border border-red-300 text-xs text-red-700">
                  <div className="flex items-center gap-1 font-medium mb-1">
                    <AlertCircle className="w-3 h-3" />
                    Error:
                  </div>
                  <div>{task.error}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="ml-6 mt-1">
            {task.children!.map(child => renderTask(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!workflow && !isDemoMode) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-center text-gray-500">
          <Circle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No workflow selected</p>
        </CardContent>
      </Card>
    );
  }

  if (!workflow) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-500" />
          <p className="text-gray-600">Loading workflow...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Task Workflow</CardTitle>
          <Badge variant={workflow.status === 'completed' ? 'default' : 'secondary'}>
            {workflow.status}
          </Badge>
        </div>
        
        {/* Statistics */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-100 p-2 rounded">
            <div className="text-gray-600">Total</div>
            <div className="font-semibold text-gray-900">{workflow.statistics.total}</div>
          </div>
          <div className="bg-green-100 p-2 rounded">
            <div className="text-green-600">Completed</div>
            <div className="font-semibold text-green-900">{workflow.statistics.completed}</div>
          </div>
          <div className="bg-amber-100 p-2 rounded">
            <div className="text-amber-600">Running</div>
            <div className="font-semibold text-amber-900">{workflow.statistics.running}</div>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-semibold">{workflow.overallProgress.toFixed(0)}%</span>
          </div>
          <Progress value={workflow.overallProgress} className="h-2" />
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="h-7 text-xs"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === 'running' ? 'default' : 'outline'}
            onClick={() => setFilter('running')}
            className="h-7 text-xs"
          >
            Running
          </Button>
          <Button
            size="sm"
            variant={filter === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilter('completed')}
            className="h-7 text-xs"
          >
            Completed
          </Button>
          {workflow.statistics.averageScore > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">
                Avg Score: {(workflow.statistics.averageScore * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {workflow.tasks.map(task => renderTask(task))}
      </CardContent>
    </Card>
  );
}

