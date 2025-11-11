"""
Example backend API endpoints for task-based workflow system
Integrate this with your existing Flask backend (server_redis.py)
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import redis
import json
import time
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app)

# Redis connection (same as your existing setup)
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)

# Task storage: workflow_id -> list of tasks
workflows: Dict[str, Dict] = {}


def parse_log_line(line: str) -> Optional[Dict]:
    """
    Parse a log line to extract task information
    Example: "2025-11-05 13:06:05 - TopicSentenceTask - INFO - ✓ Task completed (1:0.80): The urgent need..."
    """
    try:
        parts = line.split(' - ')
        if len(parts) < 4:
            return None
        
        timestamp = parts[0]
        task_name = parts[1].strip()
        level = parts[2].strip()
        message = ' - '.join(parts[3:]).strip()
        
        # Extract status and score
        status = 'pending'
        score = None
        output = None
        
        if 'Task completed' in message:
            status = 'completed'
            # Extract score from (1:0.80) format
            import re
            score_match = re.search(r'\((\d+):([\d.]+)\)', message)
            if score_match:
                score = float(score_match.group(2))
            # Extract output text after colon
            if ':' in message:
                output = message.split(':', 1)[1].strip()
        elif 'Task started' in message or 'INFO' in level:
            status = 'running'
        
        return {
            'name': task_name,
            'timestamp': timestamp,
            'status': status,
            'score': score,
            'output': output,
            'message': message
        }
    except Exception as e:
        print(f"Error parsing log line: {e}")
        return None


def create_task_from_log(log_data: Dict, parent_id: Optional[str] = None) -> Dict:
    """Create a task object from parsed log data"""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    
    return {
        'id': task_id,
        'name': log_data['name'],
        'type': log_data['name'].replace('Task', '').lower(),
        'status': log_data['status'],
        'score': log_data.get('score'),
        'output': log_data.get('output'),
        'startTime': log_data.get('timestamp'),
        'endTime': log_data.get('timestamp') if log_data['status'] == 'completed' else None,
        'children': [],
        'parentId': parent_id
    }


@app.route('/api/workflow/generate', methods=['POST'])
def generate_workflow():
    """Start a new workflow generation"""
    data = request.json
    workflow_id = f"workflow_{uuid.uuid4().hex[:12]}"
    job_id = f"job_{int(time.time() * 1000)}"
    
    # Initialize workflow
    workflow = {
        'workflowId': workflow_id,
        'jobId': job_id,
        'status': 'running',
        'overallProgress': 0,
        'tasks': [],
        'statistics': {
            'total': 0,
            'completed': 0,
            'failed': 0,
            'running': 0,
            'pending': 0,
            'averageScore': 0,
            'estimatedTimeRemaining': 0
        },
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat()
    }
    
    workflows[workflow_id] = workflow
    
    # Start background task processing
    thread = threading.Thread(
        target=process_workflow,
        args=(workflow_id, data),
        daemon=True
    )
    thread.start()
    
    return jsonify({
        'jobId': job_id,
        'workflowId': workflow_id,
        'estimatedTasks': 15  # Estimate based on your workflow
    }), 201


@app.route('/api/workflow/<workflow_id>/tasks', methods=['GET'])
def get_workflow_tasks(workflow_id: str):
    """Get current workflow status and tasks"""
    if workflow_id not in workflows:
        return jsonify({'error': 'Workflow not found'}), 404
    
    workflow = workflows[workflow_id]
    
    # Recalculate statistics
    all_tasks = flatten_tasks(workflow['tasks'])
    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if t['status'] == 'completed')
    failed = sum(1 for t in all_tasks if t['status'] == 'failed')
    running = sum(1 for t in all_tasks if t['status'] == 'running')
    pending = sum(1 for t in all_tasks if t['status'] == 'pending')
    
    scores = [t['score'] for t in all_tasks if t.get('score') is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    workflow['statistics'] = {
        'total': total,
        'completed': completed,
        'failed': failed,
        'running': running,
        'pending': pending,
        'averageScore': avg_score,
        'estimatedTimeRemaining': 0
    }
    
    workflow['overallProgress'] = (completed / total * 100) if total > 0 else 0
    workflow['status'] = 'completed' if completed == total and total > 0 else ('failed' if failed > 0 else 'running')
    workflow['updatedAt'] = datetime.now().isoformat()
    
    return jsonify(workflow)


@app.route('/api/workflow/<workflow_id>/stream', methods=['GET'])
def stream_workflow_updates(workflow_id: str):
    """Server-Sent Events stream for real-time task updates"""
    if workflow_id not in workflows:
        return jsonify({'error': 'Workflow not found'}), 404
    
    def generate():
        last_task_count = 0
        
        while True:
            if workflow_id not in workflows:
                break
            
            workflow = workflows[workflow_id]
            current_tasks = flatten_tasks(workflow['tasks'])
            current_count = len(current_tasks)
            
            # Send updates for new tasks
            if current_count > last_task_count:
                new_tasks = current_tasks[last_task_count:]
                for task in new_tasks:
                    yield f"event: task_update\ndata: {json.dumps(task)}\n\n"
                last_task_count = current_count
            
            # Send updates for status changes
            for task in current_tasks:
                if task['status'] == 'completed' and task.get('score') is not None:
                    yield f"event: task_complete\ndata: {json.dumps({'taskId': task['id'], 'status': 'completed', 'score': task['score'], 'output': task.get('output')})}\n\n"
            
            # Check if workflow is complete
            if workflow['status'] == 'completed':
                yield f"event: workflow_complete\ndata: {json.dumps({'workflowId': workflow_id})}\n\n"
                break
            
            time.sleep(1)  # Poll every second
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'  # Disable buffering for nginx
        }
    )


def flatten_tasks(tasks: List[Dict], parent: Optional[Dict] = None) -> List[Dict]:
    """Flatten hierarchical task structure"""
    result = []
    for task in tasks:
        if parent:
            task['parentId'] = parent['id']
        result.append(task)
        if task.get('children'):
            result.extend(flatten_tasks(task['children'], task))
    return result


def process_workflow(workflow_id: str, request_data: Dict):
    """
    Background task processor
    This should integrate with your existing log parsing system
    """
    # Example: Parse logs and create tasks
    # In reality, you'd connect to your actual workflow execution system
    
    # Simulate task creation from logs
    sample_logs = [
        "2025-11-05 13:06:05 - WorldVisionTopicDeterminationTask - INFO - ✓ Task completed (1): Keys: ['primary_trend', ...]",
        "2025-11-05 13:06:05 - CreateWorldVisionSectionTask - INFO - ✓ World Vision topic determined",
        "2025-11-05 13:06:56 - TopicSentenceTask - INFO - ✓ Task completed (1:0.80): The urgent need for sustainable data storage...",
        "2025-11-05 13:07:43 - SupportingSentenceTask - INFO - ✓ Task completed (1:0.70): As the reliance on cloud services...",
    ]
    
    workflow = workflows[workflow_id]
    
    # Create parent task
    parent_task = {
        'id': 'task_world_vision',
        'name': 'CreateWorldVisionSectionTask',
        'type': 'section_creation',
        'status': 'running',
        'children': [],
        'startTime': datetime.now().isoformat()
    }
    
    workflow['tasks'].append(parent_task)
    
    # Process logs and create child tasks
    for log_line in sample_logs:
        log_data = parse_log_line(log_line)
        if log_data:
            task = create_task_from_log(log_data, parent_task['id'])
            parent_task['children'].append(task)
            
            # Update workflow
            workflows[workflow_id] = workflow
            
            # Simulate processing time
            time.sleep(2)
    
    # Mark parent as complete
    parent_task['status'] = 'completed'
    parent_task['endTime'] = datetime.now().isoformat()


if __name__ == '__main__':
    app.run(port=3001, debug=True)

