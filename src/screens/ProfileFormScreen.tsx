import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, ArrowLeft, Upload, Link as LinkIcon, Loader2, Navigation, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, Gender, PreferredGender, GoesWith, GOES_WITH, DigestFrequency, DIGEST_OPTIONS, TOURIST_AREA, isTouristArea, EMPATH, formatTime } from '../types';
import { HelpLine } from '../components/common/HelpLine';
import { telegramService, ThemePreference } from '../services/telegram';
import { compressImage, dataUrlBytes } from '../utils/compressImage';
import { PhotoPicker, PickedPhoto, photoFromUrl } from '../components/common/PhotoPicker';
import { PHOTO_TEXTS } from '../texts/photos';
import { AGE_TEXTS } from '../texts/profile';
import { HiddenPlaces } from '../components/places/HiddenPlaces';
import { useBackButton, useClosingConfirmation, useMainButton } from '../hooks/useTelegram';

interface ProfileFormScreenProps {
  initialData?: {
    name?: string;
    age?: string | number;
    ageConfirmed?: boolean;
    gender?: Gender;
    preferredGender?: PreferredGender;
    preferredAgeRange?: { min: number; max: number };
    bio?: string;
    goals?: ActivityGoal[];
    goal?: ActivityGoal;
    customGoal?: string;
    goesWith?: GoesWith;
    digest?: DigestFrequency;
    isEmpath?: boolean;
    ventUntil?: string | null;
    avatarUrl?: string;
    area?: string;
    isTourist?: boolean;
    isProfileActive?: boolean;
    isGuide?: boolean;
    guideAbout?: string;
    coordinates?: [number, number];
    photos?: string[];
  };
  onSave: (data: {
    name: string;
    age: string;
    ageConfirmed?: boolean;
    gender: Gender;
    preferredGender: PreferredGender;
    preferredAgeRange: { min: number; max: number };
    bio: string;
    goals: ActivityGoal[];
    goal: ActivityGoal;
    customGoal: string;
    goesWith?: GoesWith;
    digest: DigestFrequency;
    isEmpath: boolean;
    avatarUrl?: string;
    photos: string[]; // id ещё до 5 фото
    area: string;
    isTourist: boolean;
    isProfileActive: boolean;
    isGuide: boolean;
    guideAbout: string;
    coordinates?: [number, number];
  }) => Promise<void> | void;
  onBack?: () => void;
  onSetVent?: (hours: number) => Promise<void>; // «🫂 Хочется поныть» — включается сразу, без «Сохранить»
  isFirstTime?: boolean;
  onPlacesChanged?: () => void; // вернули скрытое место — обновить список мест
  onEventsChanged?: () => void; // вернули скрытую сходку — обновить список сходок
}

const MINSK_AREAS = [
  TOURIST_AREA,
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
  isFirstTime = false,
  onPlacesChanged,
  onEventsChanged,
  onSetVent
}) => {
  const tgUser = telegramService.getUser();

  const [name, setName] = useState<string>(
    initialData?.name || tgUser?.first_name || ''
  );
  // Возраст по умолчанию (25) не подставляем: человек должен указать сам
  const [age, setAge] = useState<string>(initialData?.ageConfirmed && initialData?.age ? String(initialData.age) : '');
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
    initialData?.preferredAgeRange?.max || 99
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
  const [customGoal, setCustomGoal] = useState<string>(initialData?.customGoal || '');
  const [goesWith, setGoesWith] = useState<GoesWith | undefined>(initialData?.goesWith);
  const [digest, setDigest] = useState<DigestFrequency>(initialData?.digest || 'weekend');
  const [isEmpath, setIsEmpath] = useState<boolean>(Boolean(initialData?.isEmpath));
  const [isVentBusy, setIsVentBusy] = useState(false);
  const isVenting = Boolean(initialData?.ventUntil && new Date(initialData.ventUntil).getTime() > Date.now());
  const [avatarUrl, setAvatarUrl] = useState<string>(
    initialData?.avatarUrl || tgUser?.photo_url || DEFAULT_AVATAR
  );
  // Старое тяжёлое фото (загружено до сжатия) пережимаем — иначе анкета не сохранится
  useEffect(() => {
    if (!avatarUrl.startsWith('data:') || dataUrlBytes(avatarUrl) <= 400 * 1024) return;
    compressImage(avatarUrl).then(setAvatarUrl).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [area, setArea] = useState<string>(
    isTouristArea(initialData?.area) ? TOURIST_AREA : initialData?.area || 'Немига / Центр'
  );
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>(
    initialData?.coordinates
  );

  const [isProfileActive, setIsProfileActive] = useState<boolean>(
    initialData?.isProfileActive !== false
  );

  const [isGuide, setIsGuide] = useState<boolean>(Boolean(initialData?.isGuide));
  const [guideAbout, setGuideAbout] = useState<string>(initialData?.guideAbout || '');
  const [justSaved, setJustSaved] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(() => telegramService.getThemePreference());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Несохранённый текст — Telegram переспросит перед закрытием
  const isDirty =
    name !== (initialData?.name || tgUser?.first_name || '') ||
    bio !== (initialData?.bio || '') ||
    customGoal !== (initialData?.customGoal || '') ||
    guideAbout !== (initialData?.guideAbout || '');
  useClosingConfirmation(isFirstTime || isDirty);

  useBackButton(!isFirstTime && onBack ? onBack : null);
  const hasNativeSave = useMainButton({
    text: justSaved ? 'Сохранено ✓' : isFirstTime ? 'Готово, на карту!' : 'Сохранить',
    onClick: () => handleSave(),
    loading: isSaving
  });

  // Определение геолокации по GPS
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      telegramService.alert('Геолокация не поддерживается вашим браузером');
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
        telegramService.alert('Не удалось получить точные координаты. Проверьте разрешение геолокации.');
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

  // Переключатели и выбор района сохраняются сразу — как «Хочется поныть» и тема. Текст — по кнопке
  // Ещё до 5 фото: сохраняются сами, как и настройки ниже
  const [photos, setPhotos] = useState<PickedPhoto[]>((initialData?.photos || []).map(photoFromUrl));
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const photoIds = photos.map((p) => p.id).filter(Boolean);

  const settingsSnapshot = JSON.stringify([isEmpath, goesWith, area, digest, isGuide, isProfileActive, isPhotoUploading ? null : photoIds]);
  const lastSavedSettings = useRef(settingsSnapshot);
  useEffect(() => {
    if (isFirstTime || settingsSnapshot === lastSavedSettings.current) return;
    const timer = setTimeout(() => {
      lastSavedSettings.current = settingsSnapshot;
      handleSave(true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSnapshot]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // чтобы можно было выбрать то же фото ещё раз
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorText('Выбери файл с фотографией (JPG или PNG)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorText('Фото слишком большое, выбери другое (до 25 МБ)');
      return;
    }

    setIsUploading(true);
    setErrorText(null);
    try {
      // Сжимаем фото, чтобы анкета быстро грузилась и не переполняла базу
      setAvatarUrl(await compressImage(file));
      telegramService.haptic('success');
    } catch {
      setErrorText('Не получилось обработать фото. Попробуй другое');
    } finally {
      setIsUploading(false);
    }
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

  // silent — автосохранение переключателей: без вибрации «успеха», но ошибки показываем
  const handleSave = async (silent = false) => {
    setErrorText(null);
    if (isPhotoUploading && !silent) {
      setErrorText(PHOTO_TEXTS.wait);
      return;
    }

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

    if (!age.trim()) {
      setErrorText(AGE_TEXTS.required);
      telegramService.haptic('warning');
      return;
    }

    if (Number(age) < 18) {
      setErrorText(AGE_TEXTS.under18);
      telegramService.haptic('warning');
      return;
    }

    if (selectedGoals.includes('other') && !customGoal.trim()) {
      setErrorText('Напиши свою идею, например «Караоке»');
      telegramService.haptic('warning');
      return;
    }

    setIsSaving(true);

    try {
      const isTourist = isTouristArea(area);

      await onSave({
        name: name.trim(),
        age: age.trim(),
        ageConfirmed: true,
        gender,
        preferredGender,
        preferredAgeRange: {
          min: Number(minAge) || 18,
          max: Number(maxAge) || 99
        },
        bio: bio.trim(),
        goals: selectedGoals,
        goal: selectedGoals[0],
        customGoal: selectedGoals.includes('other') ? customGoal.trim() : '',
        goesWith,
        digest,
        isEmpath,
        // Фото отправляем, только если оно новое — иначе каждое переключение настроек гоняло бы его на сервер
        avatarUrl: avatarUrl !== initialData?.avatarUrl ? avatarUrl : undefined,
        photos: photoIds,
        area,
        isTourist,
        isProfileActive,
        isGuide: isGuide && !isTourist,
        guideAbout: guideAbout.trim(),
        coordinates
      });
      telegramService.haptic(silent ? 'light' : 'success');
      if (!isFirstTime) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch (err: any) {
      setErrorText(err.message || 'Ошибка сохранения профиля на сервере');
      telegramService.haptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6">
        <div className="flex items-center gap-2">
          {!isFirstTime && onBack && !telegramService.isInsideTelegram() && (
            <button
              onClick={() => {
                telegramService.haptic('light');
                onBack();
              }}
              aria-label="Назад"
              className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="font-serif font-bold text-display text-zine-ink">
            {isFirstTime ? 'Расскажи о себе' : 'Моя анкета'}
          </h1>
        </div>
        {isFirstTime && (
          <p className="mt-2 text-body text-zine-inkMuted">Пара минут, и тебя увидят люди рядом.</p>
        )}

        {!isFirstTime && (
          <button
            type="button"
            onClick={() => {
              telegramService.haptic('selection');
              telegramService.shareApp();
            }}
            className="mt-4 w-full p-4 rounded-zine bg-zine-terracotta/10 border border-zine-terracotta/25 flex items-center gap-3 text-left cursor-pointer"
          >
            <span className="text-[28px] leading-none">💌</span>
            <span>
              <span className="block text-body font-bold text-zine-ink">Позвать друзей</span>
              <span className="block text-sm2 text-zine-inkMuted">Чем больше знакомых рядом, тем проще найти компанию</span>
            </span>
          </button>
        )}


        <div className="mt-5 space-y-4">
          {/* Фото */}
          <Section>
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer"
                aria-label="Сменить фото"
              >
                <img src={avatarUrl} alt={name} className="w-28 h-28 rounded-full object-cover border-4 border-zine-cardElevated shadow-zine" />
                <span className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-zine-terracotta text-white flex items-center justify-center border-4 border-zine-cardElevated">
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

              <div className="grid grid-cols-2 gap-2 w-full mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload size={18} />
                  <span>Загрузить фото</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LinkIcon size={18} />
                  <span>По ссылке</span>
                </button>
              </div>

              {showUrlInput && (
                <div className="w-full mt-2 flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://… ссылка на фото"
                    className="field flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="h-12 px-5 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
                  >
                    ОК
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* Ещё до 5 фото */}
          <Section title={PHOTO_TEXTS.profileTitle} subtitle={PHOTO_TEXTS.profileHint}>
            <PhotoPicker value={photos} onChange={setPhotos} onBusyChange={setIsPhotoUploading} showCover={false} />
          </Section>

          {/* Имя, возраст, о себе */}
          <Section>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Label text="Имя">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как тебя зовут?" className="field" />
              </Label>
              <Label text="Возраст">
                <input
                  type="number"
                  inputMode="numeric"
                  min="18"
                  max="99"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={AGE_TEXTS.placeholder}
                  className={`field text-center ${age.trim() ? '' : 'ring-2 ring-zine-terracotta/60'}`}
                />
              </Label>
            </div>
            {!age.trim() && <p className="mt-2 text-cap font-semibold text-zine-terracotta">{AGE_TEXTS.required}</p>}

            <div className="mt-4">
              <Label text="О себе" hint={`${bio.length}/200`}>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Люблю спешелти кофе на Киселёва и неспешные прогулки вдоль Свислочи"
                  className="field"
                />
              </Label>
            </div>
          </Section>

          {/* Цели */}
          <Section title="Что тебе интересно?" subtitle="Можно выбрать несколько">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GOALS_CONFIG) as ActivityGoal[]).filter((key) => key !== 'other').map((key) => {
                const item = GOALS_CONFIG[key];
                const isSelected = selectedGoals.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => toggleGoal(key)}
                    className={`relative min-h-[76px] p-3 rounded-zine-sm border-2 text-left flex flex-col justify-between gap-1 transition-colors cursor-pointer ${
                      isSelected ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
                    }`}
                  >
                    <span className="text-[24px] leading-none">{item.emoji}</span>
                    <span className="text-sm2 font-semibold text-zine-ink leading-tight">{item.label}</span>
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-zine-terracotta text-white flex items-center justify-center">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Своя идея: человек сам пишет, что ему интересно */}
            <button
              type="button"
              onClick={() => toggleGoal('other')}
              className={`relative mt-2 w-full h-14 px-3 rounded-zine-sm border-2 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                selectedGoals.includes('other') ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-dashed border-zine-border bg-zine-cardElevated'
              }`}
            >
              <span className="text-[24px] leading-none">✨</span>
              <span className="text-sm2 font-semibold text-zine-ink">Своя идея: впиши свою</span>
              {selectedGoals.includes('other') && (
                <span className="absolute top-1/2 -translate-y-1/2 right-3 w-6 h-6 rounded-full bg-zine-terracotta text-white flex items-center justify-center">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
            {selectedGoals.includes('other') && (
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value.slice(0, 30))}
                placeholder="Караоке, йога, квизы…"
                className="field mt-2"
              />
            )}
          </Section>

          {/* Обычно хожу: без компании, парой, компанией, с детьми */}
          <Section title="Обычно хожу" subtitle="Так проще найти тех, кто ходит так же">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GOES_WITH) as GoesWith[]).map((g) => {
                const isSelected = goesWith === g;
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setGoesWith(isSelected ? undefined : g);
                    }}
                    className={`min-h-[56px] px-3 rounded-zine-sm border-2 flex items-center gap-2 text-left transition-colors cursor-pointer ${
                      isSelected ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
                    }`}
                  >
                    <span className="text-[22px] leading-none">{GOES_WITH[g].emoji}</span>
                    <span className="text-sm2 font-semibold text-zine-ink leading-tight">{GOES_WITH[g].label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Район */}
          <Section title="Где ты в Минске?" subtitle="Точный адрес никто не увидит: метка смещается на 300-500 м">
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                telegramService.haptic('selection');
              }}
              className="field"
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
              className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLocating ? <Loader2 size={18} className="animate-spin text-zine-terracotta" /> : <Navigation size={18} className="text-zine-terracotta" />}
              <span>{isLocating ? 'Определяем…' : coordinates ? 'Место определено ✓ Обновить' : 'Определить по GPS'}</span>
            </button>
          </Section>

          {/* «🫶 Эмпат» — отмечает сам человек; бейдж видно на карточке */}
          <Section>
            <button
              type="button"
              onClick={() => {
                telegramService.haptic('selection');
                setIsEmpath((v) => !v);
              }}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <span>
                <span className="block text-body font-bold text-zine-ink">
                  {EMPATH.emoji} Я {EMPATH.label.toLowerCase()}
                </span>
                <span className="block text-sm2 text-zine-inkMuted">Умею слушать и поддерживать. Это увидят на твоей карточке</span>
              </span>
              <span className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${isEmpath ? 'bg-zine-terracotta' : 'bg-zine-border'}`}>
                <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${isEmpath ? 'translate-x-6' : 'translate-x-0'}`} />
              </span>
            </button>
          </Section>

          {/* «🫂 Хочется поныть» — статус на 3 часа, видят только эмпаты */}
          {!isFirstTime && onSetVent && (
            <Section>
              <p className="text-body font-bold text-zine-ink">🫂 Хочется поныть</p>
              <p className="mt-0.5 text-sm2 text-zine-inkMuted">
                {isVenting
                  ? `Включено до ${formatTime(initialData?.ventUntil)}. Эмпаты рядом видят это и могут передать тебе 👋`
                  : 'Эмпаты рядом увидят и смогут передать тебе 👋. Статус выключится сам через 3 часа'}
              </p>
              <button
                type="button"
                disabled={isVentBusy}
                onClick={async () => {
                  telegramService.haptic('medium');
                  setIsVentBusy(true);
                  try {
                    await onSetVent(isVenting ? 0 : 3);
                  } finally {
                    setIsVentBusy(false);
                  }
                }}
                className={`mt-3 w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform ${
                  isVenting ? 'bg-zine-card text-zine-ink' : 'bg-zine-blush/25 text-zine-ink'
                }`}
              >
                {isVentBusy ? <Loader2 size={20} className="animate-spin" /> : isVenting ? 'Выключить' : '🫂 Включить на 3 часа'}
              </button>
              <HelpLine className="mt-3 !text-cap !text-zine-inkMuted" />
            </Section>
          )}

          {/* «🧭 Покажу город» — только для местных */}
          {!isTouristArea(area) && (
            <Section>
              <button
                type="button"
                onClick={() => {
                  telegramService.haptic('selection');
                  setIsGuide((v) => !v);
                }}
                className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <span>
                  <span className="block text-body font-bold text-zine-ink">🧭 Покажу город</span>
                  <span className="block text-sm2 text-zine-inkMuted">Туристы увидят, что ты можешь показать им Минск</span>
                </span>
                <span className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${isGuide ? 'bg-zine-sky' : 'bg-zine-border'}`}>
                  <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${isGuide ? 'translate-x-6' : 'translate-x-0'}`} />
                </span>
              </button>

              {isGuide && (
                <div className="mt-4">
                  <p className="mb-3 p-3 rounded-zine-sm bg-zine-sky/10 text-sm2 text-zine-ink">
                    Это бесплатно, по желанию. Обо всех условиях прогулки договаривайтесь лично.
                  </p>
                  <Label text="Что можешь показать?" hint={`${guideAbout.length}/140`}>
                    <textarea
                      rows={2}
                      maxLength={140}
                      value={guideAbout}
                      onChange={(e) => setGuideAbout(e.target.value)}
                      placeholder="Верхний город, кофейни на Октябрьской, граффити на Зыбицкой"
                      className="field"
                    />
                  </Label>
                </div>
              )}
            </Section>
          )}

          {/* Видимость анкеты (режим невидимки) */}
          {!isFirstTime && (
            <button
              type="button"
              onClick={() => {
                telegramService.haptic('selection');
                setIsProfileActive((v) => !v);
              }}
              className={`w-full p-4 rounded-zine border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                isProfileActive ? 'bg-zine-cardElevated border-zine-border' : 'bg-zine-plum/10 border-zine-plum/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {isProfileActive ? <Eye size={26} className="text-zine-sage shrink-0" /> : <EyeOff size={26} className="text-zine-plum shrink-0" />}
                <div>
                  <p className="text-body font-bold text-zine-ink">{isProfileActive ? 'Меня видно на карте' : 'Режим невидимки'}</p>
                  <p className="text-sm2 text-zine-inkMuted">
                    {isProfileActive ? 'Другие видят твою анкету' : 'Тебя не видно, но ты видишь других и можешь передавать привет'}
                  </p>
                </div>
              </div>
              <div className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${isProfileActive ? 'bg-zine-sage' : 'bg-zine-border'}`}>
                <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${isProfileActive ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </button>
          )}

          {/* Подборки от бота */}
          {!isFirstTime && (
            <Section title="Подборки" subtitle="Бот пришлёт сходки и места. Как часто?">
              <div className="space-y-2">
                {(Object.keys(DIGEST_OPTIONS) as DigestFrequency[]).map((d) => {
                  const isSelected = digest === d;
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setDigest(d);
                      }}
                      className={`w-full min-h-[52px] px-3.5 rounded-zine-sm border-2 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        isSelected ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
                      }`}
                    >
                      <span className="text-[22px] leading-none">{DIGEST_OPTIONS[d].emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-body font-semibold text-zine-ink">{DIGEST_OPTIONS[d].label}</span>
                        <span className="text-sm2 text-zine-inkMuted"> · {DIGEST_OPTIONS[d].hint}</span>
                      </span>
                      <span
                        className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-zine-terracotta bg-zine-terracotta' : 'border-zine-border'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Скрытые места и сходки — можно вернуть в ленту */}
          {!isFirstTime && <HiddenPlaces onRestored={() => onPlacesChanged?.()} onEventsRestored={() => onEventsChanged?.()} />}

          {/* Безопасность: 18+ и куда обращаться */}
          {!isFirstTime && (
            <Section title="🔞 Только 18+">
              <p className="text-sm2 text-zine-ink">Если замечаешь человека младше 18, пожалуйся на анкету, администрация проверит.</p>
              <HelpLine className="mt-2" />
            </Section>
          )}

          {/* Тема оформления — применяется сразу */}
          {!isFirstTime && (
            <Section title="Тема оформления" subtitle="«Авто»: как в Telegram">
              <Segmented
                value={themePref}
                onChange={(v) => {
                  setThemePref(v as ThemePreference);
                  telegramService.setThemePreference(v as ThemePreference);
                }}
                options={[
                  { id: 'auto', label: '📱 Авто' },
                  { id: 'light', label: '☀️ Светлая' },
                  { id: 'dark', label: '🌙 Тёмная' }
                ]}
              />
            </Section>
          )}

          {/* Дополнительно: пол и предпочтения */}
          <Section>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <span>
                <span className="block text-body font-bold text-zine-ink">Дополнительно</span>
                <span className="block text-sm2 text-zine-inkMuted">Пол, с кем комфортно, возраст компании</span>
              </span>
              <ChevronDown size={24} className={`text-zine-inkMuted transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <p className="p-3 rounded-zine-sm bg-zine-card text-sm2 text-zine-ink">
                  🛡 Тебя увидят только те, кто подходит под «С кем комфортно» и «Возраст компании». Остальным твоя анкета не покажется.
                </p>
                <Label text="Я">
                  <Segmented
                    value={gender}
                    onChange={(v) => setGender(v as Gender)}
                    options={[
                      { id: 'male', label: 'Мужчина' },
                      { id: 'female', label: 'Женщина' },
                      { id: 'not_specified', label: 'Не скажу' }
                    ]}
                  />
                </Label>
                <Label text="С кем комфортно встречаться">
                  <Segmented
                    value={preferredGender}
                    onChange={(v) => setPreferredGender(v as PreferredGender)}
                    options={[
                      { id: 'all', label: 'Со всеми' },
                      { id: 'female', label: 'С женщинами' },
                      { id: 'male', label: 'С мужчинами' }
                    ]}
                  />
                </Label>
                <Label text="Возраст компании" hint={`от ${minAge} до ${maxAge}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="18"
                      max={maxAge}
                      value={minAge}
                      onChange={(e) => setMinAge(Number(e.target.value) || 18)}
                      className="field text-center"
                    />
                    <span className="text-body text-zine-inkMuted">-</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={minAge}
                      max="99"
                      value={maxAge}
                      onChange={(e) => setMaxAge(Number(e.target.value) || 99)}
                      className="field text-center"
                    />
                  </div>
                </Label>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Кнопка «Сохранить» всегда под рукой: в Telegram — нативная MainButton, в браузере — своя */}
      {(errorText || !hasNativeSave) && (
      <div className="shrink-0 px-5 pt-3 pb-3 bg-zine-paper border-t border-zine-border">
        {/* Ошибка — прямо у кнопки, чтобы её было видно */}
        {errorText && <p className="mb-2 p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">⚠️ {errorText}</p>}
        {!hasNativeSave && (
        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className={`w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center gap-2 shadow-zine-sm active:scale-[0.99] transition-all cursor-pointer ${
            justSaved ? 'bg-zine-sage text-white' : 'bg-zine-terracotta active:bg-zine-terracottaHover text-white'
          }`}
        >
          {isSaving ? (
            <Loader2 size={22} className="animate-spin" />
          ) : justSaved ? (
            <>
              <Check size={22} strokeWidth={3} />
              <span>Сохранено</span>
            </>
          ) : (
            <span>{isFirstTime ? 'Готово, на карту!' : 'Сохранить'}</span>
          )}
        </button>
        )}
      </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title?: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="p-4 rounded-zine bg-zine-cardElevated border border-zine-border">
    {title && <h2 className="text-body font-bold text-zine-ink">{title}</h2>}
    {subtitle && <p className="text-sm2 text-zine-inkMuted mt-0.5">{subtitle}</p>}
    <div className={title ? 'mt-3' : ''}>{children}</div>
  </section>
);

const Label: React.FC<{ text: string; hint?: string; children: React.ReactNode }> = ({ text, hint, children }) => (
  <label className="block">
    <span className="flex items-baseline justify-between mb-2">
      <span className="text-sm2 font-bold text-zine-ink">{text}</span>
      {hint && <span className="text-cap text-zine-inkMuted">{hint}</span>}
    </span>
    {children}
  </label>
);

const Segmented: React.FC<{ value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }> = ({ value, onChange, options }) => (
  <div className="grid grid-cols-3 gap-1 p-1 rounded-zine-sm bg-zine-card">
    {options.map((o) => (
      <button
        type="button"
        key={o.id}
        onClick={() => {
          telegramService.haptic('selection');
          onChange(o.id);
        }}
        className={`h-11 rounded-[11px] text-sm2 font-semibold transition-all cursor-pointer ${
          value === o.id ? 'bg-zine-cardElevated text-zine-ink shadow-zine-sm' : 'text-zine-inkMuted'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default ProfileFormScreen;
