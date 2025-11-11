import { useState, useEffect, useCallback } from 'react';
import type { WorkflowStatus, WorkflowGenerateRequest, WorkflowGenerateResponse } from '@/types/task';

export function useTaskWorkflow() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a new workflow
  const generateWorkflow = useCallback(async (request: WorkflowGenerateRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to start workflow');
      }

      const data: WorkflowGenerateResponse = await response.json();
      setWorkflowId(data.workflowId);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch workflow status
  const fetchWorkflowStatus = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await fetch(`/api/workflow/${workflowId}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch workflow status');
      
      const data: WorkflowStatus = await response.json();
      setWorkflow(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, [workflowId]);

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!workflowId) return;

    // Initial fetch
    fetchWorkflowStatus();

    // Set up SSE stream
    const eventSource = new EventSource(`/api/workflow/${workflowId}/stream`);
    
    eventSource.addEventListener('task_update', (event) => {
      try {
        const update = JSON.parse(event.data);
        
        setWorkflow(prev => {
          if (!prev) return prev;
          
          const updateTask = (tasks: typeof prev.tasks): typeof prev.tasks => {
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
          
          // Recalculate overall progress
          const total = updatedTasks.length;
          const completed = updatedTasks.filter(t => t.status === 'completed').length;
          const overallProgress = total > 0 ? (completed / total) * 100 : 0;
          
          return {
            ...prev,
            tasks: updatedTasks,
            overallProgress,
            updatedAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    });

    eventSource.addEventListener('task_complete', (event) => {
      try {
        const update = JSON.parse(event.data);
        
        setWorkflow(prev => {
          if (!prev) return prev;
          
          const updateTask = (tasks: typeof prev.tasks): typeof prev.tasks => {
            return tasks.map(task => {
              if (task.id === update.taskId) {
                return { 
                  ...task, 
                  status: 'completed',
                  score: update.score,
                  output: update.output,
                  endTime: new Date().toISOString(),
                };
              }
              if (task.children) {
                return { ...task, children: updateTask(task.children) };
              }
              return task;
            });
          };

          return {
            ...prev,
            tasks: updateTask(prev.tasks),
            updatedAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    });

    eventSource.addEventListener('error', (err) => {
      console.error('SSE error:', err);
      // Fallback to polling if SSE fails
      const interval = setInterval(() => {
        fetchWorkflowStatus();
      }, 2000);
      
      eventSource.close();
      
      return () => clearInterval(interval);
    });

    return () => {
      eventSource.close();
    };
  }, [workflowId, fetchWorkflowStatus]);

  const reset = useCallback(() => {
    setWorkflowId(null);
    setWorkflow(null);
    setError(null);
  }, []);

  return {
    workflowId,
    workflow,
    isLoading,
    error,
    generateWorkflow,
    fetchWorkflowStatus,
    reset,
  };
}

