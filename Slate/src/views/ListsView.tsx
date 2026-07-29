import React, { useState } from 'react';
import { useListsStore } from '../store/listsStore';
import type { GroceryItem } from '../store/listsStore';
import { Plus, Trash2, CheckCircle2, Circle, ShoppingCart, Camera, X } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { compressImage } from '../utils/imageCompressor';

const CATEGORIES = [
  { name: 'Produce', emoji: '🍎', color: '#10b981' }, // green
  { name: 'Dairy', emoji: '🥛', color: '#3b82f6' }, // blue
  { name: 'Meat/Seafood', emoji: '🥩', color: '#ef4444' }, // red
  { name: 'Bakery', emoji: '🍞', color: '#f59e0b' }, // orange
  { name: 'Frozen', emoji: '❄️', color: '#06b6d4' }, // cyan
  { name: 'Pantry', emoji: '🥫', color: '#8b5cf6' }, // purple
  { name: 'Household', emoji: '🧼', color: '#64748b' }, // slate
  { name: 'Other', emoji: '🛒', color: '#ec4899' } // pink
];

export const ListsView: React.FC = () => {
  const { items, loading, addItem, toggleItemComplete, deleteItem, clearCompleted, uploadItemPhoto } = useListsStore();
  const { showToast } = useToast();
  const [itemName, setItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Produce');
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string>('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    await addItem(itemName, selectedCategory, createPhoto || undefined);
    showToast(`Added "${itemName}" to your list`, 'success');
    setItemName('');
    setCreatePhoto(null);
    if (createPhotoPreview) URL.revokeObjectURL(createPhotoPreview);
    setCreatePhotoPreview('');
  };

  const handleCreatePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      setCreatePhoto(fileToUpload);
      setCreatePhotoPreview(URL.createObjectURL(fileToUpload));
    }
  };

  const handleInlinePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(prev => ({ ...prev, [itemId]: true }));
      try {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
        }
        await uploadItemPhoto(itemId, fileToUpload);
        showToast("Photo attached to item", "success");
      } catch (err) {
        console.error(err);
        showToast(`Failed to attach photo: ${err instanceof Error ? err.message : String(err)}`, "error");
      } finally {
        setIsUploading(prev => ({ ...prev, [itemId]: false }));
      }
    }
  };

  const activeItems = items.filter(i => !i.completed);
  const completedItems = items.filter(i => i.completed);

  // Group active items by category
  const activeByCategory = activeItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const getCategoryInfo = (catName: string) => {
    return CATEGORIES.find(c => c.name === catName) || { name: catName, emoji: '🛒', color: '#64748b' };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Quick Add Form */}
      <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl p-6 shadow-sm animate-in fade-in duration-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <ShoppingCart size={18} />
          </div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Add Shopping List Item</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2.5">
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="e.g. Milk, Bananas, Toilet paper..."
              required
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-sm focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-200 dark:focus:ring-brand-850"
            />
            <Button
              type="submit"
              icon={<Plus size={16} />}
              className="px-5 py-3 text-sm shadow-md"
            >
              Add
            </Button>
          </div>

          {/* Category Selector Cards */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.name;
              return (
                <button
                  type="button"
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-sm'
                      : 'bg-slate-50 text-slate-650 border-slate-200 dark:bg-brand-950/50 dark:text-slate-400 dark:border-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Photo upload for new grocery item */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => document.getElementById('grocery-photo-upload')?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-brand-950/50 dark:hover:bg-brand-800 border border-slate-200 dark:border-brand-800 text-xs font-bold rounded-xl transition-all cursor-pointer text-slate-700 dark:text-slate-350"
            >
              📷 Attach Photo
            </button>
            <input
              type="file"
              id="grocery-photo-upload"
              onChange={handleCreatePhotoChange}
              accept="image/*"
              className="hidden"
            />
            {createPhoto && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-brand-950 px-2 py-1 rounded-xl border border-slate-150 dark:border-brand-850 text-xs font-semibold max-w-[200px] truncate">
                {createPhotoPreview ? (
                  <img src={createPhotoPreview} className="w-6 h-6 rounded object-cover shadow-sm" alt="Preview" />
                ) : (
                  <span className="text-[10px]">📎</span>
                )}
                <span className="truncate flex-1 text-[11px]">{createPhoto.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCreatePhoto(null);
                    if (createPhotoPreview) URL.revokeObjectURL(createPhotoPreview);
                    setCreatePhotoPreview('');
                  }}
                  className="text-rose-500 font-bold hover:underline px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Main List Layout */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="Your Shopping List is Empty"
          description="Coordinating groceries is easy! Add items above, group them by store categories, and see updates instantly on your partner's screen."
        />
      ) : (
        <div className="space-y-6">
          
          {/* Active Items Grouped by Category */}
          {activeItems.length > 0 && (
            <div className="space-y-6">
              {Object.entries(activeByCategory).map(([categoryName, catItems]) => {
                const catInfo = getCategoryInfo(categoryName);
                return (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-sm">{catInfo.emoji}</span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {categoryName}
                      </h4>
                      <span className="h-0.5 flex-1 bg-slate-150 dark:bg-brand-850 ml-2 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-2xl p-4 shadow-sm hover:border-slate-350 dark:hover:border-brand-700 transition-all flex justify-between items-center group animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <div
                              onClick={() => toggleItemComplete(item.id)}
                              className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                            >
                              <button className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
                                <Circle size={18} />
                              </button>
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                {item.name}
                              </span>
                            </div>

                            {/* Photo Display / Camera Trigger */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.photoUrl ? (
                                <img
                                  src={item.photoUrl}
                                  onClick={() => setLightboxUrl(item.photoUrl!)}
                                  className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-brand-850 shadow-sm hover:scale-105 transition-transform"
                                  alt="Grocery item photo"
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => document.getElementById(`grocery-item-upload-${item.id}`)?.click()}
                                    className="p-1.5 text-slate-450 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-brand-850 rounded-lg transition-colors cursor-pointer"
                                    title="Add brand photo"
                                  >
                                    <Camera size={15} />
                                  </button>
                                  <input
                                    type="file"
                                    id={`grocery-item-upload-${item.id}`}
                                    onChange={(e) => handleInlinePhotoUpload(item.id, e)}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                </>
                              )}
                              {isUploading[item.id] && (
                                <span className="text-[10px] text-indigo-500 animate-pulse font-bold">Uploading...</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 ml-2 shrink-0">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                              Added by {item.addedBy.split(' ')[0]}
                            </span>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Items Section */}
          {completedItems.length > 0 && (
            <div className="bg-slate-100/50 dark:bg-brand-900/10 border border-slate-200 dark:border-brand-850/60 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-brand-850/80 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
                  ✓ Checked Items ({completedItems.length})
                </span>
                <button
                  onClick={clearCompleted}
                  className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 px-2.5 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg border border-transparent hover:border-rose-100 dark:hover:border-rose-950 cursor-pointer"
                >
                  <Trash2 size={13} /> Clear Checked
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {completedItems.map(item => (
                  <div
                    key={item.id}
                    className="bg-white/60 dark:bg-brand-900/30 border border-slate-150 dark:border-brand-850/40 rounded-2xl p-3.5 flex justify-between items-center opacity-60 group hover:opacity-100 transition-all"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div
                        onClick={() => toggleItemComplete(item.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <button className="text-emerald-500 shrink-0">
                          <CheckCircle2 size={18} />
                        </button>
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 line-through truncate">
                          {item.name}
                        </span>
                      </div>

                      {item.photoUrl && (
                        <img
                          src={item.photoUrl}
                          onClick={() => setLightboxUrl(item.photoUrl!)}
                          className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-brand-850 shadow-sm hover:scale-105 transition-transform shrink-0"
                          alt="Grocery item photo"
                        />
                      )}
                    </div>

                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
          <div className="relative max-w-3xl max-h-[85vh] animate-in zoom-in-95 duration-200">
            <img src={lightboxUrl} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/10" alt="Full size preview" />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-350 transition-colors bg-white/10 hover:bg-white/20 rounded-full cursor-pointer flex items-center justify-center"
              title="Close Preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
