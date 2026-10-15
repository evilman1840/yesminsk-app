import React, { useState } from 'react';
import { Camera, Check, Sparkles, MapPin, ArrowLeft } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal } from '../types';
import { telegramService } from '../services/telegram';

interface ProfileFormScreenProps {
  initialData?: {
    name: string;
    age: string;
    bio: string;
    goals: ActivityGoal[];
    avatarUrl: string;
    area: string;
  };
  onSave: (data: any) => void;
  onBack?: () => void;
  isFirstTime?: boolean;
}

const MINSK_AREAS = [
  'Осмоловка',
  'Немига / Центр',
  'Октябрьская',
  'Золотая Горка',
  'Троицкое предместье',
  'Парк Челюскинцев',
  'Восток / Маяк Минска'
];

export const ProfileFormScreen: React.FC<ProfileFormScreenProps> = ({
  initialData,
  onSave,
  onBack,
  isFirstTime = false
}) => {
  const [name, setName] = useState(initialData?.name || 'Полина');
  const [age, setAge] = useState(initialData?.age || '25');
  const [bio, setBio] = useState(
    initialData?.bio || 'Люблю архитектуру конструктивизма, пить фильтр-кофе в «Зерне» и неспешные прогулки вдоль Свислочи. Только дружеское общение! ☕️'
  );
  const [selectedGoals, setSelectedGoals] = useState<ActivityGoal[]>(
    initialData?.goals || ['walk', 'cafe_bar']
  );
  const [avatarUrl, setAvatarUrl] = useState(
    initialData?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  );
  const [area, setArea] = useState(initialData?.area || 'Осмоловка');

  const toggleGoal = (goal: ActivityGoal) => {
    telegramService.haptic('selection');
    if (selectedGoals.includes(goal)) {
      if (selectedGoals.length > 1) {
        setSelectedGoals(selectedGoals.filter(g => g !== goal));
      }
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleSave = () => {
    telegramService.haptic('medium');
    onSave({ name, age, bio, goals: selectedGoals, avatarUrl, area });
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-y-auto px-5 py-5 select-none">
      
      {/* Шапка формы */}
      <div className="flex items-center justify-between pb-3 border-b border-zine-border/70">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              onClick={onBack}
              className="w-7 h-7 rounded-lg bg-zine-card border border-zine-border flex items-center justify-center text-zine-ink"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="font-serif font-bold text-base text-zine-ink">
              {isFirstTime ? 'Твоя карточка в Минске' : 'Редактировать анкету'}
            </h2>
            <p className="text-[10px] text-zine-inkMuted uppercase tracking-wider font-semibold">
              Шаг 2 из 2 • Знакомство
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold text-zine-terracotta bg-zine-terracotta/10 px-2 py-0.5 rounded-full border border-zine-terracotta/20">
          без дейтинга
        </span>
      </div>

      <div className="space-y-4 py-3 flex-1">
        
        {/* Аватарка с кнопкой замены */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm">
          <div className="relative shrink-0">
            <img 
              src={avatarUrl} 
              alt={name} 
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zine-terracotta text-white flex items-center justify-center shadow-sm">
              <Camera size={11} />
            </div>
          </div>
          <div>
            <h4 className="font-serif font-bold text-xs text-zine-ink">Фото из Telegram</h4>
            <p className="text-[10px] text-zine-inkMuted leading-tight mt-0.5">
              Подтянуто автоматически из твоего профиля.
            </p>
            <button 
              onClick={() => telegramService.haptic('light')}
              className="text-[10px] font-semibold text-zine-terracotta mt-1 inline-block"
            >
              Сменить фото →
            </button>
          </div>
        </div>

        {/* Имя и Возраст */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2 space-y-1">
            <label className="text-[10.5px] font-bold text-zine-ink uppercase tracking-wider px-0.5">
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-zine-ink uppercase tracking-wider px-0.5">
              Возраст
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink text-center focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            />
          </div>
        </div>

        {/* Выбор района в Минске */}
        <div className="space-y-1">
          <label className="text-[10.5px] font-bold text-zine-ink uppercase tracking-wider px-0.5 flex items-center gap-1">
            <MapPin size={11} className="text-zine-terracotta" />
            <span>Где ты чаще всего бываешь?</span>
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink font-semibold focus:outline-none focus:border-zine-terracotta shadow-zine-sm cursor-pointer"
          >
            {MINSK_AREAS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Мультивыбор целей (стикеры) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-[10.5px] font-bold text-zine-ink uppercase tracking-wider">
              Что тебе интересно?
            </label>
            <span className="text-[9.5px] text-zine-inkMuted font-medium">мультивыбор</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(GOALS_CONFIG) as ActivityGoal[]).map((key) => {
              const item = GOALS_CONFIG[key];
              const isSelected = selectedGoals.includes(key);

              return (
                <div
                  key={key}
                  onClick={() => toggleGoal(key)}
                  className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center justify-between shadow-zine-sm active:scale-[0.98] ${
                    isSelected
                      ? `${item.badgeBg} ${item.badgeBorder} ring-1 ring-zine-terracotta/40`
                      : 'bg-zine-cardElevated border-zine-border opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{item.emoji}</span>
                    <span className={`text-[10.5px] font-bold ${isSelected ? item.badgeText : 'text-zine-ink'}`}>
                      {item.label}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-3.5 h-3.5 rounded-full bg-zine-terracotta text-white flex items-center justify-center shrink-0">
                      <Check size={9} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* О себе (счетчик до 200 знаков) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-[10.5px] font-bold text-zine-ink uppercase tracking-wider">
              О себе
            </label>
            <span className={`text-[10px] font-bold ${bio.length > 180 ? 'text-zine-terracotta' : 'text-zine-inkMuted'}`}>
              {bio.length}/200
            </span>
          </div>

          <textarea
            rows={3}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink leading-relaxed focus:outline-none focus:border-zine-terracotta shadow-zine-sm resize-none"
          />

          <p className="text-[9.5px] text-zine-inkMuted flex items-center gap-1">
            <Sparkles size={11} className="text-zine-mustard shrink-0" />
            <span>Напиши любимые места или темы для разговоров за кофе.</span>
          </p>
        </div>

      </div>

      {/* Кнопка сохранения */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          className="w-full py-3 px-5 rounded-2xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-semibold text-xs shadow-zine active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span>{isFirstTime ? 'Сохранить и перейти к карте' : 'Сохранить изменения'}</span>
          <span>→</span>
        </button>
      </div>

    </div>
  );
};
