import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
// NOTE: Some CDN/preview ESM builds of @tiptap/react don’t re-export BubbleMenu.
// To avoid build errors here, we omit the React <BubbleMenu> wrapper.
// If you install locally via npm (recommended), you can re-add it.
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, FileDown, Wand2, Play, Link as LinkIcon, Heading1, Heading2, Heading3, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Undo2, Redo2, CheckCircle2, Clock, FileText, Sparkles, FileCheck, Download } from "lucide-react";
import { StatusTracker, type ProcessStatus } from "@/components/StatusTracker";
// NOTE: In some preview/CDN environments, lucide-react icons must match their exact export names.
// The Link icon export is `Link`, not `LinkIcon`. We alias it below to avoid collision with TipTap's Link extension.

/**
 * LLM PDF Doc Composer – React + TipTap
 * ---------------------------------------------------------------
 * Drop this component into your React app (Vite/Next.js). It provides:
 * - A prompt box to ask your backend to generate/update a document via LLM
 * - A TipTap editor to preview & edit the document
 * - Buttons to: Generate, Refine selected text, Update doc from editor, and Download latest PDF
 * - Real-time status tracking with progress indicators
 *
 * Backend expectations (adjust endpoints/shape as needed):
 * 1) POST /api/generate
 *    body: { prompt: string }
 *    returns: { jobId: string, docHtml: string, pdfUrl?: string }
 *
 * 2) POST /api/refine
 *    body: { jobId?: string, prompt: string, selectionHtml?: string, fullDocHtml?: string }
 *    returns: { jobId: string, docHtml: string, pdfUrl?: string }
 *
 * 3) POST /api/export
 *    body: { jobId?: string, fullDocHtml: string }
 *    returns: { pdfUrl: string }
 *
 * If your API returns TipTap JSON instead of HTML, update setContent logic accordingly.
 */

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

function Toolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const Btn = ({ active, onClick, children, title }: any) => (
    <Button variant={active ? "default" : "secondary"} className="h-8 px-2 text-sm rounded-xl" onClick={onClick} title={title}>{children}</Button>
  );

  return (
    <div className="flex flex-wrap gap-2 items-center p-2 bg-muted/40 rounded-2xl border">
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="w-4 h-4" /></Btn>
      <div className="w-px h-6 bg-border mx-1" />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="w-4 h-4" /></Btn>
      <div className="w-px h-6 bg-border mx-1" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List"><List className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List"><ListOrdered className="w-4 h-4" /></Btn>
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="w-4 h-4" /></Btn>
      <div className="w-px h-6 bg-border mx-1" />
      <Btn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 className="w-4 h-4" /></Btn>
      <Btn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 className="w-4 h-4" /></Btn>
      <div className="w-px h-6 bg-border mx-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-8 px-2 text-sm rounded-xl"><LinkIcon className="w-4 h-4 mr-1" />Link</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Set / Remove Link</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => {
            const url = window.prompt("Enter URL");
            if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}>Set link</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().unsetLink().run()}>Remove link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Bubble menu omitted for CDN compatibility. If you install via npm and your bundler supports it,
// you can re-introduce:
//   import { BubbleMenu } from "@tiptap/react"
//   <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}> ... </BubbleMenu>

export default function DocComposer() {
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"] }),
      Placeholder.configure({ placeholder: "Your document will appear here. You can freely edit before exporting to PDF…" }),
      CharacterCount.configure({ limit: 200000 }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-neutral dark:prose-invert max-w-none min-h-[420px] focus:outline-none",
      },
    },
    content: "",
    autofocus: true,
  });

  const selectionHtml = useCallback(() => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    if (from === to) return "";
    // Get selected HTML content
    const selectedContent = editor.state.doc.textBetween(from, to);
    return selectedContent || "";
  }, [editor]);

  // Handle status updates from StatusTracker
  const handleStatusUpdate = useCallback((status: ProcessStatus) => {
    if (status.stage === 'completed') {
      // When generation is complete, update the editor with the final document
      if (status.docHtml && editor) {
        editor.commands.setContent(status.docHtml);
        toast.success("Document generated successfully! 🎉");
      }
      // Stop the loading states
      setIsGenerating(false);
      setIsRefining(false);
    } else if (status.stage === 'failed') {
      // Stop loading on failure
      setIsGenerating(false);
      setIsRefining(false);
      toast.error(status.message || "Generation failed");
    }
  }, [editor]);

  // Generate a fresh document from a prompt
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt first.");
      return;
    }
    console.log('[App] Starting generation with prompt:', prompt);
    setIsGenerating(true);
    try {
      console.log('[App] Calling /api/generate...');
      const data = await apiFetch<{ jobId: string; docHtml: string; pdfUrl?: string }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      console.log('[App] Received response from /api/generate:', data);
      console.log('[App] Setting jobId to:', data.jobId);
      setJobId(data.jobId);
      editor?.commands.setContent(data.docHtml || "");
      toast.success("Draft generation started");
    } catch (e: any) {
      console.error('[App] Generation error:', e);
      toast.error(e.message || "Generation failed");
      setIsGenerating(false);
    }
  }, [prompt, editor]);

  // Refine either the selected text or the whole document using a prompt
  const handleRefine = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Add a refinement instruction in the prompt box.");
      return;
    }
    if (!editor) return;
    setIsRefining(true);
    try {
      const selHtml = selectionHtml();
      const fullDocHtml = editor.getHTML();
      const data = await apiFetch<{ jobId: string; docHtml: string; pdfUrl?: string }>("/api/refine", {
        method: "POST",
        body: JSON.stringify({ jobId, prompt, selectionHtml: selHtml || undefined, fullDocHtml }),
      });
      setJobId(data.jobId);
      editor.commands.setContent(data.docHtml || fullDocHtml);
      toast.success(selHtml ? "Selection refinement started" : "Document refinement started");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Refine failed");
      setIsRefining(false);
    }
  }, [prompt, editor, jobId, selectionHtml]);

  // Export current editor HTML to PDF via backend
  const handleExport = useCallback(async () => {
    if (!editor) return;
    setIsExporting(true);
    try {
      const fullDocHtml = editor.getHTML();
      const data = await apiFetch<{ pdfUrl: string }>("/api/export", {
        method: "POST",
        body: JSON.stringify({ jobId, fullDocHtml }),
      });
      
      // Construct full backend URL (window.open doesn't use Vite proxy)
      // The Vite proxy target is the backend (load balancer on port 80 or direct backend on 3001)
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:80';
      const fullPdfUrl = data.pdfUrl.startsWith('http') 
        ? data.pdfUrl 
        : `${backendUrl}${data.pdfUrl}`;
      
      // Open PDF in new tab
      window.open(fullPdfUrl, '_blank');
      toast.success("PDF exported and opened in new tab");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [editor, jobId]);

  const hasSelection = !!editor?.state && editor.state.selection.from !== editor.state.selection.to;

  return (
    <div className="app-shell app-shell-bg">
      {/* Fallback layout (works even if Tailwind is not configured). */}
      <style>{`
        /* Viewport-optimized layout */
        .app-shell {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Header section - compact */
        .hero-header {
          flex-shrink: 0;
          margin-bottom: 1rem;
        }

        /* Main content grid - uses remaining space */
        .doc-grid { 
          display: flex;
          gap: 24px;
          flex: 1;
          min-height: 0; /* Important for flex children to respect max-height */
          overflow: hidden;
        }

        /* Left column - scrollable */
        .doc-left { 
          flex: 0 0 380px;
          max-width: 380px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 8px;
        }

        /* Right column - fills remaining space */
        .doc-right { 
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Make prompt card compact */
        .prompt-card {
          flex-shrink: 0;
        }

        /* Status card - scrollable if needed */
        .status-card {
          flex-shrink: 0;
          max-height: calc(100vh - 500px);
          overflow-y: auto;
        }

        /* Mobile responsive */
        @media (max-width: 980px) { 
          .doc-grid {
            flex-direction: column;
          }
          .doc-left, .doc-right { 
            max-width: 100%;
            flex: none;
          }
          .doc-left {
            max-height: 40vh;
          }
          .doc-right {
            max-height: 50vh;
          }
        }

        /* Custom scrollbar */
        .doc-left::-webkit-scrollbar,
        .status-card::-webkit-scrollbar,
        .editor-scrollable::-webkit-scrollbar {
          width: 6px;
        }
        .doc-left::-webkit-scrollbar-track,
        .status-card::-webkit-scrollbar-track,
        .editor-scrollable::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 10px;
        }
        .doc-left::-webkit-scrollbar-thumb,
        .status-card::-webkit-scrollbar-thumb,
        .editor-scrollable::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .doc-left::-webkit-scrollbar-thumb:hover,
        .status-card::-webkit-scrollbar-thumb:hover,
        .editor-scrollable::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* App polish */
        .app-shell-bg {
          background: #fafafa;
          background-image: 
            radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.03), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.03), transparent 50%);
          padding: 1rem;
        }
.panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.1),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
   .panel:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  }

       .panel .card-header { padding: 14px 16px 0 16px; }
        .panel .card-content { padding: 12px 16px 16px 16px; }
        .panel h2, .panel .title { font-size: 16px; font-weight: 600; color: #111827; margin: 0; }

        /* Controls */
        .textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 12px; font-size: 14px; background: #fff; }
        .textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }

        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; border: 1px solid transparent; padding: 8px 12px; font-size: 14px; cursor: pointer; transition: all .15s ease; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .btn.primary { background: #111827; color: #fff; }
        .btn.primary:hover { background: #0f172a; }
        .btn.secondary { background: #f3f4f6; color: #111827; border-color: #e5e7eb; }
        .btn.secondary:hover { background: #e5e7eb; }
        .btn.outline { background: #fff; color: #111827; border-color: #d1d5db; }
        .btn.outline:hover { border-color: #9ca3af; }
        .btn.sm { padding: 6px 10px; font-size: 13px; }

         /* Enhanced typography */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  /* Smooth animations */
  * {
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Enhanced buttons */
  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:hover {
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    transform: translateY(-1px);
  }

  /* Loading animation */
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }

  .shimmer {
    background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 20%, #f0f0f0 40%, #f0f0f0 100%);
    background-size: 1000px 100%;
    animation: shimmer 2s linear infinite;
  }

  /* Enhanced progress bar */
  .progress-bar {
    height: 8px;
    border-radius: 9999px;
    background: #e5e7eb;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.5s ease;
    border-radius: 9999px;
  }

        /* Toolbar */
        .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: 1px solid #e5e7eb; border-radius: 14px; background: #f9fafb; }

        /* Editor - fills available space */
        .editor-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .editor-scrollable {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .editor-frame { 
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 12px;
          background: #fff;
          height: 100%;
          min-height: 300px;
        }
        .editor-frame .ProseMirror { 
          outline: none;
          min-height: 300px;
          height: 100%;
        }
        .editor-frame .ProseMirror:focus { outline: none; }

        /* Status */
        .status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; font-size: 12px; border-radius: 9999px; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }

        /* Small text */
        .muted { color: #6b7280; font-size: 12px; }
      `}</style>

      <div className="hero-header fade-in">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-white-500 p-4 md:p-6 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <Wand2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold">AI Document Generator</h1>
            </div>
            <p className="text-white/90 text-sm max-w-2xl">
              Create professional documents powered by AI with real-time progress tracking
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Load Balanced</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                <span>Real-time Updates</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Export</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="doc-grid">
        {/* Left column: Controls */}
        <div className="doc-left">
          <Card className="rounded-2xl prompt-card">
            <CardHeader>
              <CardTitle className="text-xl">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                placeholder="e.g., Create a 2-page project proposal for an internal AI pilot. Include an exec summary, goals, risks, and a simple timeline."
                className="min-h-[100px] max-h-[150px] rounded-2xl resize-none"
              />
              <div className="mt-3">
                <p className="text-xs text-gray-600 mb-2">Quick templates:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: FileText, text: "Business Plan" },
                    { icon: Sparkles, text: "Project Proposal" },
                    { icon: FileCheck, text: "Research Paper" },
                    { icon: Download, text: "Meeting Minutes" }
                  ].map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => setPrompt(`Create a professional ${text.toLowerCase()} that includes...`)}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate Document
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  onClick={handleRefine}
                  disabled={isRefining}
                >
                  {isRefining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      {hasSelection ? "Refine Selection" : "Refine Document"}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 h-4 w-4" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Tips: Select a paragraph to refine only that section. Use the toolbar or bubble menu for formatting.
              </div>
            </CardContent>
          </Card>

          {/* Status Tracker - shows during generation */}
          {(isGenerating || isRefining || jobId) && (
            <div className="status-card">
              <StatusTracker
                jobId={jobId}
                isLoading={isGenerating || isRefining}
                onStatusUpdate={handleStatusUpdate}
                onCancel={() => {
                  // Implement cancel logic if your backend supports it
                  toast.info("Cancellation requested");
                }}
              />
            </div>
          )}


          {/* Basic Status Card - shows when not generating */}
          {/* {!isGenerating && !isRefining && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Status</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Badge variant={jobId ? "default" : "secondary"} className="rounded-xl">{jobId ? `Job: ${jobId.slice(0,8)}…` : "No job yet"}</Badge>
                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline hover:no-underline">
                    Latest PDF <ExternalLink className="w-3 h-3"/>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">No PDF exported</span>
                )}
              </CardContent>
            </Card>
          )} */}
        </div>

        {/* Right column: Editor */}
        <div className="doc-right">
          <Card className="rounded-2xl editor-container">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-xl">Document</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 space-y-3">
              <div className="flex-shrink-0">
                <Toolbar editor={editor} />
              </div>
              <div className="editor-scrollable flex-1">
                <div className="rounded-2xl border editor-frame">
                  {/* BubbleMenu temporarily removed for CDN builds */}
                  <EditorContent editor={editor} />
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>{editor ? editor.storage.characterCount.characters() : 0} characters</span>
                <span>{editor ? editor.storage.characterCount.words() : 0} words</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
