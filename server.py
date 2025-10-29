"""
Simple Backend Server for Document Generator (Python/Flask)
Run with: python server.py
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import time
import threading
import json
from datetime import datetime
import random
import string

app = Flask(__name__)
CORS(app)

# In-memory store for job statuses
job_statuses = {}

# Configuration
PORT = 3001


def log_request(method, url, body=None):
    """Log incoming requests"""
    print(f"[Backend] {method} {url} - Body: {body}")


@app.before_request
def before_request():
    """Log all incoming requests"""
    if request.is_json:
        log_request(request.method, request.url, request.get_json())
    else:
        log_request(request.method, request.url)


@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """
    GET /api/status/:jobId
    Returns current status of a job
    """
    status = job_statuses.get(job_id)
    
    if not status:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(status)


@app.route('/api/status/<job_id>/stream', methods=['GET'])
def stream_status(job_id):
    """
    GET /api/status/:jobId/stream
    Server-Sent Events endpoint for real-time updates
    """
    def generate():
        status = job_statuses.get(job_id)
        
        if not status:
            yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
            return
        
        # Send initial status
        yield f"data: {json.dumps(status)}\n\n"
        
        # Send updates every second
        while True:
            time.sleep(1)
            
            current_status = job_statuses.get(job_id)
            
            if not current_status:
                break
            
            yield f"data: {json.dumps(current_status)}\n\n"
            
            # Close if completed or failed
            if current_status.get('stage') in ['completed', 'failed']:
                break
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )


@app.route('/api/generate', methods=['POST'])
def generate_document():
    """
    POST /api/generate
    Starts document generation
    """
    print('[Backend] /api/generate called with body:', request.json)
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        print('[Backend] Error: No prompt provided')
        return jsonify({'error': 'Prompt is required'}), 400
    
    # Generate unique job ID
    job_id = f"job_{int(time.time() * 1000)}_{generate_random_string(9)}"
    print(f'[Backend] Created jobId: {job_id}')
    
    # Initialize job
    job_statuses[job_id] = {
        'jobId': job_id,
        'stage': 'initializing',
        'progress': 0,
        'message': 'Starting document generation...',
        'startTime': int(time.time() * 1000),
        'estimatedTimeRemaining': 1800,  # 30 minutes
        'currentStep': 'Initializing',
        'totalSteps': 5,
        'completedSteps': 0,
        'details': ['Job created', 'Validating prompt']
    }
    
    print('[Backend] Job initialized in job_statuses')
    
    # Start processing in background
    print('[Backend] Starting background processing...')
    thread = threading.Thread(target=process_document_generation, args=(job_id, prompt))
    thread.daemon = True
    thread.start()
    
    print('[Backend] Sending response...')
    response = {
        'jobId': job_id,
        'message': 'Generation started',
        'docHtml': '<p>Processing...</p>',
        'statusUrl': f'/api/status/{job_id}'
    }
    print('[Backend] Response sent successfully')
    
    return jsonify(response)


@app.route('/api/refine', methods=['POST'])
def refine_document():
    """
    POST /api/refine
    Refines existing document or selection
    """
    data = request.get_json()
    existing_job_id = data.get('jobId')
    prompt = data.get('prompt')
    selection_html = data.get('selectionHtml')
    full_doc_html = data.get('fullDocHtml')
    
    job_id = existing_job_id or f"job_{int(time.time() * 1000)}_{generate_random_string(9)}"
    
    # Initialize refinement job
    job_statuses[job_id] = {
        'jobId': job_id,
        'stage': 'analyzing',
        'progress': 5,
        'message': 'Analyzing content for refinement...',
        'startTime': int(time.time() * 1000),
        'estimatedTimeRemaining': 900,  # 15 minutes
        'currentStep': 'Analyzing',
        'totalSteps': 4,
        'completedSteps': 0,
        'details': ['Refinement started', 'Analyzing existing content']
    }
    
    # Start refinement process in background
    thread = threading.Thread(
        target=process_refinement, 
        args=(job_id, prompt, selection_html, full_doc_html)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'jobId': job_id,
        'message': 'Refinement started',
        'docHtml': full_doc_html or '<p>Processing...</p>',
        'statusUrl': f'/api/status/{job_id}'
    })


@app.route('/api/export', methods=['POST'])
def export_document():
    """
    POST /api/export
    Exports document to PDF
    """
    data = request.get_json()
    job_id = data.get('jobId')
    full_doc_html = data.get('fullDocHtml')
    
    # Simulate PDF generation (in real app, use reportlab, weasyprint, etc.)
    time.sleep(1)
    
    pdf_url = f"/api/pdf/{job_id or int(time.time() * 1000)}"
    return jsonify({'pdfUrl': pdf_url})


@app.route('/api/pdf/<pdf_id>', methods=['GET'])
def serve_pdf(pdf_id):
    """
    GET /api/pdf/:pdfId
    Serves generated PDF file (mock implementation)
    
    In production, this would:
    1. Generate actual PDF from HTML using libraries like weasyprint, pdfkit, or reportlab
    2. Store PDF in file system or object storage (S3, etc.)
    3. Return the PDF file with proper headers
    
    For now, we return a simple HTML page as demonstration
    """
    # Mock PDF content as HTML (in production, generate real PDF)
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Document PDF - {pdf_id}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
            }}
            .header {{
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            .content {{
                margin: 20px 0;
            }}
            .footer {{
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #ccc;
                text-align: center;
                color: #666;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Generated Document</h1>
            <p>Document ID: {pdf_id}</p>
            <p style="color: #666; font-style: italic;">
                Note: This is a mock PDF. In production, integrate a PDF generation library.
            </p>
        </div>
        
        <div class="content">
            <h2>Your Document Content</h2>
            <p>
                This is a demonstration of the PDF export feature. 
                In a production environment, you would integrate a proper PDF generation library such as:
            </p>
            <ul>
                <li><strong>weasyprint</strong>: pip install weasyprint</li>
                <li><strong>pdfkit</strong>: pip install pdfkit (requires wkhtmltopdf)</li>
                <li><strong>reportlab</strong>: pip install reportlab</li>
                <li><strong>xhtml2pdf</strong>: pip install xhtml2pdf</li>
            </ul>
            
            <h3>Implementation Example (weasyprint):</h3>
            <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">
from weasyprint import HTML
import io

def generate_pdf(html_content):
    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes
            </pre>
            
            <h3>How to use this endpoint:</h3>
            <ol>
                <li>Frontend calls POST /api/export with document HTML</li>
                <li>Backend generates PDF and returns URL</li>
                <li>Frontend opens URL in new tab</li>
                <li>This endpoint serves the actual PDF file</li>
            </ol>
        </div>
        
        <div class="footer">
            <p>Generated by AI Document Generator</p>
            <p>Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <script>
            // Auto print dialog (optional)
            // window.onload = () => window.print();
        </script>
    </body>
    </html>
    """
    
    # Return HTML content (in production, return actual PDF with application/pdf content-type)
    return html_content, 200, {
        'Content-Type': 'text/html',
        # For actual PDF, use these headers:
        # 'Content-Type': 'application/pdf',
        # 'Content-Disposition': f'inline; filename="document_{pdf_id}.pdf"'
    }


@app.route('/api/cancel/<job_id>', methods=['POST'])
def cancel_job(job_id):
    """
    POST /api/cancel/:jobId
    Cancels a running job
    """
    status = job_statuses.get(job_id)
    
    if not status:
        return jsonify({'error': 'Job not found'}), 404
    
    if status.get('stage') in ['completed', 'failed']:
        return jsonify({'message': 'Job already completed'})
    
    # Update status to cancelled
    status['stage'] = 'failed'
    status['message'] = 'Job cancelled by user'
    status['estimatedTimeRemaining'] = 0
    job_statuses[job_id] = status
    
    return jsonify({'message': 'Job cancelled successfully'})


def generate_random_string(length):
    """Generate random alphanumeric string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def process_document_generation(job_id, prompt):
    """
    Simulates long-running document generation
    """
    print(f'[Backend] process_document_generation started for jobId: {job_id}')
    
    stages = [
        {
            'stage': 'analyzing',
            'progress': 10,
            'duration': 300,  # 5 minutes (simulated as 5 seconds for demo)
            'message': 'Analyzing prompt and gathering context...',
            'step': 'Analyzing input',
            'details': ['Parsing prompt structure', 'Identifying key topics', 'Determining document structure']
        },
        {
            'stage': 'generating',
            'progress': 40,
            'duration': 900,  # 15 minutes (simulated as 15 seconds for demo)
            'message': 'Generating document content...',
            'step': 'Content generation',
            'details': ['Creating outline', 'Generating introduction', 'Writing main sections', 'Adding supporting details']
        },
        {
            'stage': 'formatting',
            'progress': 75,
            'duration': 480,  # 8 minutes (simulated as 8 seconds for demo)
            'message': 'Formatting and styling document...',
            'step': 'Formatting',
            'details': ['Applying styles', 'Formatting headings', 'Adding spacing and layout']
        },
        {
            'stage': 'finalizing',
            'progress': 90,
            'duration': 120,  # 2 minutes (simulated as 2 seconds for demo)
            'message': 'Finalizing document and generating PDF...',
            'step': 'Finalizing',
            'details': ['Quality checks', 'Generating PDF', 'Creating preview']
        }
    ]
    
    start_time = time.time() * 1000
    completed_steps = 1
    
    # Demo mode: divide durations by 60 for faster testing
    DEMO_MODE = True
    speed_multiplier = 60 if DEMO_MODE else 1
    
    for i, stage_info in enumerate(stages):
        print(f'[Backend] Processing stage {i}: {stage_info["stage"]}')
        status = job_statuses.get(job_id)
        
        if not status or status.get('stage') == 'failed':
            print('[Backend] Stopping - status missing or failed')
            break
        
        elapsed_time = time.time() * 1000 - start_time
        total_duration = sum(s['duration'] * 1000 / speed_multiplier for s in stages)
        remaining_time = max(0, int((total_duration - elapsed_time) / 1000))
        
        current_details = status.get('details', [])
        status.update({
            'stage': stage_info['stage'],
            'progress': stage_info['progress'],
            'message': stage_info['message'],
            'currentStep': stage_info['step'],
            'completedSteps': completed_steps,
            'estimatedTimeRemaining': remaining_time,
            'details': current_details + stage_info['details']
        })
        job_statuses[job_id] = status
        completed_steps += 1
        
        print(f'[Backend] Updated status to stage: {stage_info["stage"]}, progress: {stage_info["progress"]}%')
        
        # Simulate stage duration with progressive updates
        update_interval = 2000 / speed_multiplier  # Update every 2 seconds (or faster in demo)
        updates = int((stage_info['duration'] * 1000 / speed_multiplier) / update_interval)
        
        for j in range(updates):
            time.sleep(update_interval / 1000)
            
            current_status = job_statuses.get(job_id)
            if not current_status or current_status.get('stage') == 'failed':
                break
            
            next_stage_progress = stages[i + 1]['progress'] if i + 1 < len(stages) else 100
            stage_progress_range = next_stage_progress - stage_info['progress']
            progress_increment = (stage_progress_range / updates) * (j + 1)
            
            new_elapsed_time = time.time() * 1000 - start_time
            new_remaining_time = max(0, int((total_duration - new_elapsed_time) / 1000))
            
            current_status['progress'] = min(
                next_stage_progress - 1,
                int(stage_info['progress'] + progress_increment)
            )
            current_status['estimatedTimeRemaining'] = new_remaining_time
            job_statuses[job_id] = current_status
    
    # Mark as completed
    print(f'[Backend] Marking job as completed for jobId: {job_id}')
    final_status = job_statuses.get(job_id)
    
    if final_status and final_status.get('stage') != 'failed':
        final_details = final_status.get('details', [])
        final_status.update({
            'stage': 'completed',
            'progress': 100,
            'message': 'Document generation completed successfully!',
            'completedSteps': 5,
            'estimatedTimeRemaining': 0,
            'details': final_details + ['Generation complete'],
            'docHtml': generate_mock_document(prompt),
            'pdfUrl': f'/api/pdf/{job_id}'
        })
        job_statuses[job_id] = final_status
        print(f'[Backend] Job completed successfully: {job_id}')


def process_refinement(job_id, prompt, selection_html, full_doc_html):
    """
    Simulates refinement process (shorter than full generation)
    """
    stages = [
        {'stage': 'analyzing', 'progress': 20, 'duration': 3, 'message': 'Analyzing content...'},
        {'stage': 'generating', 'progress': 60, 'duration': 7, 'message': 'Refining content...'},
        {'stage': 'finalizing', 'progress': 95, 'duration': 2, 'message': 'Finalizing changes...'}
    ]
    
    start_time = time.time()
    
    for stage_info in stages:
        status = job_statuses.get(job_id)
        if not status or status.get('stage') == 'failed':
            break
        
        status.update({
            'stage': stage_info['stage'],
            'progress': stage_info['progress'],
            'message': stage_info['message'],
            'estimatedTimeRemaining': max(0, 12 - int(time.time() - start_time))
        })
        job_statuses[job_id] = status
        
        time.sleep(stage_info['duration'])
    
    final_status = job_statuses.get(job_id)
    if final_status and final_status.get('stage') != 'failed':
        refined_html = (full_doc_html + '<p>Refined content added.</p>') if full_doc_html else '<p>Refined content</p>'
        final_status.update({
            'stage': 'completed',
            'progress': 100,
            'message': 'Refinement completed!',
            'estimatedTimeRemaining': 0,
            'docHtml': refined_html
        })
        job_statuses[job_id] = final_status


def generate_mock_document(prompt):
    """
    Generates mock HTML document
    """
    return f"""
    <h1>Generated Document</h1>
    <p><strong>Based on prompt:</strong> {prompt}</p>
    <h2>Introduction</h2>
    <p>This is a sample document generated based on your prompt. In a real implementation, this would be generated by your LLM.</p>
    <h2>Main Content</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <ul>
      <li>First key point</li>
      <li>Second key point</li>
      <li>Third key point</li>
    </ul>
    <h2>Conclusion</h2>
    <p>This concludes the generated document. You can edit this content using the TipTap editor.</p>
  """


def cleanup_old_jobs():
    """
    Cleanup old jobs periodically
    """
    while True:
        time.sleep(300)  # Every 5 minutes
        now = time.time() * 1000
        TWO_HOURS = 2 * 60 * 60 * 1000
        
        job_ids_to_delete = [
            job_id for job_id, status in job_statuses.items()
            if now - status.get('startTime', now) > TWO_HOURS
        ]
        
        for job_id in job_ids_to_delete:
            del job_statuses[job_id]


if __name__ == '__main__':
    # Start cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_old_jobs)
    cleanup_thread.daemon = True
    cleanup_thread.start()
    
    # Print startup information
    print(f'\n✅ Backend server running on http://localhost:{PORT}')
    print('📊 API endpoints available:')
    print(f'   GET    http://localhost:{PORT}/api/health')
    print(f'   POST   http://localhost:{PORT}/api/generate')
    print(f'   POST   http://localhost:{PORT}/api/refine')
    print(f'   POST   http://localhost:{PORT}/api/export')
    print(f'   GET    http://localhost:{PORT}/api/pdf/:pdfId')
    print(f'   GET    http://localhost:{PORT}/api/status/:jobId')
    print(f'   GET    http://localhost:{PORT}/api/status/:jobId/stream')
    print(f'   POST   http://localhost:{PORT}/api/cancel/:jobId')
    print('\n🚀 Start your frontend with: npm run dev\n')
    
    # Start Flask server
    app.run(host='0.0.0.0', port=PORT, debug=True, threaded=True)

