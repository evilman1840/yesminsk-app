import React, { useState, useRef } from 'react';
import { Camera, Check, Sparkles, MapPin, ArrowLeft, Upload, Link as LinkIcon, Loader2, Navigation, Eye, EyeOff } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, Gender, PreferredGender } from '../types';
import { telegramService } from '../services/telegram';

interface ProfileFormScreenProps {
  initialData?: {
    name?: string;
    age?: string | number;
    gender?: Gender;
    preferredGender?: PreferredGender;
    preferredAgeRange?: { min: number; max: number };
    bio?: string;
    goals?: ActivityGoal[];
    goal?: ActivityGoal;
    avatarUrl?: string;
    area?: string;
    isTourist?: boolean;
    isProfileActive?: boolean;
    coordinates?: [number, number];
  };
  onSave: (data: {
    name: string;
    age: string;
    gender: Gender;
    preferredGender: PreferredGender;
    preferredAgeRange: { min: number; max: number };
    bio: string;
    goals: ActivityGoal[];
    goal: ActivityGoal;
    avatarUrl: string;
    area: string;
    isTourist: boolean;
    isProfileActive: boolean;
    coordinates?: [number, number];
  }) => Promise<void> | void;
  onBack?: () => void;
  isFirstTime?: boolean;
}

const MINSK_AREAS = [
  'Я турист(ка) / не знаю города',
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

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

export const ProfileFormScreen: React.FC<ProfileFormScreenProps> = ({
  initialData,
  onSave,
  onBack,
  isFirstTime = false
}) => {
  const tgUser = telegramService.getUser();

  const [name, setName] = useState<string>(
    initialData?.name || tgUser?.first_name || ''
  );
  const [age, setAge] = useState<string>(
    initialData?.age ? String(initialData.age) : '25'
  );
  const [gender, setGender] = useState<Gender>(
    initialData?.gender || 'not_specified'
  );
  const [preferredGender, setPreferredGender] = useState<PreferredGender>(
    initialData?.preferredGender || 'all'
  );
  const [minAge, setMinAge] = useState<number>(
    initialData?.preferredAgeRange?.min || 18
  );
  const [maxAge, setMaxAge] = useState<number>(
    initialData?.preferredAgeRange?.max || 45
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
    initialData?.avatarUrl || tgUser?.photo_url || DEFAULT_AVATAR
  );
  const [area, setArea] = useState<string>(
    initialData?.area || 'Немига / Центр'
  );
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>(
    initialData?.coordinates
  );

  const [isProfileActive, setIsProfileActive] = useState<boolean>(
    initialData?.isProfileActive !== false
  );

  const [isLocating, setIsLocating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Определение геолокации по GPS
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    telegramService.haptic('selection');
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userLat = Number(pos.coords.latitude.toFixed(6));
        const userLng = Number(pos.coords.longitude.toFixed(6));
        setCoordinates([userLat, userLng]);
        telegramService.haptic('success');
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS error:', err);
        alert('Не удалось получить точные координаты. Проверьте разрешение геолокации.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorText('Пожалуйста, выбери файл изображения (JPG, PNG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorText('Размер изображения не должен превышать 5 МБ');
      return;
    }

    setIsUploading(true);
    setErrorText(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAvatarUrl(base64);
      setIsUploading(false);
      telegramService.haptic('success');
    };
    reader.onerror = () => {
      setIsUploading(false);
      setErrorText('Ошибка при чтении файла');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (!customUrl.trim()) return;
    try {
      new URL(customUrl.trim());
      setAvatarUrl(customUrl.trim());
      setShowUrlInput(false);
      setCustomUrl('');
      telegramService.haptic('success');
    } catch {
      setErrorText('Укажи корректную ссылку на изображение (с http:// или https://)');
    }
  };

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
      const isTourist = area.includes('турист');

      await onSave({
        name: name.trim(),
        age: age.trim() || '25',
        gender,
        preferredGender,
        preferredAgeRange: {
          min: Number(minAge) || 18,
          max: Number(maxAge) || 99
        },
        bio: bio.trim(),
        goals: selectedGoals,
        goal: selectedGoals[0],
        avatarUrl,
        area,
        isTourist,
        isProfileActive,
        coordinates
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
      
      {/* Шапка экрана */}
      <div className="flex items-center justify-between pb-3 border-b border-zine-border shrink-0">
        <div className="flex items-center gap-2">
          {!isFirstTime && onBack && (
            <button
              onClick={() => {
                telegramService.haptic('light');
                onBack();
              }}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-200/60 active:scale-95 transition-all text-zine-ink cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="font-serif font-bold text-lg text-zine-ink tracking-tight">
            {isFirstTime ? 'Создание анкеты' : 'Мой профиль'}
          </h2>
        </div>

        <span className="text-[10px] font-semibold tracking-wider text-zine-terracotta bg-zine-terracotta/10 px-2.5 py-1 rounded-full uppercase">
          {isFirstTime ? 'Шаг 1 из 1' : 'Редактирование'}
        </span>
      </div>

      {errorText && (
        <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in">
          ⚠️ {errorText}
        </div>
      )}

      <div className="space-y-4 py-4 flex-1">
        
        {/* Аватарка (без пресетов — только загрузка и ссылка) */}
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
                Загрузи своё фото или укажи прямую ссылку на изображение.
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
                  className="px-2.5 py-1 rounded-lg bg-zine-cardElevated border border-zine-border text-[10.5px] font-semibold text-zine-ink hover:text-zine-terracotta flex items-center gap-1 shadow-zine-sm cursor-pointer active:scale-95 transition-transform"
                >
                  <Upload size={11} />
                  <span>Загрузить фото</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-2.5 py-1 rounded-lg bg-zine-cardElevated border border-zine-border text-[10.5px] font-semibold text-zine-ink hover:text-zine-terracotta flex items-center gap-1 shadow-zine-sm cursor-pointer active:scale-95 transition-transform"
                >
                  <LinkIcon size={11} />
                  <span>По ссылке</span>
                </button>
              </div>
            </div>
          </div>

          {showUrlInput && (
            <div className="mt-3 pt-3 border-t border-zine-border/60 flex gap-1.5 animate-in fade-in">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Вставь прямую ссылку https://... на фото"
                className="flex-1 px-3 py-1.5 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta"
              />
              <button
                type="button"
                onClick={handleApplyCustomUrl}
                className="px-3 py-1.5 rounded-xl bg-zine-terracotta text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
              >
                ОК
              </button>
            </div>
          )}
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
              placeholder="Как тебя зовут?"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
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
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zine-cardElevated border border-zine-border text-xs text-center text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            />
          </div>
        </div>

        {/* Пол и Предпочтения для общения */}
        <div className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider block mb-1.5">
              Мой пол
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'male', label: 'Парень' },
                { id: 'female', label: 'Девушка' },
                { id: 'not_specified', label: 'Не важно' }
              ].map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => {
                    telegramService.haptic('selection');
                    setGender(g.id as Gender);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer text-center ${
                    gender === g.id
                      ? 'bg-zine-terracotta text-white border-zine-terracotta shadow-sm'
                      : 'bg-zine-cardElevated text-zinc-700 border-zine-border hover:bg-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zine-border/50">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider block mb-1.5">
              С кем комфортно гулять
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'all', label: 'Со всеми' },
                { id: 'female', label: 'С девушками' },
                { id: 'male', label: 'С парнями' }
              ].map((pg) => (
                <button
                  type="button"
                  key={pg.id}
                  onClick={() => {
                    telegramService.haptic('selection');
                    setPreferredGender(pg.id as PreferredGender);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer text-center ${
                    preferredGender === pg.id
                      ? 'bg-zinc-800 text-white border-zinc-800 shadow-sm'
                      : 'bg-zine-cardElevated text-zinc-700 border-zine-border hover:bg-white'
                  }`}
                >
                  {pg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zine-border/50">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                Возраст компании
              </label>
              <span className="text-[10px] text-zine-terracotta font-bold">
                от {minAge} до {maxAge} лет
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="16"
                max={maxAge}
                value={minAge}
                onChange={(e) => setMinAge(Number(e.target.value) || 16)}
                className="w-1/2 px-2.5 py-1.5 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-center text-zine-ink focus:outline-none focus:border-zine-terracotta"
                placeholder="18"
              />
              <span className="text-zinc-400 text-xs">—</span>
              <input
                type="number"
                min={minAge}
                max="99"
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value) || 99)}
                className="w-1/2 px-2.5 py-1.5 rounded-xl bg-zine-cardElevated border border-zine-border text-xs text-center text-zine-ink focus:outline-none focus:border-zine-terracotta"
                placeholder="45"
              />
            </div>
          </div>
        </div>

        {/* Район города + GPS */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider flex items-center gap-1">
              <MapPin size={12} className="text-zine-terracotta" />
              <span>Твой район в Минске</span>
            </label>
            {coordinates && (
              <span className="text-[9.5px] text-zinc-500 font-medium">
                GPS зафиксирован ✓
              </span>
            )}
          </div>

          <div className="space-y-2">
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                telegramService.haptic('selection');
              }}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zine-cardElevated border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
            >
              {MINSK_AREAS.map((a, idx) => (
                <option key={a} value={a}>
                  {idx === 0 ? `🧳 ${a}` : a}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleGetGPS}
              disabled={isLocating}
              className="w-full py-2 px-3 rounded-xl bg-zine-cardElevated border border-zine-border hover:bg-white text-zine-ink font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Navigation size={12} className={isLocating ? 'animate-spin text-zine-terracotta' : 'text-zine-terracotta'} />
              <span>{isLocating ? 'Определяем координаты...' : 'Определить точнее по GPS'}</span>
            </button>
          </div>
        </div>

        {/* Цели встреч */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
              Что тебе интересно? (Цели) *
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

        {/* Видимость анкеты (режим невидимки) */}
        {!isFirstTime && (
          <div
            onClick={() => {
              telegramService.haptic('selection');
              setIsProfileActive((v) => !v);
            }}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 shadow-zine-sm active:scale-[0.99] ${
              isProfileActive
                ? 'bg-zine-cardElevated border-zine-border'
                : 'bg-[#F0EBF8] border-[#D9CFEA]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isProfileActive ? (
                <Eye size={18} className="text-zine-sage shrink-0" />
              ) : (
                <EyeOff size={18} className="text-[#6A4E9E] shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-[12px] font-bold text-zine-ink">
                  {isProfileActive ? 'Меня видно на карте' : 'Режим невидимки'}
                </span>
                <span className="text-[10px] text-zine-inkMuted leading-tight">
                  {isProfileActive
                    ? 'Другие видят твою анкету и могут написать'
                    : 'Анкета скрыта с карты и из ленты. Ты по-прежнему видишь других и можешь писать им'}
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                isProfileActive ? 'bg-zine-sage' : 'bg-zinc-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  isProfileActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        )}

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

export default ProfileFormScreen;
