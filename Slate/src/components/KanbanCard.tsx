import React from 'react';
import { Clock, CheckSquare, MessageSquare, Paperclip } from 'lucide-react';
import type { CardAttachment, CardComment } from '../store/kanbanStore';

interface KanbanCardProps {
  card: {
    id: string;
    columnId: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
    checklist: Array<{ completed: boolean }>;
    comments: CardComment[];
    attachments: CardAttachment[];
  };
  boardCols: Array<{ id: string; name: string }>;
  onClick: () => void;
  onMoveCard: (cardId: string, colId: string) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = React.memo(({
  card,
  boardCols,
  onClick,
  onMoveCard
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-brand-950 border border-slate-200/80 dark:border-brand-800/80 dark:border-t-white/10 hover:border-indigo-400/40 dark:hover:border-indigo-500/40 p-4.5 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover-card-lift active:scale-[0.985] cursor-pointer flex flex-col gap-3 animate-slide-up"
    >
      {/* Title & Priority */}
      <div className="flex items-start justify-between gap-2.5">
        <h4 className="font-extrabold text-sm leading-snug text-slate-800 dark:text-slate-100 font-heading">{card.title}</h4>
        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
          card.priority === 'urgent' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.15)]' :
          card.priority === 'high' ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.15)]' :
          card.priority === 'medium' ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/25' :
          'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/20'
        }`}>
          {card.priority}
        </span>
      </div>

      {card.description && (
        <p className="text-xs md:text-[13px] text-slate-550 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {card.description}
        </p>
      )}

      {/* Card metadata row */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-brand-900 pt-2.5">
        <div className="flex items-center gap-2.5">
          {card.dueDate && (
            <span className="flex items-center gap-0.5">
              <Clock size={12} />
              {card.dueDate}
            </span>
          )}
          {card.checklist.length > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare size={12} />
              {card.checklist.filter(item => item.completed).length}/{card.checklist.length}
            </span>
          )}
          {card.comments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare size={12} />
              {card.comments.length}
            </span>
          )}
          {card.attachments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip size={12} />
              {card.attachments.length}
            </span>
          )}
        </div>

        {/* Quick movement selectors */}
        <div 
          className="flex items-center gap-1.5"
          onClick={(evt) => evt.stopPropagation()}
        >
          <select
            value={card.columnId}
            onChange={(evt) => onMoveCard(card.id, evt.target.value)}
            className="text-[10px] bg-slate-100 dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded px-1 py-0.5 font-semibold focus:outline-none cursor-pointer"
          >
            {boardCols.map(col => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

KanbanCard.displayName = 'KanbanCard';
