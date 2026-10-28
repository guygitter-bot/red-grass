import { FileText, FolderMinus, Heart, MessageCircle, PlayCircle } from 'lucide-react';
import { emojiOf, isVideo } from '../lib/recipes';

export default function RecipeCard({ recipe, onOpen, removeFrom = null, onRemoveFrom }) {
  return (
    <div className="relative flex">
      <button onClick={onOpen} className="flex-1 text-right bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col">
        <div className="relative aspect-[4/3] bg-orange-100 flex items-center justify-center">
          {recipe.image ? (
            <img src={recipe.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : null}
          <span className="text-4xl">{emojiOf(recipe.category)}</span>
          {isVideo(recipe) && (
            <PlayCircle size={26} className="absolute bottom-2 left-2 text-white drop-shadow" fill="rgba(0,0,0,.35)" />
          )}
          {recipe.source?.kind === 'whatsapp' && (
            <MessageCircle size={24} className="absolute bottom-2 left-2 text-white drop-shadow" fill="#10b981" />
          )}
          {recipe.source?.kind === 'file' && (
            <FileText size={24} className="absolute bottom-2 left-2 text-white drop-shadow" fill="#10b981" />
          )}
          {recipe.favorite && (
            <Heart size={20} className="absolute top-2 left-2 text-white drop-shadow" fill="#f43f5e" />
          )}
        </div>
        <div className="p-2.5">
          <div className="font-bold text-stone-900 leading-snug line-clamp-2">{recipe.title}</div>
          <div className="text-xs text-stone-500 mt-1 flex items-center justify-between gap-1">
            <span className="truncate">{recipe.category}</span>
            {recipe.rating > 0 && <span className="text-amber-500 shrink-0">{'★'.repeat(recipe.rating)}</span>}
          </div>
        </div>
      </button>
      {/* מתכון בכמה קטגוריות: הורדה מהקטגוריה שמוצגת עכשיו */}
      {removeFrom && (
        <button
          onClick={onRemoveFrom}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
          aria-label={`הורדה מ${removeFrom}`}
          title={`הורדה מ${removeFrom}`}
        >
          <FolderMinus size={16} />
        </button>
      )}
    </div>
  );
}
