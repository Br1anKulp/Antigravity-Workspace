import React, { useState, useEffect } from 'react';
import { useKanbanStore } from '../store/kanbanStore';
import { compressImage } from '../utils/imageCompressor';
import { 
  Plus, 
  Trash2, 
  AlertTriangle,
  Settings,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  Paperclip,
  MessageSquare
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { KanbanCard } from '../components/KanbanCard';

export const KanbanView: React.FC = () => {
  const {
    boards,
    columns,
    cards,
    activeBoardId,
    loading,
    setActiveBoard,
    addBoard,
    deleteBoard,
    addColumn,
    updateColumnName,
    updateColumnWipLimit,
    deleteColumn,
    addCard,
    updateCard,
    moveCard,
    deleteCard,
    toggleChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    addComment,
    uploadAttachment,
    deleteAttachment,
    uploadProgress
  } = useKanbanStore();

// Modals state
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  
  const [showAddCard, setShowAddCard] = useState(false);
  const [addCardColId, setAddCardColId] = useState('');
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardDueDate, setCardDueDate] = useState('');
  const [cardPriority, setCardPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [cardAssignee, setCardAssignee] = useState<'self' | 'partner' | 'both'>('both');
  const [cardTagsText, setCardTagsText] = useState('');
  
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Checklist and Comments details inside detail drawer
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  
  // Column config states
  const [showColSettingsId, setShowColSettingsId] = useState<string | null>(null);
  const [colWipLimit, setColWipLimit] = useState(5);
  const [colName, setColName] = useState('');
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const { showToast } = useToast();

  useEffect(() => {
    const openItemId = localStorage.getItem('slate_open_item_id');
    const openItemType = localStorage.getItem('slate_open_item_type');
    if (openItemId && openItemType === 'card' && cards.length > 0) {
      const card = cards.find(c => c.id === openItemId);
      if (card) {
        setTimeout(() => {
          if (card.boardId !== activeBoardId) {
            setActiveBoard(card.boardId);
          }
          setSelectedCardId(openItemId);
        }, 0);
        localStorage.removeItem('slate_open_item_id');
        localStorage.removeItem('slate_open_item_type');
      }
    }
  }, [cards, activeBoardId, setActiveBoard]);
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      await addBoard(newBoardName, newBoardDesc);
    } catch (err) {
      console.error("Failed to create board:", err);
    } finally {
      setNewBoardName('');
      setNewBoardDesc('');
      setShowAddBoard(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim()) return;

    const tags = cardTagsText.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await addCard({
        columnId: addCardColId,
        boardId: activeBoardId!,
        title: cardTitle,
        description: cardDesc,
        assignee: cardAssignee,
        dueDate: cardDueDate || undefined,
        priority: cardPriority,
        tags
      });
    } catch (err) {
      console.error("Failed to create card:", err);
    } finally {
      setCardTitle('');
      setCardDesc('');
      setCardDueDate('');
      setCardPriority('medium');
      setCardAssignee('both');
      setCardTagsText('');
      setShowAddCard(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, cardId: string) => {
    const file = e.target.files?.[0];
    if (file) {
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
        await uploadAttachment(cardId, fileToUpload);
        showToast("File uploaded successfully", "success");
      } catch (err) {
        console.error(err);
        showToast(`Failed to upload file: ${err instanceof Error ? err.message : String(err)}`, "error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleAddCommentSubmit = async (e: React.FormEvent, cardId: string) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    await addComment(cardId, newCommentText);
    setNewCommentText('');
  };

  const handleAddChecklistSubmit = async (e: React.FormEvent, cardId: string) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    await addChecklistItem(cardId, newChecklistText);
    setNewChecklistText('');
  };

  const moveChecklistItem = async (cardId: string, index: number, direction: 'up' | 'down') => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const newChecklist = [...card.checklist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newChecklist.length) return;

    const temp = newChecklist[index];
    newChecklist[index] = newChecklist[targetIndex];
    newChecklist[targetIndex] = temp;

    try {
      await updateCard(cardId, { checklist: newChecklist });
    } catch (err) {
      console.error("Failed to reorder checklist:", err);
    }
  };

  const handleSaveColumnSettings = async (colId: string) => {
    await updateColumnName(colId, colName);
    await updateColumnWipLimit(colId, colWipLimit);
    setShowColSettingsId(null);
  };

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const boardCols = columns.filter(c => c.boardId === activeBoardId);
  const selectedCard = cards.find(c => c.id === selectedCardId);

  const handleMoveCard = async (cardId: string, targetColId: string) => {
    const targetCol = boardCols.find(col => col.id === targetColId);
    if (targetCol && targetCol.wipLimit) {
      const cardsInTarget = cards.filter(c => c.columnId === targetColId);
      if (cardsInTarget.length >= targetCol.wipLimit) {
        setConfirmConfig({
          isOpen: true,
          title: 'WIP Limit Exceeded',
          message: `Warning: Moving this card to "${targetCol.name}" will exceed its WIP Limit of ${targetCol.wipLimit}. Do you still want to proceed?`,
          onConfirm: async () => {
            await moveCard(cardId, targetColId);
            showToast('Card moved successfully', 'success');
          }
        });
        return;
      }
    }
    await moveCard(cardId, targetColId);
  };

  return (
    <div className="space-y-6">
      
      {/* Board Selector Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-brand-900 p-4 rounded-2xl border border-slate-200 dark:border-brand-800 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={activeBoardId || ''}
            onChange={e => setActiveBoard(e.target.value)}
            className="flex-1 md:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-200 dark:hover:bg-slate-100 border border-slate-250 dark:border-slate-350 rounded-xl text-sm font-semibold focus:outline-none text-black transition-colors"
          >
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowAddBoard(true)}
            className="px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-brand-850 rounded-xl border border-slate-200 dark:border-brand-800 text-xs font-semibold"
          >
            New Board
          </button>
        </div>

        {activeBoard && (
          <button
            onClick={() => deleteBoard(activeBoard.id)}
            className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1.5 self-end md:self-auto"
          >
            <Trash2 size={13} /> Delete Active Board
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton type="kanban" />
      ) : !activeBoardId ? (
        <div className="max-w-md mx-auto text-center py-16 bg-white dark:bg-brand-900 rounded-3xl border border-slate-200 dark:border-brand-800 p-6 shadow-sm">
          <TrelloIconPlaceholder />
          <h3 className="text-base font-bold mb-1">No boards yet</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Create a board to coordinate project items together.</p>
          <button
            onClick={() => setShowAddBoard(true)}
            className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold shadow"
          >
            Create Board
          </button>
        </div>
      ) : (
        /* Columns Wrapper (Horizontal scrolling on desktop) */
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {boardCols.map((col) => {
            const colCards = cards.filter(c => c.columnId === col.id);
            const isOverWip = col.wipLimit && colCards.length > col.wipLimit;
            
            return (
              <div 
                key={col.id} 
                className="w-[88vw] md:w-96 bg-slate-100/60 dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-4.5 flex flex-col max-h-[calc(100vh-220px)] shrink-0"
              >
                {/* Column header info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-black tracking-tight">{col.name}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      isOverWip ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-brand-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {colCards.length}{col.wipLimit ? `/${col.wipLimit}` : ''}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setColName(col.name);
                        setColWipLimit(col.wipLimit);
                        setShowColSettingsId(col.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-200/50 dark:hover:bg-brand-850"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setAddCardColId(col.id);
                        setShowAddCard(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-200/50 dark:hover:bg-brand-850"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* WIP warning banner */}
                {isOverWip && (
                  <div className="mb-3.5 flex items-center gap-1.5 bg-red-150 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50 text-xs text-red-650 dark:text-red-300 py-2 px-3.5 rounded-xl font-semibold">
                    <AlertTriangle size={14} className="shrink-0" /> WIP limit exceeded!
                  </div>
                )}

                {/* Column Cards scroll list */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 no-scrollbar">
                  {colCards.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-450 dark:text-slate-500 font-semibold border-2 border-dashed border-slate-200 dark:border-brand-800 rounded-2xl">
                      Empty column
                    </div>
                  ) : (
                    colCards.map(c => (
                      <KanbanCard
                        key={c.id}
                        card={c}
                        boardCols={boardCols}
                        onClick={() => setSelectedCardId(c.id)}
                        onMoveCard={handleMoveCard}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Add column button */}
          <button
            onClick={async () => {
              const name = prompt('Enter Column Name:');
              if (name) await addColumn(activeBoardId!, name);
            }}
            className="w-[88vw] md:w-96 bg-white dark:bg-brand-900/40 border-2 border-dashed border-slate-200 dark:border-brand-800 rounded-3xl py-12 flex flex-col items-center justify-center text-slate-400 hover:text-slate-650 hover:border-slate-350 dark:hover:border-brand-700 transition-all shrink-0 min-h-[160px]"
          >
            <Plus size={20} className="mb-2" />
            <span className="text-xs font-bold">Add Column</span>
          </button>
        </div>
      )}

      {/* Column settings edit overlay */}
      {showColSettingsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold mb-4">Column Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Column Name</label>
                <input
                  type="text"
                  value={colName}
                  onChange={e => setColName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">WIP Limit (Max Cards)</label>
                <input
                  type="number"
                  min={1}
                  value={colWipLimit}
                  onChange={e => setColWipLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmConfig({
                      isOpen: true,
                      title: 'Delete Column',
                      message: 'Are you sure you want to delete this column? This removes the column wrapper but cards remain.',
                      onConfirm: async () => {
                        await deleteColumn(showColSettingsId);
                        setShowColSettingsId(null);
                        showToast('Column deleted successfully', 'success');
                      }
                    });
                  }}
                  className="text-xs text-rose-500 font-bold hover:underline"
                >
                  Delete Column
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowColSettingsId(null)}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveColumnSettings(showColSettingsId)}
                    className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Board creation modal */}
      {showAddBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold mb-4">Create Board</h3>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Board Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Travel Plans"
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Details..."
                  value={newBoardDesc}
                  onChange={e => setNewBoardDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBoard(false)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card creation modal */}
      {showAddCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold mb-4">Add Card</h3>
            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Card Title</label>
                <input
                  type="text"
                  required
                  placeholder="Item title"
                  value={cardTitle}
                  onChange={e => setCardTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details..."
                  value={cardDesc}
                  onChange={e => setCardDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100"
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={cardDueDate}
                    onChange={e => setCardDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={cardPriority}
                    onChange={e => setCardPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assignee</label>
                  <select
                    value={cardAssignee}
                    onChange={e => setCardAssignee(e.target.value as 'self' | 'partner' | 'both')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="both">Both</option>
                    <option value="self">Me</option>
                    <option value="partner">Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tags (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="home, core"
                    value={cardTagsText}
                    onChange={e => setCardTagsText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card Details Side Drawer / Modal */}
      {selectedCardId && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setSelectedCardId(null)}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-brand-900 h-screen shadow-2xl p-6 overflow-y-auto no-scrollbar flex flex-col gap-6 animate-in slide-in-from-right duration-200">
            
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-brand-800 pb-4">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                🗂 Project Card Detail
              </span>
              <button
                onClick={() => setSelectedCardId(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-200 dark:hover:bg-slate-100 text-xs font-bold text-black rounded-xl border border-slate-250 dark:border-slate-350 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Title / Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">{selectedCard.title}</h2>
              {selectedCard.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-brand-950 p-4 rounded-2xl border border-slate-200 dark:border-brand-850">
                  {selectedCard.description}
                </p>
              )}
            </div>

            {/* Action buttons panel */}
            <div className="grid grid-cols-2 gap-4">
              {/* Checklist column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckSquare size={13} /> Checklist
                </h4>
                
                {/* Checklist items */}
                <div className="space-y-2">
                  {selectedCard.checklist.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50/50 dark:bg-brand-950/20 px-3 py-2 rounded-xl">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleChecklistItem(selectedCard.id, item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500/20"
                        />
                        <span className={`break-words whitespace-normal ${item.completed ? 'line-through text-slate-450' : ''}`}>{item.text}</span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => moveChecklistItem(selectedCard.id, index, 'up')}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 disabled:opacity-20 disabled:hover:text-slate-400"
                          title="Move Up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveChecklistItem(selectedCard.id, index, 'down')}
                          disabled={index === selectedCard.checklist.length - 1}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 disabled:opacity-20 disabled:hover:text-slate-400"
                          title="Move Down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => deleteChecklistItem(selectedCard.id, item.id)}
                          className="text-rose-500 hover:text-rose-650 p-1 ml-0.5"
                          title="Delete Item"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add checklist input */}
                <form 
                  onSubmit={(e) => handleAddChecklistSubmit(e, selectedCard.id)}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="New checklist item..."
                    value={newChecklistText}
                    onChange={e => setNewChecklistText(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                  <button type="submit" className="p-2 bg-slate-900 text-white dark:bg-white dark:text-black rounded-xl shadow">
                    <Plus size={14} />
                  </button>
                </form>
              </div>

              {/* Attachments column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Paperclip size={13} /> Attachments ({selectedCard.attachments?.length || 0})
                  {isUploading && <span className="ml-2 text-indigo-500 animate-pulse font-extrabold">(Uploading...)</span>}
                </h4>

                <div className="space-y-2">
                  {/* Render active progress bars */}
                  {Object.entries(uploadProgress)
                    .filter(([key]) => key.startsWith(`${selectedCard.id}-`))
                    .map(([key, pct]) => {
                      const filename = key.replace(`${selectedCard.id}-`, '');
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

                  {selectedCard.attachments.map((file, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 dark:bg-brand-950/20 dark:hover:bg-brand-950/40 rounded-xl border border-slate-200 dark:border-brand-850 truncate text-xs font-bold text-indigo-500"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2.5 truncate flex-1 ${file.isPending ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                      >
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} className="w-8 h-8 rounded object-cover shadow" alt="attachment" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-200 dark:bg-brand-800 rounded flex items-center justify-center text-slate-500">📎</div>
                        )}
                        <div className="flex flex-col truncate flex-1">
                          <span className="truncate max-w-[120px]">{file.name}</span>
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
                        onClick={() => deleteAttachment(selectedCard.id, idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md shrink-0 transition-colors animate-in fade-in"
                        title="Delete Attachment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="attachment-upload"
                    onChange={(e) => handleFileUpload(e, selectedCard.id)}
                    className="hidden"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-brand-850 dark:hover:bg-brand-800 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    <Paperclip size={12} /> Upload File
                  </label>
                </div>
              </div>
            </div>

            {/* Comments Thread Area */}
            <div className="border-t border-slate-100 dark:border-brand-800 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare size={13} /> Discussion Comments
              </h4>

              {/* Comments Feed List */}
              <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
                {selectedCard.comments.length === 0 ? (
                  <p className="text-xs text-slate-450 dark:text-slate-500 italic">No comments yet. Start a discussion with your partner!</p>
                ) : (
                  selectedCard.comments.map((comm) => (
                    <div key={comm.id} className="flex gap-3 items-start animate-in fade-in">
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                        style={{ backgroundColor: comm.avatarColor }}
                      >
                        {comm.userName.charAt(0)}
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-brand-950 px-3.5 py-2.5 border border-slate-200 dark:border-brand-850 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-extrabold text-slate-650 dark:text-slate-350">{comm.userName}</span>
                          <span className="text-[8px] text-slate-400">
                            {new Date(comm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{comm.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Field */}
              <form 
                onSubmit={(e) => handleAddCommentSubmit(e, selectedCard.id)}
                className="flex gap-2.5"
              >
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black rounded-xl text-xs font-bold shadow"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Bottom deletion operations */}
            <div className="border-t border-slate-100 dark:border-brand-800 pt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setConfirmConfig({
                    isOpen: true,
                    title: 'Delete Card',
                    message: 'Are you sure you want to permanently delete this card? This action cannot be undone.',
                    onConfirm: async () => {
                      await deleteCard(selectedCard.id);
                      setSelectedCardId(null);
                      showToast('Card deleted successfully', 'success');
                    }
                  });
                }}
                className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete Card
              </button>
            </div>

          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </div>
  );
};

// SVG Placeholder component for empty kanban
const TrelloIconPlaceholder = () => (
  <div className="w-12 h-12 bg-slate-150 dark:bg-brand-950 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
    <TrelloIcon />
  </div>
);

const TrelloIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <rect width="3" height="9" x="7" y="7" rx="1"/>
    <rect width="3" height="5" x="14" y="7" rx="1"/>
  </svg>
);
