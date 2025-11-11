import { useMemo } from 'react';
import { TaskWorkflowViewer } from './TaskWorkflowViewer';
import { demoWorkflowTimeline } from '@/mocks/demoWorkflow';

export function TaskWorkflowDemo() {
  // memoize to ensure stable reference between renders
  const timeline = useMemo(() => demoWorkflowTimeline, []);

  return <TaskWorkflowViewer workflowId={null} demoTimeline={timeline} />;
}


