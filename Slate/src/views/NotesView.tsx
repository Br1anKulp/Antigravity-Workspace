import React, { useState, useRef } from 'react';
import { useNotesStore } from '../store/notesStore';
import type { NoteItem } from '../store/notesStore';
import { useAuthStore } from '../store/authStore';
import { compressImage } from '../utils/imageCompressor';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { 
  Plus, 
  Search, 
  Pin, 
  Tag, 
  Trash2, 
  Clock, 
  User, 
  Users, 
  Bold, 
  Italic, 
  List, 
  Heading1, 
  CheckSquare,
  FileText,
  Save,
  Paperclip,
  ArrowLeft
} from 'lucide-react';

const fontSizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
};

const parseMarkdown = (text: string) => {
  if (!text) return '';
  
  // Escape HTML tags to prevent XSS/rendering issues
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Headings
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-4 mb-2">$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-1.5">$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-bold text-slate-700 dark:text-slate-200 mt-2.5 mb-1">$1</h3>');

  // Checkbox lists (Completed and Pending)
  html = html.replace(/^- \[x\]\s+(.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" checked disabled class="rounded text-indigo-600 pointer-events-none" /> <span class="line-through text-slate-400">$1</span></div>');
  html = html.replace(/^- \[ \]\s+(.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" disabled class="rounded text-indigo-600 pointer-events-none" /> <span class="text-slate-750 dark:text-slate-300">$1</span></div>');

  // Bullet Lists (unordered)
  html = html.replace(/^- \s+(.+)$/gm, '<li class="list-disc ml-5 my-1 text-slate-700 dark:text-slate-350">$1</li>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-slate-900 dark:text-white">$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Line breaks for remaining text
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('<h') || line.trim().startsWith('<div') || line.trim().startsWith('<li')) {
      return line;
    }
    return line ? `<p class="my-1.5 leading-relaxed">${line}</p>` : '<div class="h-2"></div>';
  }).join('\n');

  return html;
};

export const NotesView: React.FC = () => {
  const { 
    notes, 
    loading, 
    searchQuery, 
    setSearchQuery, 
    addNote, 
    updateNote, 
    deleteNote,
    uploadAttachment,
    deleteAttachment,
    uploadProgress
  } = useNotesStore();

  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'personal' | 'shared'>('shared');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Debounced auto-save timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Note form state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');
  const [editorIsPinned, setEditorIsPinned] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base' | 'lg' | 'xl'>('sm');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  
  // Handle note selection
  const selectNote = (note: NoteItem) => {
    // Clear any pending autosave first
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setSelectedNoteId(note.id);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorTags(note.tags.join(', '));
    setEditorIsPinned(note.isPinned);
    setSaveStatus('idle');
    setEditorMode('edit');
  };

  // Trigger debounced autosave
  const triggerAutoSave = (updatedFields: Partial<NoteItem>) => {
    if (!selectedNoteId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      await updateNote(selectedNoteId, updatedFields);
    }, 800);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorTitle(val);
    setSaveStatus('idle');
    triggerAutoSave({ title: val });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditorContent(val);
    setSaveStatus('idle');
    triggerAutoSave({ content: val });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorTags(val);
    setSaveStatus('idle');
    const parsedTags = val.split(',').map(t => t.trim()).filter(Boolean);
    triggerAutoSave({ tags: parsedTags });
  };

  const handleSaveNote = async () => {
    if (!selectedNoteId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('saving');
    const parsedTags = editorTags.split(',').map(t => t.trim()).filter(Boolean);
    await updateNote(selectedNoteId, {
      title: editorTitle,
      content: editorContent,
      tags: parsedTags
    });
    setSaveStatus('saved');
  };

  const handlePinToggle = () => {
    const nextVal = !editorIsPinned;
    setEditorIsPinned(nextVal);
    updateNote(selectedNoteId!, { isPinned: nextVal });
  };

  const handleNoteFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedNoteId) {
      if (file.size > 300 * 1024 * 1024) {
        showToast("File size exceeds the 300 MB limit.", "error");
        return;
      }
      setIsUploading(true);
      try {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
        }
        await uploadAttachment(selectedNoteId, fileToUpload);
        showToast("File uploaded successfully", "success");
      } catch (err) {
        console.error(err);
        showToast(`Failed to upload file: ${err instanceof Error ? err.message : String(err)}`, "error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCreateNote = async () => {
    const title = 'Untitled Note';
    const content = '';
    const isShared = activeTab === 'shared';
    
    const doc = await addNote({
      title,
      content,
      isShared,
      isPinned: false,
      tags: []
    });

    if (doc) {
      selectNote({
        id: doc.id,
        title,
        content,
        isShared,
        isPinned: false,
        tags: [],
        lastEditedBy: user?.name || '',
        lastEditedById: user?.uid || '',
        lastEditedAt: new Date().toISOString(),
        creatorId: user?.uid || ''
      });
    }
  };

  const handleDeleteNote = async () => {
    if (selectedNoteId) {
      setConfirmDeleteOpen(true);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (selectedNoteId) {
      await deleteNote(selectedNoteId);
      setSelectedNoteId(null);
      setEditorTitle('');
      setEditorContent('');
      setEditorTags('');
      setEditorIsPinned(false);
      showToast("Note deleted successfully", "success");
    }
  };

  // Helper to insert formatting markup
  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (editorMode === 'preview') {
      setEditorMode('edit');
      setTimeout(() => {
        applyFormatting(prefix, suffix);
      }, 50);
    } else {
      applyFormatting(prefix, suffix);
    }
  };

  const applyFormatting = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end);
    const replacement = prefix + selectedText + suffix;
    
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setEditorContent(newContent);
    setSaveStatus('idle');
    triggerAutoSave({ content: newContent });
    
    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  // Filtering Notes
  const getFilteredNotes = () => {
    let items = notes.filter(n => {
      if (activeTab === 'personal') {
        return !n.isShared && n.creatorId === user?.uid;
      }
      return n.isShared;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return items;
  };

  const filtered = getFilteredNotes();
  const pinnedNotes = filtered.filter(n => n.isPinned);
  const unpinnedNotes = filtered.filter(n => !n.isPinned);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[720px] animate-in fade-in duration-200">
      
      {/* Notes Sidebar List */}
      <div className={`w-full lg:w-80 flex flex-col bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl overflow-hidden shadow-sm shrink-0 ${selectedNoteId ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Visibility Toggles */}
        <div className="flex border-b border-slate-100 dark:border-brand-800 p-1.5 bg-slate-50/50 dark:bg-brand-950/20">
          <button
            onClick={() => {
              setActiveTab('shared');
              setSelectedNoteId(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'shared'
                ? 'bg-white text-slate-900 dark:bg-brand-850 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={14} /> Shared Notes
          </button>
          <button
            onClick={() => {
              setActiveTab('personal');
              setSelectedNoteId(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'personal'
                ? 'bg-white text-slate-900 dark:bg-brand-850 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={14} /> Personal
          </button>
        </div>

        {/* Search & Create controls */}
        <div className="p-4 border-b border-slate-100 dark:border-brand-800 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreateNote}
            className="p-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 rounded-xl shadow-md shrink-0"
            title="Create Note"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Notes Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-brand-850 no-scrollbar">
          {loading ? (
            <div className="p-4"><LoadingSkeleton type="list" rows={3} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center animate-in fade-in duration-300">
              <div className="w-10 h-10 bg-slate-50 dark:bg-brand-950 rounded-xl flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-100 dark:border-brand-850">
                <FileText size={18} />
              </div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">No notes yet</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mb-4">Create your first note to start drafting ideas.</p>
              <button
                onClick={handleCreateNote}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Create Note
              </button>
            </div>
          ) : (
            <>
              {/* Pinned section */}
              {pinnedNotes.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 flex items-center gap-1 text-[9px] uppercase font-black tracking-wider text-slate-400">
                    <Pin size={10} className="fill-current" /> Pinned
                  </div>
                  {pinnedNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => selectNote(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-brand-850/50 transition-colors flex flex-col gap-1 ${
                        selectedNoteId === n.id ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <span className="text-xs font-bold truncate">{n.title || 'Untitled Note'}</span>
                      <span className="text-[10px] text-slate-400 truncate">{n.content || 'Empty Note'}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Unpinned section */}
              <div className="py-2">
                {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
                  <div className="px-4 py-1 text-[9px] uppercase font-black tracking-wider text-slate-400">Notes</div>
                )}
                {unpinnedNotes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => selectNote(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-brand-850/50 transition-colors flex flex-col gap-1 ${
                      selectedNoteId === n.id ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <span className="text-xs font-bold truncate">{n.title || 'Untitled Note'}</span>
                    <span className="text-[10px] text-slate-400 truncate">{n.content || 'Empty Note'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Note Editor Area */}
      <div className={`flex-1 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl overflow-hidden shadow-sm flex flex-col ${selectedNoteId ? 'flex' : 'hidden lg:flex'}`}>
        {selectedNoteId && selectedNote ? (
          <>
            {/* Editor Toolbar Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-brand-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNoteId(null)}
                  className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-brand-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-brand-850 shrink-0"
                  title="Back to list"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  onClick={handlePinToggle}
                  className={`p-2 rounded-xl border transition-colors ${
                    editorIsPinned
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-500 dark:border-indigo-950 dark:bg-indigo-950/30'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-brand-850 dark:hover:bg-brand-850 text-slate-400'
                  }`}
                  title={editorIsPinned ? 'Unpin Note' : 'Pin Note'}
                >
                  <Pin size={14} className={editorIsPinned ? 'fill-current' : ''} />
                </button>
                
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  Last edit: {selectedNote.lastEditedBy} at {new Date(selectedNote.lastEditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={saveStatus === 'saving'}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    saveStatus === 'saved'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400 border-transparent'
                  }`}
                  title="Save Note"
                >
                  <Save size={14} />
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>

                <button
                  onClick={handleDeleteNote}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                  title="Delete Note"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Editing Canvas */}
            <div className="flex-1 flex flex-col p-6 space-y-4">
              
              {/* Title Input */}
              <input
                type="text"
                placeholder="Note Title..."
                value={editorTitle}
                onChange={handleTitleChange}
                className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder-slate-300 dark:placeholder-slate-700 w-full"
              />

              {/* Toolbar controls (Edit/Preview + formatting + font-size) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-1 bg-slate-50 dark:bg-brand-950 rounded-2xl border border-slate-200/60 dark:border-brand-850/60 w-full">
                {/* Left: formatting buttons */}
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertFormatting('**', '**')} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-500 dark:text-slate-400"
                    title="Bold"
                  >
                    <Bold size={13} />
                  </button>
                  <button 
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertFormatting('*', '*')} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-500 dark:text-slate-400"
                    title="Italic"
                  >
                    <Italic size={13} />
                  </button>
                  <button 
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertFormatting('# ', '')} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-550 dark:text-slate-450"
                    title="Heading 1"
                  >
                    <Heading1 size={13} />
                  </button>
                  <button 
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertFormatting('- ', '')} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-500 dark:text-slate-400"
                    title="Bullet List"
                  >
                    <List size={13} />
                  </button>
                  <button 
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertFormatting('- [ ] ', '')} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-500 dark:text-slate-400"
                    title="Checklist"
                  >
                    <CheckSquare size={13} />
                  </button>
                  <button 
                    onClick={() => document.getElementById('note-attachment-upload')?.click()} 
                    className="p-1.5 hover:bg-white dark:hover:bg-brand-850 rounded-lg text-slate-550 dark:text-slate-450 border-l border-slate-205 dark:border-brand-850 pl-2 ml-1"
                    type="button"
                    title="Upload Attachment"
                  >
                    <Paperclip size={13} />
                  </button>
                </div>

                {/* Right: font size & edit/preview toggle */}
                <div className="flex items-center gap-2 pr-1">
                  {/* Font Size Selector */}
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as 'xs' | 'sm' | 'base' | 'lg' | 'xl')}
                    className="px-2 py-1 bg-white dark:bg-brand-850 border border-slate-200/60 dark:border-brand-800 rounded-lg text-[10px] font-bold focus:outline-none text-slate-900 dark:text-slate-100"
                    title="Font Size"
                  >
                    <option value="xs">XS (Extra Small)</option>
                    <option value="sm">SM (Small)</option>
                    <option value="base">MD (Medium)</option>
                    <option value="lg">LG (Large)</option>
                    <option value="xl">XL (Extra Large)</option>
                  </select>

                  {/* Mode Selector */}
                  <div className="flex bg-slate-100 dark:bg-brand-900 p-0.5 rounded-lg border border-slate-250/20 dark:border-brand-800">
                    <button
                      type="button"
                      onClick={() => setEditorMode('edit')}
                      className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                        editorMode === 'edit'
                          ? 'bg-white text-slate-800 dark:bg-brand-800 dark:text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-650 dark:hover:text-slate-250'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('preview')}
                      className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                        editorMode === 'preview'
                          ? 'bg-white text-slate-800 dark:bg-brand-800 dark:text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-650 dark:hover:text-slate-250'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              <input
                type="file"
                id="note-attachment-upload"
                onChange={handleNoteFileUpload}
                className="hidden"
              />

              {/* Note Content Textarea / Preview */}
              {editorMode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  placeholder="Start writing (Markdown supported)..."
                  value={editorContent}
                  onChange={handleContentChange}
                  className={`flex-1 w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 leading-relaxed ${fontSizeClasses[fontSize]}`}
                ></textarea>
              ) : (
                <div 
                  className={`flex-1 w-full overflow-y-auto pr-1 leading-relaxed markdown-preview space-y-2 prose dark:prose-invert max-w-none ${fontSizeClasses[fontSize]}`}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(editorContent) }}
                />
              )}

              {/* Note Attachments list */}
              {(isUploading || (selectedNote.attachments && selectedNote.attachments.length > 0) || Object.keys(uploadProgress).some(k => k.startsWith(`${selectedNoteId}-`))) && (
                <div className="pt-4 border-t border-slate-100 dark:border-brand-800 space-y-2">
                  <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Paperclip size={10} /> Attachments ({selectedNote.attachments?.length || 0})
                    {isUploading && <span className="ml-2 text-indigo-500 animate-pulse font-extrabold">(Uploading...)</span>}
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {/* Render existing attachments */}
                    {selectedNote.attachments && selectedNote.attachments.map((file, idx) => (
                      <div 
                        key={idx}
                        className="group relative flex items-center gap-2 p-2 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-850 truncate text-[11px]"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 truncate text-indigo-650 dark:text-indigo-400 font-bold flex-1 ${file.isPending ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                        >
                          {file.type.startsWith('image/') ? (
                            <img src={file.url} className="w-6 h-6 rounded object-cover shadow-sm shrink-0" alt="attachment" />
                          ) : (
                            <div className="w-6 h-6 bg-slate-200 dark:bg-brand-800 rounded flex items-center justify-center text-[10px] text-slate-550 shrink-0">📎</div>
                          )}
                          <span className="truncate">{file.name}</span>
                          {file.isPending && <span className="text-[9px] text-amber-500 font-bold shrink-0">(Offline Queue)</span>}
                        </a>
                        <button
                          onClick={() => deleteAttachment(selectedNoteId, idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md shrink-0 transition-colors"
                          title="Delete Attachment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Render active progress bars */}
                    {Object.entries(uploadProgress)
                      .filter(([key]) => key.startsWith(`${selectedNoteId}-`))
                      .map(([key, pct]) => {
                        const filename = key.replace(`${selectedNoteId}-`, '');
                        return (
                          <div 
                            key={key}
                            className="relative flex flex-col gap-1 p-2 bg-indigo-50/50 dark:bg-brand-950 rounded-xl border border-indigo-100 dark:border-brand-850 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 truncate text-slate-500 dark:text-slate-400 font-medium">
                              <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded flex items-center justify-center text-[10px] shrink-0 animate-pulse">⏳</div>
                              <span className="truncate flex-1">{filename}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-brand-800 rounded-full h-1 mt-1 overflow-hidden">
                              <div 
                                className="bg-indigo-650 dark:bg-indigo-400 h-1 rounded-full transition-all duration-300" 
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] text-indigo-650 dark:text-indigo-400 font-bold">Uploading {pct}%...</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tags Editor */}
              <div className="pt-4 border-t border-slate-100 dark:border-brand-800 flex items-center gap-2 text-xs">
                <Tag size={12} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Tags (separated by commas)..."
                  value={editorTags}
                  onChange={handleTagsChange}
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-indigo-500"
                />
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-brand-950 flex items-center justify-center mb-4">
              <FileText size={24} />
            </div>
            <h3 className="text-sm font-bold mb-1">No Note Selected</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Select a note from the sidebar or create a new one.</p>
            <button
              onClick={handleCreateNote}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white text-xs font-bold rounded-xl shadow transition-all"
            >
              Create new note
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDeleteNote}
        title="Delete Note"
        message="Are you sure you want to permanently delete this note? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};
