import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  XCircle,
  FileText,
  Sparkles,
  FileCheck,
  Download
} from "lucide-react";

export interface ProcessStatus {
  jobId: string;
  stage: 'initializing' | 'analyzing' | 'generating' | 'formatting' | 'finalizing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  startTime?: number;
  estimatedTimeRemaining?: number; // in seconds
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  details?: string[];
  docHtml?: string;
  pdfUrl?: string;
}

interface StatusTrackerProps {
  jobId: string | null;
  isLoading?: boolean;
  onCancel?: () => void;
  onStatusUpdate?: (status: ProcessStatus) => void;
}

// Stage configurations with icons and colors
const STAGE_CONFIG = {
  initializing: { label: "Initializing", icon: Loader2, color: "text-blue-500", bgColor: "bg-blue-50" },
  analyzing: { label: "Analyzing Content", icon: Sparkles, color: "text-purple-500", bgColor: "bg-purple-50" },
  generating: { label: "Generating Document", icon: FileText, color: "text-indigo-500", bgColor: "bg-indigo-50" },
  formatting: { label: "Formatting", icon: FileCheck, color: "text-cyan-500", bgColor: "bg-cyan-50" },
  finalizing: { label: "Finalizing", icon: Download, color: "text-green-500", bgColor: "bg-green-50" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-600", bgColor: "bg-red-50" },
};

// Format time in human readable format
function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function StatusTracker({ jobId, isLoading, onCancel, onStatusUpdate }: StatusTrackerProps) {
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Poll for status updates
  useEffect(() => {
    if (!jobId) {
      console.log('[StatusTracker] No jobId yet, waiting...');
      setStatus(null);
      return;
    }

    console.log('[StatusTracker] Starting polling for jobId:', jobId);
    let isMounted = true;
    const pollInterval: ReturnType<typeof setInterval> = setInterval(async () => {
      try {
        console.log('[StatusTracker] Polling status for jobId:', jobId);
        const response = await fetch(`/api/status/${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch status');
        const data: ProcessStatus = await response.json();
        console.log('[StatusTracker] Received status:', data);
        if (isMounted) {
          setStatus(data);
          // Notify parent component of status update
          if (onStatusUpdate) {
            onStatusUpdate(data);
          }
          // Stop polling if completed or failed
          if (data.stage === 'completed' || data.stage === 'failed') {
            console.log('[StatusTracker] Job completed/failed, stopping polling');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('[StatusTracker] Status polling error:', error);
      }
    }, 2000);

    // Initial poll immediately
    (async () => {
      try {
        console.log('[StatusTracker] Initial poll for jobId:', jobId);
        const response = await fetch(`/api/status/${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch status');
        const data: ProcessStatus = await response.json();
        console.log('[StatusTracker] Initial status received:', data);
        if (isMounted) {
          setStatus(data);
          if (onStatusUpdate) {
            onStatusUpdate(data);
          }
        }
      } catch (error) {
        console.error('[StatusTracker] Initial polling error:', error);
      }
    })();

    return () => {
      console.log('[StatusTracker] Cleanup - stopping polling');
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [jobId, onStatusUpdate]);

  // Track elapsed time
  useEffect(() => {
    if (!status || status.stage === 'completed' || status.stage === 'failed') {
      return;
    }

    const startTime = status.startTime || Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Show loading state while waiting for jobId or fetching initial status
  if (!jobId || !status) {
    // Only show if we're actively loading, otherwise hide
    if (!isLoading && !jobId) {
      return null;
    }
    
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Generation Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-sm">Initializing...</span>
              <p className="text-xs text-muted-foreground mt-0.5">Starting document generation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stageInfo = STAGE_CONFIG[status.stage];
  const Icon = stageInfo.icon;
  const isActive = status.stage !== 'completed' && status.stage !== 'failed';

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generation Progress</CardTitle>
          {isActive && onCancel && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Stage Badge */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${stageInfo.bgColor}`}>
            <Icon className={`w-5 h-5 ${stageInfo.color} ${isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{stageInfo.label}</span>
              <Badge variant={status.stage === 'completed' ? 'default' : 'secondary'} className="rounded-xl text-xs">
                {status.progress}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{status.message}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
        <div className="relative w-32 h-32 mx-auto mb-6">
  {/* Background circle */}
  <svg className="transform -rotate-90 w-32 h-32">
    <circle
      cx="64"
      cy="64"
      r="56"
      stroke="currentColor"
      strokeWidth="8"
      fill="none"
      className="text-gray-200"
    />
    {/* Animated progress circle */}
    <circle
      cx="64"
      cy="64"
      r="56"
      stroke="url(#gradient)"
      strokeWidth="8"
      fill="none"
      strokeDasharray={`${2 * Math.PI * 56}`}
      strokeDashoffset={`${2 * Math.PI * 56 * (1 - (status.progress || 0) / 100)}`}
      className="transition-all duration-500 ease-out"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#667eea" />
        <stop offset="100%" stopColor="#764ba2" />
      </linearGradient>
    </defs>
  </svg>
  
  {/* Center content */}
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
      {status.progress}%
    </span>
    <span className="text-xs text-gray-500 mt-1">{status.stage}</span>
  </div>
</div>
            {status.completedSteps !== undefined && status.totalSteps && (
            <p className="text-xs text-muted-foreground text-center">
              Step {status.completedSteps} of {status.totalSteps}
              {status.currentStep && `: ${status.currentStep}`}
            </p>
          )}
        </div>

        {/* Time Information */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Elapsed: {formatTime(elapsedTime)}</span>
          </div>
          {status.estimatedTimeRemaining !== undefined && isActive && (
            <div className="flex items-center gap-1.5">
              <span>Remaining: ~{formatTime(status.estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>

        {/* Detailed Status Messages */}
        {status.details && status.details.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Recent Activity:</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {status.details.slice(-5).map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {status.stage === 'failed' && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Generation Failed</p>
              <p className="text-xs text-red-700 mt-1">{status.message}</p>
            </div>
          </div>
        )}

        {/* Job ID */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Job ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{jobId.slice(0, 12)}...</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Alternative: SSE (Server-Sent Events) version for real-time updates
export function StatusTrackerSSE({ jobId, isLoading, onCancel, onStatusUpdate }: StatusTrackerProps) {
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Listen to SSE for real-time status updates
  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    const eventSource = new EventSource(`/api/status/${jobId}/stream`);

    eventSource.onmessage = (event) => {
      const data: ProcessStatus = JSON.parse(event.data);
      setStatus(data);
      
      // Notify parent component of status update
      if (onStatusUpdate) {
        onStatusUpdate(data);
      }
      
      // Close connection if completed or failed
      if (data.stage === 'completed' || data.stage === 'failed') {
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  // Track elapsed time
  useEffect(() => {
    if (!status || status.stage === 'completed' || status.stage === 'failed') {
      return;
    }

    const startTime = status.startTime || Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Rest of the render logic is the same as StatusTracker above
  // Show loading state while waiting for jobId or fetching initial status
  if (!jobId || !status) {
    // Only show if we're actively loading, otherwise hide
    if (!isLoading && !jobId) {
      return null;
    }
    
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Generation Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-sm">Initializing...</span>
              <p className="text-xs text-muted-foreground mt-0.5">Starting document generation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stageInfo = STAGE_CONFIG[status.stage];
  const Icon = stageInfo.icon;
  const isActive = status.stage !== 'completed' && status.stage !== 'failed';

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generation Progress</CardTitle>
          {isActive && onCancel && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${stageInfo.bgColor}`}>
            <Icon className={`w-5 h-5 ${stageInfo.color} ${isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{stageInfo.label}</span>
              <Badge variant={status.stage === 'completed' ? 'default' : 'secondary'} className="rounded-xl text-xs">
                {status.progress}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{status.message}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={status.progress} className="h-2" />
          {status.completedSteps !== undefined && status.totalSteps && (
            <p className="text-xs text-muted-foreground text-center">
              Step {status.completedSteps} of {status.totalSteps}
              {status.currentStep && `: ${status.currentStep}`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Elapsed: {formatTime(elapsedTime)}</span>
          </div>
          {status.estimatedTimeRemaining !== undefined && isActive && (
            <div className="flex items-center gap-1.5">
              <span>Remaining: ~{formatTime(status.estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>

        {status.details && status.details.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Recent Activity:</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {status.details.slice(-5).map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status.stage === 'failed' && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Generation Failed</p>
              <p className="text-xs text-red-700 mt-1">{status.message}</p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Job ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{jobId.slice(0, 12)}...</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

