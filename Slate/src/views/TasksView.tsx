import React, { useState, useEffect } from 'react';
import { useTasksStore } from '../store/tasksStore';
import type { TaskItem } from '../store/tasksStore';
import { useKanbanStore } from '../store/kanbanStore';
import { useCalendarStore } from '../store/calendarStore';
import { useAuthStore } from '../store/authStore';
import { compressImage } from '../utils/imageCompressor';
import { 
  Plus, 
  Tag, 
  Calendar, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  Paperclip
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import confetti from 'canvas-confetti';

export const TasksView: React.FC = () => {
  const { 
    tasks, 
    loading, 
    filter, 
    sortBy, 
    setFilter, 
    setSortBy, 
    addTask, 
    updateTask, 
    deleteTask,
    toggleComplete,
    uploadAttachment,
    deleteAttachment,
    uploadProgress
  } = useTasksStore();

  const { addCard, activeBoardId } = useKanbanStore();
  const { addEvent } = useCalendarStore();
  const { user } = useAuthStore();

  // Create form
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignee, setAssignee] = useState<'self' | 'partner' | 'both'>('both');
  const [tagsText, setTagsText] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createFilePreview, setCreateFilePreview] = useState<string>(
    ''
  );

  const handleCreateFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      setCreateFile(fileToUpload);
      setCreateFilePreview(URL.createObjectURL(fileToUpload));
    }
  };

  // Undo complete toast
  const [lastCompletedTaskId, setLastCompletedTaskId] = useState<string | null>(null);
  const [lastCompletedTaskTitle, setLastCompletedTaskTitle] = useState<string>('');
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Task Details Modal
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailDesc, setDetailDesc] = useState('');
  const [detailDueDate, setDetailDueDate] = useState('');
  const [detailPriority, setDetailPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { showToast } = useToast();
  const [detailAssignee, setDetailAssignee] = useState<'self' | 'partner' | 'both'>('both');
  const [detailTagsText, setDetailTagsText] = useState('');

  const handleOpenDetails = (task: TaskItem) => {
    setSelectedTask(task);
    setDetailTitle(task.title);
    setDetailDesc(task.description || '');
    setDetailDueDate(task.dueDate || '');
    setDetailPriority(task.priority);
    setDetailAssignee(task.assignee);
    setDetailTagsText(task.tags.join(', '));
  };

  useEffect(() => {
    const openItemId = localStorage.getItem('slate_open_item_id');
    const openItemType = localStorage.getItem('slate_open_item_type');
    if (openItemId && openItemType === 'task' && tasks.length > 0) {
      const task = tasks.find(t => t.id === openItemId);
      if (task) {
        setTimeout(() => {
          handleOpenDetails(task);
        }, 0);
        localStorage.removeItem('slate_open_item_id');
        localStorage.removeItem('slate_open_item_type');
      }
    }
  }, [tasks]);

  const handleSaveDetails = async () => {
    if (!selectedTask) return;
    const tags = detailTagsText.split(',').map(t => t.trim()).filter(Boolean);
    await updateTask(selectedTask.id, {
      title: detailTitle,
      description: detailDesc,
      dueDate: detailDueDate || undefined,
      priority: detailPriority,
      assignee: detailAssignee,
      tags
    });
    
    setSelectedTask(prev => prev ? {
      ...prev,
      title: detailTitle,
      description: detailDesc,
      dueDate: detailDueDate || undefined,
      priority: detailPriority,
      assignee: detailAssignee,
      tags
    } : null);
  };

  const handleTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedTask) {
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
        await uploadAttachment(selectedTask.id, fileToUpload);
        const updated = useTasksStore.getState().tasks.find(t => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
        showToast("File uploaded successfully", "success");
      } catch (err) {
        console.error(err);
        showToast(`Failed to upload file: ${err instanceof Error ? err.message : String(err)}`, "error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleTaskFileDelete = async (idx: number) => {
    if (selectedTask) {
      await deleteAttachment(selectedTask.id, idx);
      const updated = useTasksStore.getState().tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  };

  const handleToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    const wasCompleted = await toggleComplete(id);
    if (wasCompleted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 }
      });
      if (task) {
        setLastCompletedTaskId(id);
        setLastCompletedTaskTitle(task.title);
        setShowUndoToast(true);
        // Auto-dismiss toast after 10 seconds
        setTimeout(() => {
          setShowUndoToast(false);
        }, 10000);
      }
    } else {
      setShowUndoToast(false);
    }
  };

  const handleUndoComplete = async () => {
    if (lastCompletedTaskId) {
      await toggleComplete(lastCompletedTaskId);
      setShowUndoToast(false);
      setLastCompletedTaskId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const newTaskDoc = await addTask({
        title,
        description,
        dueDate: dueDate || undefined,
        priority,
        assignee,
        tags
      });
      if (newTaskDoc && createFile) {
        await uploadAttachment(newTaskDoc.id, createFile);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setAssignee('both');
      setTagsText('');
      setCreateFile(null);
      if (createFilePreview) {
        URL.revokeObjectURL(createFilePreview);
      }
      setCreateFilePreview('');
      setShowAddModal(false);
    }
  };

  // Link to Calendar (Creates a calendar event based on task)
  const handleLinkToCalendar = async (task: TaskItem) => {
    const startISO = new Date(task.dueDate || new Date()).toISOString();
    const endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later
    
    await addEvent({
      title: `Task: ${task.title}`,
      start: startISO,
      end: endISO,
      duration: 60,
      color: '#8b5cf6', // purple
      notes: task.description || 'Linked from tasks checklist',
      assignee: task.assignee
    });

    await updateTask(task.id, { linkedEventId: 'linked' });
    showToast('Task has been linked to the calendar!', 'success');
  };

  // Promote to Kanban Board Card
  const handlePromoteToKanban = async (task: TaskItem) => {
    if (!activeBoardId) {
      showToast('Please initialize a Kanban Board in the Kanban section first.', 'error');
      return;
    }

    await addCard({
      columnId: 'col-todo', // first column
      boardId: activeBoardId,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      dueDate: task.dueDate,
      priority: task.priority,
      tags: task.tags
    });

    await updateTask(task.id, { isKanbanCard: true });
    showToast('Task has been successfully promoted to a Kanban card!', 'success');
  };

  // Filter Logic
  const getFilteredTasks = () => {
    let items = [...tasks];

    // Filter type
    if (filter === 'mine') {
      items = items.filter(t => {
        if (t.completed) return false;
        return t.assignee === 'both' ||
          (t.creatorId === user?.uid && t.assignee === 'self') ||
          (t.creatorId !== user?.uid && t.assignee === 'partner');
      });
    } else if (filter === 'partner') {
      items = items.filter(t => {
        if (t.completed) return false;
        return (t.creatorId === user?.uid && t.assignee === 'partner') ||
          (t.creatorId !== user?.uid && t.assignee === 'self');
      });
    } else if (filter === 'shared') {
      items = items.filter(t => !t.completed && t.assignee === 'both');
    } else if (filter === 'overdue') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localTodayStr = `${year}-${month}-${day}`;
      items = items.filter(t => !t.completed && t.dueDate && t.dueDate < localTodayStr);
    } else if (filter === 'completed') {
      items = items.filter(t => t.completed);
    } else {
      // 'all' shows all incomplete tasks
      items = items.filter(t => !t.completed);
    }

    // Sorting
    items.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sortBy === 'priority') {
        const priorityMap = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityMap[b.priority] - priorityMap[a.priority];
      }
      if (sortBy === 'createdAt') {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt); // newest first
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0; // default order
    });

    return items;
  };

  const activeTasks = getFilteredTasks();
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-6">
      
      {/* Filtering Header */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white dark:bg-brand-900 p-4 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-brand-950 p-1 rounded-xl w-full lg:w-auto overflow-x-auto no-scrollbar">
          {(['all', 'mine', 'partner', 'shared', 'overdue', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 lg:flex-initial text-center px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-white text-slate-900 dark:bg-brand-850 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {f === 'partner' ? "Partner's" : f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'dueDate' | 'priority' | 'createdAt' | 'title')}
            className="flex-1 lg:flex-initial px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-brand-850 dark:hover:bg-brand-800 border border-slate-200 dark:border-brand-750 rounded-xl text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-250 transition-colors"
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="createdAt">Sort by Date Created</option>
            <option value="title">Sort Alphabetically</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white font-bold rounded-xl text-xs shadow-md transition-all shrink-0"
          >
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* Loading list */}
      {loading ? (
        <LoadingSkeleton type="list" />
      ) : activeTasks.length === 0 ? (
        <div className="bg-white dark:bg-brand-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-brand-800 shadow-sm max-w-lg mx-auto">
          <div className="w-12 h-12 bg-slate-100 dark:bg-brand-950 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-bold mb-1">All caught up!</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">No pending tasks matching your selection.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white text-xs font-bold rounded-xl shadow transition-all"
          >
            Create your first task
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {activeTasks.map((task) => {
             const today = new Date();
             const year = today.getFullYear();
             const month = String(today.getMonth() + 1).padStart(2, '0');
             const day = String(today.getDate()).padStart(2, '0');
             const localTodayStr = `${year}-${month}-${day}`;
             const isOverdue = task.dueDate && task.dueDate < localTodayStr && !task.completed;
            return (
              <div
                key={task.id}
                className={`bg-white dark:bg-brand-900 border rounded-2xl p-4 flex gap-4 items-start shadow-sm hover:border-slate-300 dark:hover:border-brand-750 transition-all ${
                  task.completed ? 'opacity-60 bg-slate-50/50 dark:bg-brand-950/20' : ''
                } ${isOverdue ? 'border-rose-100 dark:border-rose-950/50' : 'border-slate-200 dark:border-brand-800'}`}
              >
                {/* Complete checkbox */}
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggle(task.id)}
                  className="w-5 h-5 rounded-full border-slate-300 dark:border-brand-700 text-indigo-600 focus:ring-indigo-500/20 mt-0.5 cursor-pointer shrink-0 transition-transform active:scale-90"
                />

                {/* Body info */}
                <div 
                  className="flex-1 min-w-0 cursor-pointer hover:opacity-80"
                  onClick={() => handleOpenDetails(task)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className={`font-semibold text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {task.title}
                    </h4>

                    {/* Priority badge */}
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                      task.priority === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                      task.priority === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                      'bg-slate-100 text-slate-700 dark:bg-brand-950/40 dark:text-slate-300'
                    }`}>
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
                      {task.description}
                    </p>
                  )}

                  {/* Metadata labels */}
                  <div className="flex flex-wrap gap-2.5 items-center mt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-500 font-extrabold' : ''}`}>
                        {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                        Due: {task.dueDate}
                      </span>
                    )}

                    <span className="capitalize bg-slate-500/10 dark:bg-brand-850 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400">
                      Assignee: {
                        task.assignee === 'both' ? 'both' :
                        ((task.creatorId === user?.uid && task.assignee === 'self') || (task.creatorId !== user?.uid && task.assignee === 'partner')) ? 'Me' : 'Partner'
                      }
                    </span>

                    {task.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-0.5 text-indigo-500/80 dark:text-indigo-400">
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}

                    {task.attachments && task.attachments.length > 0 && (
                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                        <Paperclip size={10} />
                        {task.attachments.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions context menu */}
                {!task.completed && (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => {
                        handleOpenDetails(task);
                        setTimeout(() => {
                          document.getElementById('task-attachment-upload')?.click();
                        }, 150);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-brand-800 transition-colors"
                      title="Attach Photo/File"
                    >
                      <Paperclip size={14} />
                    </button>
                    {!task.linkedEventId && task.dueDate && (
                      <button
                        onClick={() => handleLinkToCalendar(task)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-brand-800 transition-colors"
                        title="Link to Calendar"
                      >
                        <Calendar size={14} />
                      </button>
                    )}
                    {!task.isKanbanCard && (
                      <button
                        onClick={() => handlePromoteToKanban(task)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-brand-800 transition-colors"
                        title="Promote to Kanban Card"
                      >
                        <ArrowRightLeft size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-brand-800 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          if (selectedTask) {
            await deleteTask(selectedTask.id);
            setSelectedTask(null);
            showToast('Task deleted successfully', 'success');
          }
        }}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* Completed tasks header info */}
      {filter !== 'completed' && completedCount > 0 && (
        <div className="pt-2 text-center">
          <button 
            onClick={() => setFilter('completed')}
            className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
          >
            Show {completedCount} archived / completed tasks
          </button>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold mb-4">✅ Create Task</h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Task details..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-sm focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent ⚠️</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assignee</label>
                  <select
                    value={assignee}
                    onChange={e => setAssignee(e.target.value as 'self' | 'partner' | 'both')}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="both">Both of Us</option>
                    <option value="self">Me Only</option>
                    <option value="partner">Partner Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tags (Comma Separated)</label>
                  <input
                    type="text"
                    placeholder="home, chore..."
                    value={tagsText}
                    onChange={e => setTagsText(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Photo Upload for new task */}
              <div className="border-t border-slate-100 dark:border-brand-800 pt-3">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">📷 Attach Photo / File (Optional)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById('task-create-file-upload')?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-brand-850 dark:hover:bg-brand-800 border border-slate-200 dark:border-brand-750 text-xs font-bold rounded-xl transition-all cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    Select File
                  </button>
                  <input
                    type="file"
                    id="task-create-file-upload"
                    onChange={handleCreateFileChange}
                    className="hidden"
                  />
                  {createFile && (
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-brand-950 px-2 py-1 rounded-xl border border-slate-150 dark:border-brand-850 text-xs font-semibold max-w-[200px] truncate">
                      {createFilePreview ? (
                        <img src={createFilePreview} className="w-6 h-6 rounded object-cover shadow-sm" alt="Preview" />
                      ) : (
                        <span className="text-[10px]">📎</span>
                      )}
                      <span className="truncate flex-1 text-[11px]">{createFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateFile(null);
                          if (createFilePreview) URL.revokeObjectURL(createFilePreview);
                          setCreateFilePreview('');
                        }}
                        className="text-rose-500 font-bold hover:underline px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-brand-850 rounded-xl text-xs font-bold border border-slate-200 dark:border-brand-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-100 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details & Attachments Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-brand-800 pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                📝 Task Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-100 dark:hover:bg-slate-200 rounded-lg border border-slate-200 dark:border-slate-300 text-xs font-bold text-slate-800 dark:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={detailTitle}
                  onChange={e => setDetailTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-300 rounded-xl text-sm focus:outline-none text-black dark:text-black"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={detailDesc}
                  onChange={e => setDetailDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-300 rounded-xl text-sm focus:outline-none text-black dark:text-black"
                ></textarea>
              </div>

              {/* Grid 1: Due Date & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={detailDueDate}
                    onChange={e => setDetailDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-300 rounded-xl text-xs focus:outline-none text-black dark:text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={detailPriority}
                    onChange={e => setDetailPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-850 dark:text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Grid 2: Assignee & Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assignee</label>
                  <select
                    value={detailAssignee}
                    onChange={e => setDetailAssignee(e.target.value as 'self' | 'partner' | 'both')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-xl text-xs focus:outline-none text-slate-850 dark:text-slate-200"
                  >
                    <option value="both">Both of Us</option>
                    <option value="self">Me Only</option>
                    <option value="partner">Partner Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tags</label>
                  <input
                    type="text"
                    value={detailTagsText}
                    onChange={e => setDetailTagsText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-300 rounded-xl text-xs focus:outline-none text-black dark:text-black"
                  />
                </div>
              </div>

              {/* Save changes button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Field Changes
                </button>
              </div>

              {/* File Attachments Area */}
              <div className="border-t border-slate-100 dark:border-brand-800 pt-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Paperclip size={13} /> Attachments ({selectedTask.attachments?.length || 0})
                    {isUploading && <span className="ml-2 text-indigo-500 animate-pulse font-extrabold">(Uploading...)</span>}
                  </h4>
                  <button
                    type="button"
                    onClick={() => document.getElementById('task-attachment-upload')?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-brand-850 dark:hover:bg-brand-800 border border-slate-200 dark:border-brand-750 text-xs font-bold rounded-xl transition-all cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    📷 Attach Photo / File
                  </button>
                </div>

                <input
                  type="file"
                  id="task-attachment-upload"
                  onChange={handleTaskFileUpload}
                  className="hidden"
                />

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                  {/* Render active progress bars */}
                  {Object.entries(uploadProgress)
                    .filter(([key]) => key.startsWith(`${selectedTask.id}-`))
                    .map(([key, pct]) => {
                      const filename = key.replace(`${selectedTask.id}-`, '');
                      return (
                        <div 
                          key={key}
                          className="flex flex-col gap-1 p-2 bg-indigo-50/50 dark:bg-brand-950 rounded-xl border border-indigo-100 dark:border-brand-850 text-[11px]"
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

                  {(!selectedTask.attachments || selectedTask.attachments.length === 0) && !Object.keys(uploadProgress).some(k => k.startsWith(`${selectedTask.id}-`)) ? (
                    <p className="text-[11px] text-slate-450 italic">No attachments uploaded yet.</p>
                  ) : (
                    selectedTask.attachments && selectedTask.attachments.map((file, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-150 dark:border-brand-850 truncate text-[11px] font-semibold"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 truncate text-indigo-650 dark:text-indigo-400 flex-1 ${file.isPending ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                        >
                          {file.type.startsWith('image/') ? (
                            <img src={file.url} className="w-8 h-8 rounded object-cover shadow-sm shrink-0" alt="attachment" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-200 dark:bg-brand-800 rounded flex items-center justify-center text-slate-500 shrink-0">📎</div>
                          )}
                          <div className="flex flex-col truncate flex-1">
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <span className="text-[9px] text-slate-400 font-normal">
                              {file.isPending ? (
                                <span className="text-amber-500 font-bold">(Offline Queue)</span>
                              ) : (
                                `${(file.size / 1024).toFixed(1)} KB`
                              )}
                            </span>
                          </div>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleTaskFileDelete(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md shrink-0 animate-in fade-in"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-brand-800 pt-3 mt-4 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteOpen(true);
                }}
                className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete Task
              </button>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Task Completion Toast */}
      {showUndoToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white dark:bg-white dark:text-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-xs font-semibold">
            Task marked completed: <span className="italic">"{lastCompletedTaskTitle}"</span>
          </span>
          <button
            onClick={handleUndoComplete}
            className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-sm transition-all"
          >
            Undo
          </button>
        </div>
      )}

    </div>
  );
};
