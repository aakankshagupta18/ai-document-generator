/**
 * Type definitions for task-based workflow system
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  name: string;
  type: string;
  status: TaskStatus;
  score?: number; // 0.0-1.0 validation score
  progress?: number; // 0-100 for running tasks
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  duration?: number; // in seconds
  output?: string | Record<string, any>;
  error?: string;
  children?: Task[];
  metadata?: Record<string, any>;
  currentSubtask?: string;
}

export interface WorkflowStatistics {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  averageScore: number;
  estimatedTimeRemaining: number; // in seconds
}

export interface WorkflowStatus {
  workflowId: string;
  jobId?: string;
  status: TaskStatus;
  overallProgress: number; // 0-100
  tasks: Task[];
  statistics: WorkflowStatistics;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowGenerateRequest {
  topic: string;
  audience?: string;
  purpose?: string;
  tone?: string;
  [key: string]: any;
}

export interface WorkflowGenerateResponse {
  jobId: string;
  workflowId: string;
  estimatedTasks: number;
}

