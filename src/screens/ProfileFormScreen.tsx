import React, { useState, useRef } from 'react';
import { Camera, Check, Sparkles, MapPin, ArrowLeft, Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal } from '../types';
import { telegramService } from '../services/telegram';

interface ProfileFormScreenProps {
  initialData?: {
    name?: string;
    age?: string | number;
    bio?: string;
    goals?: ActivityGoal[];
    goal?: ActivityGoal;
    avatarUrl?: string;
    area?: string;
  };
  onSave: (data: {
    name: string;
    age: string;
    bio: string;
    goals: ActivityGoal[];
    goal: ActivityGoal;
    avatarUrl: string;
    area: string;
  }) => Promise<void> | void;
  onBack?: () => void;
  isFirstTime?: boolean;
}

const MINSK_AREAS = [
  'Немига / Центр',
  'Осмоловка',
  'Октябрьская',
  'Золотая Горка',
  'Троицкое предместье',
  'Парк Челюскинцев',
  'Восток / Маяк Минска',
  'Комаровка',
  'Площадь Победы',
  'Парк Победы / Победителей'
];

// Уютные теплые пресеты аватарок, если фото отсутствует
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80'
];

export const ProfileFormScreen: React.FC<ProfileFormScreenProps> = ({
  initialData,
  onSave,
  onBack,
  isFirstTime = false
}) => {
  // Реальные данные из Telegram WebApp API
  const tgUser = telegramService.getUser();

  const [name, setName] = useState<string>(
    initialData?.name || tgUser?.first_name || ''
  );
  const [age, setAge] = useState<string>(
    initialData?.age ? String(initialData.age) : '25'
  );
  const [bio, setBio] = useState<string>(
    initialData?.bio || ''
  );
  const [selectedGoals, setSelectedGoals] = useState<ActivityGoal[]>(
    initialData?.goals && initialData.goals.length > 0
      ? initialData.goals
      : initialData?.goal
      ? [initialData.goal]
      : ['walk']
  );
  const [avatarUrl, setAvatarUrl] = useState<string>(
    initialData?.avatarUrl || tgUser?.photo_url || PRESET_AVATARS[0]
  );
  const [area, setArea] = useState<string>(
    initialData?.area || 'Немига / Центр'
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Переключение целей (мультивыбор)
  const toggleGoal = (goal: ActivityGoal) => {
    telegramService.haptic('selection');
    if (selectedGoals.includes(goal)) {
      if (selectedGoals.length > 1) {
        setSelectedGoals(selectedGoals.filter((g) => g !== goal));
      }
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  // Загрузка фото с устройства (в Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (JPG, PNG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Размер фото не должен превышать 5 МБ');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        telegramService.haptic('success');
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert('Не удалось прочитать файл');
    };
    reader.readAsDataURL(file);
  };

  // Применение ссылки на фото
  const handleApplyCustomUrl = () => {
    if (!customUrl.trim()) return;
    setAvatarUrl(customUrl.trim());
    setShowUrlInput(false);
    setCustomUrl('');
    telegramService.haptic('success');
  };

  // Сохранение профиля
  const handleSave = async () => {
    setErrorText(null);

    if (!name.trim()) {
      setErrorText('Пожалуйста, укажи имя');
      telegramService.haptic('warning');
      return;
    }

    if (selectedGoals.length === 0) {
      setErrorText('Выбери хотя бы одну цель для встреч');
      telegramService.haptic('warning');
      return;
    }

    telegramService.haptic('medium');
    setIsSaving(true);

    try {
      await onSave({
        name: name.trim(),
        age: age.trim() || '25',
        bio: bio.trim(),
        goals: selectedGoals,
        goal: selectedGoals[0],
        avatarUrl,
        area
      });
      telegramService.haptic('success');
    } catch (err: any) {
      setErrorText(err.message || 'Ошибка сохранения профиля на сервере');
      telegramService.haptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-y-auto px-5 py-5 select-none bg-zine-paper">
      
      {/* Шапка формы */}
      <div className="flex items-center justify-between pb-3 border-b border-zine-border/70 shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              disabled={isSaving}
              className="w-7 h-7 rounded-lg bg-zine-card border border-zine-border flex items-center justify-center text-zine-ink hover:bg-white active:scale-95 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="font-serif font-bold text-base text-zine-ink">
              {isFirstTime ? 'Твоя карточка в Минске' : 'Редактировать анкету'}
            </h2>
            <p className="text-[10px] text-zine-inkMuted uppercase tracking-wider font-semibold">
              {tgUser?.username ? `@${tgUser.username}` : 'Только дружеский досуг'}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2 py-0.5 rounded-full border border-zine-terracotta/20">
          без дейтинга
        </span>
      </div>

      {/* Ошибка валидации / сети */}
      {errorText && (
        <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in">
          ⚠️ {errorText}
        </div>
      )}

      <div className="space-y-4 py-4 flex-1">
        
        {/* Блок Аватарки */}
        <div className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm">
          <div className="flex items-center gap-3.5">
            <div
              className="relative cursor-pointer shrink-0 group"
              onClick={() => fileInputRef.current?.click()}
              title="Нажмите, чтобы загрузить фото"
            >
              <img
                src={avatarUrl}
                alt={name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-zine-paper shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zine-terracotta text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                {isUploading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Camera size={12} />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-serif font-bold text-xs text-zine-ink">Фото профиля</h4>
              <p className="text-[10px] text-zine-inkMuted leading-tight mt-0.5">
                Загрузи своё фото или вставь ссылку.
              </p>

              <div className="flex items-center gap-2 mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-zine-cardElevated border border-zine-border text-[10.5px] font-semibold text-zine-ink hover:text-zine-terracotta flex items-center gap-1 shadow-zine-sm"
                >
                  <Upload size={11} />
                  <span>Загрузить</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-2.5 py-1 rounded-lg bg-zine-cardElevated border border-zine-border text-[10.5px] font-semibold text-zine-ink hover:text-zine-terracotta flex items-center gap-1 shadow-zine-sm"
                >
                  <LinkIcon size={11} />
                  <span>Ссылка</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ввод прямой ссылки */}
          {showUrlInput && (
            <div className="mt-3 pt-3 border-t border-zine-border/60 flex gap-1.5 animate-in fade-in">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Вставь ссылку на картинку..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta"
              />
              <button
                type="button"
                onClick={handleApplyCustomUrl}
                className="px-3 py-1.5 rounded-xl bg-zine-terracotta text-white text-xs font-semibold"
              >
                ОК
              </button>
            </div>
          )}

          {/* Быстрые пресеты */}
          <div className="mt-2.5 pt-2 border-t border-zine-border/40 flex items-center gap-2">
            <span className="text-[9.5px] text-zine-inkMuted font-medium">Пресеты:</span>
            <div className="flex gap-1.5">
              {PRESET_AVATARS.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`preset-${i}`}
                  onClick={() => {
                    setAvatarUrl(url);
                    telegramService.haptic('selection');
                  }}
                  className={`w-6 h-6 rounded-full object-cover cursor-pointer border transition-transform ${
                    avatarUrl === url ? 'ring-2 ring-zine-terracotta scale-110 border-white' : 'border-zine-border opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Имя и Возраст */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2 space-y-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider px-1">
              Имя *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Твое имя"
              className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider px-1">
              Возраст
            </label>
            <input
              type="number"
              min="16"
              max="99"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink text-center focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            />
          </div>
        </div>

        {/* Район Минска */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider px-1 flex items-center gap-1">
            <MapPin size={12} className="text-zine-terracotta" />
            <span>Где ты чаще бываешь в Минске?</span>
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink font-medium focus:outline-none focus:border-zine-terracotta shadow-zine-sm cursor-pointer"
          >
            {MINSK_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Цели встреч */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
              Что интересно? (мультивыбор) *
            </label>
            <span className="text-[10px] text-zine-inkMuted font-medium">
              выбрано {selectedGoals.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(GOALS_CONFIG) as ActivityGoal[]).map((key) => {
              const item = GOALS_CONFIG[key];
              const isSelected = selectedGoals.includes(key);

              return (
                <div
                  key={key}
                  onClick={() => toggleGoal(key)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between shadow-zine-sm active:scale-[0.98] ${
                    isSelected
                      ? `${item.badgeBg} ${item.badgeBorder} ring-1 ring-zine-terracotta/40`
                      : 'bg-zine-cardElevated border-zine-border opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.emoji}</span>
                    <span className={`text-[11px] font-bold ${isSelected ? item.badgeText : 'text-zine-ink'}`}>
                      {item.label}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-zine-terracotta text-white flex items-center justify-center shrink-0">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* О себе */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
              О себе (до 200 символов)
            </label>
            <span
              className={`text-[10px] font-medium ${
                bio.length > 180 ? 'text-zine-terracotta font-bold' : 'text-zine-inkMuted'
              }`}
            >
              {bio.length}/200
            </span>
          </div>

          <textarea
            rows={3}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Люблю архитектуру конструктивизма, спешелти кофе на Киселёва и неспешные прогулки вдоль Свислочи..."
            className="w-full px-3 py-2 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink leading-relaxed focus:outline-none focus:border-zine-terracotta shadow-zine-sm resize-none"
          />

          <p className="text-[10px] text-zine-inkMuted leading-tight px-1 flex items-center gap-1">
            <Sparkles size={11} className="text-zine-mustard shrink-0" />
            <span>Напиши, о чем любишь говорить или куда хочешь сходить в городе.</span>
          </p>
        </div>

      </div>

      {/* Кнопка Сохранить */}
      <div className="pt-2 pb-1 shrink-0">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3.5 px-5 rounded-2xl bg-zine-terracotta hover:bg-zine-terracottaHover disabled:opacity-70 text-white font-semibold text-xs tracking-wide shadow-zine active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Сохраняем на сервере...</span>
            </>
          ) : (
            <>
              <span>{isFirstTime ? 'Сохранить и открыть карту Минска' : 'Сохранить изменения'}</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
