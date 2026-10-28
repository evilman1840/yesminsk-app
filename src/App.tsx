import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { YMaps } from '@pbe/react-yandex-maps';
import { telegramService, ShareData, SHARE_EVENT } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { EventsScreen } from './screens/EventsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
import { AgePrompt } from './components/common/AgePrompt';
import { GenderPrompt } from './components/common/GenderPrompt';
import { ACCOUNT_TEXTS } from './texts/account';
import { AddToHomeSheet } from './components/common/AddToHomeSheet';
import { OpenUserContext } from './context/openUser';
import { askBotAccess, setBotAccessKnown, botAccessOk } from './services/botAccess';
import { WishMembersSheet } from './components/common/WishMembersSheet';
import { MatchModal, ReactionType } from './components/common/Reactions';
import { ServerWakingBanner } from './components/common/ServerWakingBanner';
import { TabBar, TabId } from './components/ui/TabBar';
import { BottomSheet } from './components/ui/BottomSheet';
import { EventDetails } from './components/common/EventDetails';
import { DonateSheet } from './components/common/DonateSheet';
import { NewsScreen } from './screens/NewsScreen';
import { PlacesScreen } from './screens/PlacesScreen';
import { FirstStepsCard } from './components/people/FirstSteps';
import { ShareSheet } from './components/common/ShareSheet';
import type { MapMode } from './screens/MapScreen';
import { NewsItem } from './services/api';
import { AREA_COORDINATES } from './config/areas';
import { LegalUpdateOverlay } from './components/common/Legal';
import { LEGAL_VERSION } from './texts/legal';
import { UserProfile, ActivityGoal, GoalFilter, AppEvent, PlaceItem, Gender, PreferredGender, AgeRange, EventCategory, JoinOptions, GoesWith, DigestFrequency, EventPayload, MeetupCreateRequest, placeForMeetup } from './types';
import { FEED_TEXTS } from './texts/feed';
import { loadBadgeSeenEvents, markBadgeSeenEvents } from './utils/seenEvents';


const getSavedCoordinates = (): [number, number] => {
  try {
    const saved = localStorage.getItem('yesminsk_user_coords');
    if (saved) {
      const p = JSON.parse(saved);
      if (Array.isArray(p) && p.length === 2 && !isNaN(p[0]) && p[0] > 40) {
        return [Number(p[0]), Number(p[1])];
      }
    }
  } catch (e) {}
  return AREA_COORDINATES['Немига / Центр'] || [53.9045, 27.5520];
};

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<
    'onboarding' | 'profile_create' | 'main' | 'feed' | 'events' | 'places' | 'news' | 'profile_edit' | 'banned' | 'deleted'
  >('main');

  const tgUser = telegramService.getUser();
  const [currentUser, setCurrentUser] = useState({
    telegramId: tgUser?.id || 0,
    name: tgUser?.first_name || '',
    username: tgUser?.username || '',
    age: '25',
    ageConfirmed: false, // человек сам указал возраст (25 стоит по умолчанию)
    profileCompleted: false, // указал возраст и интересы — только тогда анкету видят другие
    bio: '',
    gender: 'not_specified' as Gender,
    preferredGender: 'all' as PreferredGender,
    preferredAgeRange: { min: 18, max: 99 } as AgeRange,
    goals: ['walk'] as ActivityGoal[],
    goal: 'walk' as ActivityGoal,
    customGoal: '',
    goesWith: undefined as GoesWith | undefined,
    digest: 'weekend' as DigestFrequency,
    isEmpath: false,
    ventUntil: null as string | null,
    avatarUrl: tgUser?.photo_url || '',
    area: 'Немига / Центр',
    isTourist: false,
    isProfileActive: true,
    isGuide: false,
    guideAbout: '',
    photos: [] as string[],
    availableUntil: null as string | null,
    coordinates: getSavedCoordinates(),
    shownCoordinates: null as [number, number] | null, // где тебя видят другие (смещённая метка)
    locationManual: false, // метку поставили вручную
    legalVersion: '' as string, // какую редакцию Соглашения и Политики человек принял
    hasAgreedToRules: false,
    genderConfirmed: false // пол выбран самим человеком
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalFilter>('all');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  // Анкета пришла с сервера? До этого форму не показываем — иначе она заполнится пустыми значениями и «Сохранить» их перезапишет
  // Анкета с сервера получена. Пока нет — анкету не показываем и не сохраняем,
  // иначе значения по умолчанию (25 лет, пустое описание) затрут настоящие
  const [isMeLoaded, setIsMeLoaded] = useState(false);
  const [meFailed, setMeFailed] = useState(false);
  const isMeLoadedRef = useRef(false);
  useEffect(() => {
    isMeLoadedRef.current = isMeLoaded;
  }, [isMeLoaded]);
  const [isFirstStepsHidden, setIsFirstStepsHidden] = useState(() => {
    try {
      return localStorage.getItem('yesminsk_first_steps_hidden') === '1';
    } catch {
      return false;
    }
  });
  const [likedMe, setLikedMe] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<UserProfile[]>([]);
  const [matchPopupUser, setMatchPopupUser] = useState<UserProfile | null>(null);
  // Сходка, открытая по ссылке-приглашению или из уведомления бота
  const [sharedEvent, setSharedEvent] = useState<AppEvent | null>(null);

  // Новости проекта и счётчик непрочитанных
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(true);
  const [newsSeenAt, setNewsSeenAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('yesminsk_news_seen_at')) || 0;
    } catch {
      return 0;
    }
  });
  const [isDonateOpen, setIsDonateOpen] = useState(false);

  // Окно «Поделиться» (позвать друзей, позвать на сходку)
  const [shareData, setShareData] = useState<ShareData | null>(null);
  useEffect(() => {
    const onShare = (e: Event) => setShareData((e as CustomEvent<ShareData>).detail);
    window.addEventListener(SHARE_EVENT, onShare);
    return () => window.removeEventListener(SHARE_EVENT, onShare);
  }, []);

  // Места по вайбу
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  // Вкладка карты запоминается; при первом входе выбираем её сами после загрузки данных
  const [mapMode, setMapModeState] = useState<MapMode>(() => {
    try {
      const saved = localStorage.getItem('yesminsk_map_mode');
      return saved === 'all' || saved === 'people' || saved === 'events' || saved === 'places' ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  const setMapMode = (mode: MapMode) => {
    setMapModeState(mode);
    try {
      localStorage.setItem('yesminsk_map_mode', mode);
    } catch {
      // не страшно
    }
  };
  const [initialPlaceId, setInitialPlaceId] = useState<string | null>(null);
  // Открыть форму сходки: из карточки места, по ссылке из бота или поста
  const [isAgePromptDismissed, setIsAgePromptDismissed] = useState(false);
  // Пол выбран в окне «Кто ты?»: в анкету кладём, когда окно закроется (иначе оно исчезнет до шага 2)
  const [genderSavedInPrompt, setGenderSavedInPrompt] = useState<Gender | null>(null);
  // «Позже» в окне «Кто ты?» — не спрашиваем неделю
  const [isGenderPromptDismissed, setIsGenderPromptDismissed] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem('yesminsk_gender_later') || 0) < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });
  // Для openUserById: актуальные списки без пересоздания функции
  const usersRef = useRef<UserProfile[]>([]);
  const likedMeRef = useRef<UserProfile[]>([]);
  const matchesRef = useRef<UserProfile[]>([]);
  const currentUserIdRef = useRef<number>(0);
  usersRef.current = users;
  likedMeRef.current = likedMe;
  matchesRef.current = matches;
  currentUserIdRef.current = currentUser.telegramId;
  // Совет «добавь на экран телефона»: один раз, со второго открытия, если ещё не добавлено
  const [isHomeTipOpen, setIsHomeTipOpen] = useState(false);
  useEffect(() => {
    try {
      const launches = Number(localStorage.getItem('yesminsk_launches') || '0') + 1;
      localStorage.setItem('yesminsk_launches', String(launches));
      if (launches < 2 || localStorage.getItem('yesminsk_home_tip_shown')) return;
      telegramService.homeScreenStatus().then((status) => {
        if (status === 'added') return;
        window.setTimeout(() => setIsHomeTipOpen(true), 4000);
      });
    } catch (e) {}
  }, []);
  const closeHomeTip = () => {
    setIsHomeTipOpen(false);
    try {
      localStorage.setItem('yesminsk_home_tip_shown', '1');
    } catch (e) {}
  };
  const [pendingWish, setPendingWish] = useState<{ placeId?: string } | null>(null);
  const [wishMembersGroup, setWishMembersGroup] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<MeetupCreateRequest | null>(null);

  const fetchPlaces = useCallback(async (): Promise<PlaceItem[]> => {
    try {
      const data = await api.getPlaces();
      setPlaces(data);
      return data;
    } catch (err) {
      console.warn('Ошибка загрузки мест:', err);
      return [];
    }
  }, []);
  const unreadNews = news.filter(n => new Date(n.createdAt).getTime() > newsSeenAt).length;

  const fetchNews = useCallback(async () => {
    try {
      setNews(await api.getNews());
    } catch (err) {
      console.warn('Ошибка загрузки новостей:', err);
    } finally {
      setIsNewsLoading(false);
    }
  }, []);

  const markNewsSeen = () => {
    const now = Date.now();
    setNewsSeenAt(now);
    try {
      localStorage.setItem('yesminsk_news_seen_at', String(now));
    } catch {
      // не страшно: счётчик просто покажется снова
    }
  };
  const [launchNotice, setLaunchNotice] = useState<{ title: string; text: string; tab: 'events' | 'feed' } | null>(null);

  const currentUserCoordsRef = useRef(currentUser.coordinates);
  useEffect(() => {
    currentUserCoordsRef.current = currentUser.coordinates;
  }, [currentUser.coordinates]);

  // Загрузка пользователей с бэкенда
  const fetchNearbyUsers = useCallback(async () => {
    try {
      setApiError(null);
      const coords = currentUserCoordsRef.current || getSavedCoordinates();
      const data = await api.getNearbyUsers({
        // «Покажут город» и «Эмпаты» — не цели встречи: фильтруем на месте, с сервера берём всех
        goal: selectedGoal === 'guides' || selectedGoal === 'empaths' || selectedGoal === 'venting' ? 'all' : selectedGoal,
        lat: coords[0],
        lng: coords[1],
        radiusKm: 25
      });

      if (Array.isArray(data)) {
        setUsers(data);
        setIsUsersLoaded(true);
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки пользователей:', err);
      setApiError('Не получилось загрузить людей рядом. Попробуй ещё раз 🙏');
    }
  }, [selectedGoal]);

  // Загрузка событий
  const fetchEvents = useCallback(async (): Promise<AppEvent[]> => {
    try {
      const data = await api.getEvents();
      setEvents(data || []);
      return data || [];
    } catch (err: any) {
      console.warn('Ошибка загрузки событий:', err);
      return [];
    }
  }, []);

  // «Хотят пообщаться» и «На связи». Если кто-то ответил 👋, пока нас не было, показываем окно
  const fetchInbox = useCallback(async (showNewMatch = false) => {
    try {
      const data = await api.getInbox();
      setLikedMe(data.likedMe || []);
      setMatches(data.matches || []);

      if (showNewMatch && data.matches?.length) {
        let seen: number[] = [];
        try {
          seen = JSON.parse(localStorage.getItem('yesminsk_seen_matches') || '[]');
        } catch (e) {}
        const fresh = data.matches.find((m) => !seen.includes(m.telegramId));
        if (fresh) setMatchPopupUser(fresh);
        try {
          localStorage.setItem('yesminsk_seen_matches', JSON.stringify(data.matches.map((m) => m.telegramId)));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Ошибка загрузки входящих приветов:', err);
    }
  }, []);

  // Инициализация один раз при старте приложения
  useEffect(() => {
    telegramService.init();

    const initUserData = async () => {
      // Люди, сходки, места грузятся сразу, не дожидаясь анкеты
      const dataPromise = Promise.all([fetchNearbyUsers(), fetchEvents(), fetchInbox(true), fetchNews(), fetchPlaces()]);
      try {
        // Сервер перезапускается или просыпается — пробуем ещё (около 20 секунд)
        let me: any = null;
        for (const delay of [0, 1500, 3000, 5000, 8000]) {
          if (delay) await new Promise((res) => setTimeout(res, delay));
          try {
            me = await api.getMe();
            break;
          } catch (e: any) {
            // 4xx (кроме 408/429) — повтор не поможет
            const code = Number(e?.status || 0);
            if (code >= 400 && code < 500 && code !== 408 && code !== 429) throw e;
          }
        }
        if (!me) throw new Error('me unavailable');
        if (me) {
          let userCoords = getSavedCoordinates();
          const hasSaved = Boolean(localStorage.getItem('yesminsk_user_coords'));

          if (!hasSaved) {
            if (Array.isArray(me.coordinates) && me.coordinates.length === 2) {
              userCoords = me.coordinates[0] > 40
                ? [Number(me.coordinates[0]), Number(me.coordinates[1])]
                : [Number(me.coordinates[1]), Number(me.coordinates[0])];
            } else if (me.locationExact?.coordinates && Array.isArray(me.locationExact.coordinates)) {
              userCoords = [Number(me.locationExact.coordinates[1]), Number(me.locationExact.coordinates[0])];
            } else if (me.areaName && AREA_COORDINATES[me.areaName]) {
              userCoords = AREA_COORDINATES[me.areaName];
            }
          }

          setCurrentUser(prev => ({
            ...prev,
            telegramId: me.telegramId || tgUser?.id || prev.telegramId,
            name: me.firstName || tgUser?.first_name || prev.name,
            username: me.username || tgUser?.username || prev.username,
            age: me.age ? String(me.age) : prev.age,
            // Старые анкеты: если возраст не 25, его точно меняли руками
            ageConfirmed: Boolean(me.ageConfirmed) || (Boolean(me.age) && Number(me.age) !== 25),
            bio: me.bio ?? prev.bio,
            gender: me.gender || prev.gender,
            preferredGender: me.preferredGender || prev.preferredGender,
            preferredAgeRange: me.preferredAgeRange || prev.preferredAgeRange,
            // Пока анкета не заполнена, интересы не подставляем (иначе стоял бы «Погулять» по умолчанию)
            goals: me.profileCompleted ? me.goals || (me.goal ? [me.goal] : prev.goals) : [],
            profileCompleted: Boolean(me.profileCompleted),
            goal: me.goal || prev.goal,
            customGoal: me.customGoal || '',
            goesWith: me.goesWith || undefined,
            digest: me.digest || 'weekend',
            isEmpath: Boolean(me.isEmpath),
            ventUntil: me.ventUntil || null,
            avatarUrl: me.avatarUrl || tgUser?.photo_url || prev.avatarUrl,
            area: me.areaName || prev.area,
            isTourist: Boolean(me.isTourist),
            isProfileActive: me.isProfileActive !== false,
            isGuide: Boolean(me.isGuide),
            guideAbout: me.guideAbout || '',
            photos: me.photos || [],
            availableUntil: me.availableUntil || null,
            coordinates: userCoords,
            shownCoordinates: Array.isArray(me.shownCoordinates) ? me.shownCoordinates : null,
            legalVersion: me.legalVersion || '',
            genderConfirmed: Boolean(me.genderConfirmed) || (Boolean(me.gender) && me.gender !== 'not_specified'),
            hasAgreedToRules: Boolean(me.hasAgreedToRules),
            locationManual: Boolean(me.locationManual)
          }));

          // Может ли бот писать: сервер знает про «Старт» в боте, Telegram — про разрешение при запуске
          setBotAccessKnown(me.canMessage === true);
          // Уже зарегистрированным, кому бот не может писать, — тоже спрашиваем, но не чаще раза в 3 дня
          if (me.hasAgreedToRules && !botAccessOk()) {
            try {
              const last = Number(localStorage.getItem('yesminsk_bot_ask_at') || '0');
              if (Date.now() - last > 3 * 24 * 60 * 60 * 1000) {
                localStorage.setItem('yesminsk_bot_ask_at', String(Date.now()));
                window.setTimeout(() => askBotAccess(), 2000);
              }
            } catch (e) {}
          }

          if (me.isBanned) {
            setCurrentScreen('banned');
            return;
          }
          if (me.hasAgreedToRules === false) {
            setCurrentScreen('onboarding');
          } else if (!me.profileCompleted) {
            // Приветствие прошёл, а анкету не дозаполнил — сначала анкета
            setCurrentScreen('profile_create');
          }
        }
        setIsMeLoaded(true);
        setMeFailed(false);
      } catch (err) {
        console.warn('Профиль me не получен:', err);
        setMeFailed(true);
      }

      const [, loadedEvents, , , loadedPlaces] = await dataPromise;


      // Открыли по ссылке на сходку или из уведомления бота
      const target = telegramService.getLaunchTarget();
      if (target.tab === 'events') {
        setCurrentScreen(prev => (prev === 'main' ? 'events' : prev));
      }
      // «Заполнить анкету» из напоминания бота
      if (target.tab === 'profile') {
        setCurrentScreen(prev => (prev === 'main' ? 'profile_edit' : prev));
      }
      if (target.tab === 'places') {
        setCurrentScreen(prev => (prev === 'main' ? 'places' : prev));
      }
      if (target.tab === 'feed') {
        setCurrentScreen(prev => (prev === 'main' ? 'feed' : prev));
        fetchInbox();
      }
      if (target.placeId) {
        setMapModeState('places');
        setInitialPlaceId(target.placeId);
      }
      // «Посмотреть анкету» из сообщения бота: открываем анкету этого человека
      if (target.userId) {
        api
          .getPublicUser(target.userId)
          .then((u) => {
            if (!u) return;
            setCurrentScreen('feed');
            setSelectedUser(u);
          })
          .catch(() => setLaunchNotice({ title: 'Анкета не найдена', text: 'Эта анкета скрыта или удалена. Загляни в «Люди», там есть и другие.', tab: 'feed' }));
      }
      // «Кто ещё хочет» из «Хочу сходить»
      if (target.wishGroupId) setWishMembersGroup(target.wishGroupId);
      // «Хочу сходить» из сообщения бота: лента сходок и сразу шторка желаний
      if (target.want) {
        setPendingWish({ placeId: target.want.placeId });
        setCurrentScreen((prev) => (prev === 'main' ? 'events' : prev));
      }
      // «Собрать сходку» по ссылке: шаблон, время и место уже выбраны
      if (target.create) {
        const place = target.create.placeId ? loadedPlaces.find((p) => p.id === target.create!.placeId) : undefined;
        setPendingCreate({
          template: target.create.template,
          when: target.create.when,
          place: place ? placeForMeetup(place) : undefined,
          source: 'link',
          wishGroupId: target.create.wishGroupId,
          opt: target.create.opt
        });
        setCurrentScreen((prev) => (prev === 'main' ? 'events' : prev));
      }
      if (target.eventId) {
        const found = loadedEvents.find(e => String(e.id) === target.eventId);
        if (found) setSharedEvent(found);
        else setLaunchNotice({ title: 'Сходка не найдена', text: 'Эта сходка уже прошла или отменена. Загляни в «Сходки», там есть другие встречи.', tab: 'events' });
      }
    };

    initUserData();
  }, []);

  useEffect(() => {
    fetchNearbyUsers();
  }, [selectedGoal, fetchNearbyUsers]);

  // Сохранение профиля
  const handleSaveProfile = async (formData: {
    name: string;
    age: string;
    ageConfirmed?: boolean;
    genderConfirmed?: boolean;
    bio: string;
    gender?: Gender;
    preferredGender?: PreferredGender;
    preferredAgeRange?: AgeRange;
    goals: ActivityGoal[];
    goal: ActivityGoal;
    customGoal?: string;
    goesWith?: GoesWith;
    digest?: DigestFrequency;
    isEmpath?: boolean;
    avatarUrl?: string;
    photos?: string[];
    area: string;
    isTourist?: boolean;
    isProfileActive?: boolean;
    isGuide?: boolean;
    guideAbout?: string;
    coordinates?: [number, number];
    customCoordinates?: [number, number];
  }) => {
    if (!isMeLoadedRef.current) throw new Error('Анкета ещё не загрузилась, попробуй через минуту');
    const rawCoords = formData.coordinates || formData.customCoordinates;
    const coords: [number, number] = (rawCoords && Array.isArray(rawCoords) && rawCoords.length === 2 && !isNaN(rawCoords[0]))
      ? rawCoords
      : (AREA_COORDINATES[formData.area] || [53.9045, 27.5615]);

    try {
      localStorage.setItem('yesminsk_user_coords', JSON.stringify(coords));
    } catch (e) {}

    const res = await api.updateProfile({
      name: formData.name,
      firstName: formData.name,
      age: Number(formData.age) || 25,
      ageConfirmed: formData.ageConfirmed,
      bio: formData.bio,
      gender: formData.gender || 'not_specified',
      genderConfirmed: formData.genderConfirmed,
      preferredGender: formData.preferredGender || 'all',
      preferredAgeRange: formData.preferredAgeRange || { min: 18, max: 99 },
      goal: formData.goal,
      goals: formData.goals,
      customGoal: formData.customGoal,
      goesWith: formData.goesWith,
      digest: formData.digest,
      isEmpath: formData.isEmpath,
      avatarUrl: formData.avatarUrl,
      photos: formData.photos,
      areaName: formData.area,
      isTourist: formData.isTourist,
      isProfileActive: formData.isProfileActive,
      isGuide: formData.isGuide,
      guideAbout: formData.guideAbout,
      coordinates: coords
    });

    // Сверяем: сервер действительно записал то, что отправили? Если нет — покажем, что именно
    const saved = res?.user;
    if (res?.shownCoordinates) setCurrentUser(prev => ({ ...prev, shownCoordinates: res.shownCoordinates, locationManual: Boolean(res.locationManual) }));
    if (saved) {
      const notSaved: string[] = [];
      if (formData.isEmpath !== undefined && Boolean(saved.isEmpath) !== Boolean(formData.isEmpath)) notSaved.push('«Я эмпат»');
      if (formData.goesWith && saved.goesWith !== formData.goesWith) notSaved.push('«Обычно хожу»');
      if (formData.area && saved.areaName !== formData.area) notSaved.push('район');
      if (notSaved.length) {
        console.warn('Профиль: сервер не сохранил', notSaved, { sent: formData, saved });
        throw new Error(`Сервер не сохранил: ${notSaved.join(', ')}. Сделай скриншот и напиши разработчику`);
      }
    }

    setCurrentUser(prev => ({
      ...prev,
      ...formData,
      avatarUrl: formData.avatarUrl || prev?.avatarUrl, // фото не меняли — оставляем прежнее
      profileCompleted: prev.profileCompleted || Boolean(formData.ageConfirmed && formData.goals?.length),
      photos: formData.photos ? formData.photos.map((id) => `/api/photos/${encodeURIComponent(id)}?v=2`) : prev.photos,
      coordinates: coords
    }));

    // После первой анкеты — на карту; при редактировании остаёмся в профиле
    setCurrentScreen(prev => (prev === 'profile_create' ? 'main' : prev));
    await fetchNearbyUsers();
  };

  // Пожаловались на человека — убираем его отовсюду у того, кто пожаловался
  const handleUserReported = (user: UserProfile) => {
    const id = user.telegramId;
    setUsers(prev => prev.filter(u => u.telegramId !== id));
    setLikedMe(prev => prev.filter(u => u.telegramId !== id));
    setMatches(prev => prev.filter(u => u.telegramId !== id));
    setSelectedUser(null);
  };

  // 👋 Пообщаться / 🙈 Скрыть
  // Открыть анкету по id (аватарки в «Кто идёт» и т.п.): сначала из того, что уже загружено, потом с сервера
  const openUserById = useCallback((telegramId: number) => {
    if (!telegramId) return;
    // Своя анкета (например, «Автор места» — это ты) — открываем «Я»
    if (telegramId === currentUserIdRef.current) {
      setSelectedUser(null);
      setCurrentScreen('profile_edit');
      return;
    }
    const known = [...usersRef.current, ...likedMeRef.current, ...matchesRef.current].find((u) => u.telegramId === telegramId);
    if (known) {
      setSelectedUser(known);
      return;
    }
    api
      .getPublicUser(telegramId)
      .then((u) => u && setSelectedUser(u))
      .catch(() => telegramService.alert('Эта анкета скрыта или удалена'));
  }, []);

  // «Пропустить» свайпом: убираем из ленты сейчас, вернётся через 3 дня
  const handleSkip = (user: UserProfile) => {
    const id = user.telegramId;
    setUsers(prev => prev.filter(u => u.telegramId !== id));
    setLikedMe(prev => prev.filter(u => u.telegramId !== id));
    api.skipUser(id).catch(() => {});
  };
  const handleUnskip = (user: UserProfile, index: number) => {
    setUsers(prev => (prev.some(u => u.telegramId === user.telegramId) ? prev : [...prev.slice(0, index), user, ...prev.slice(index)]));
    api.skipUser(user.telegramId, true).catch(() => {});
  };

  const handleReact = async (user: UserProfile, type: ReactionType) => {
    // 👋 — чтобы бот смог сообщить, когда ответят взаимно
    if (type === 'like') askBotAccess();
    try {
      const result = await api.reactToUser(user.telegramId, type);
      const id = user.telegramId;

      if (type === 'dislike') {
        // Человек скрыт навсегда — убираем отовсюду
        setUsers(prev => prev.filter(u => u.telegramId !== id));
        setLikedMe(prev => prev.filter(u => u.telegramId !== id));
        setMatches(prev => prev.filter(u => u.telegramId !== id));
        setSelectedUser(null);
        return;
      }

      const updated: UserProfile = { ...user, ...(result.user || {}), iLiked: true, isMatch: result.isMatch };
      const patch = (list: UserProfile[]) => list.map(u => (u.telegramId === id ? { ...u, ...updated } : u));
      setUsers(patch);
      setSelectedUser(prev => (prev?.telegramId === id ? { ...prev, ...updated } : prev));
      setLikedMe(prev => prev.filter(u => u.telegramId !== id));

      if (result.isMatch) {
        setMatches(prev => [updated, ...prev.filter(u => u.telegramId !== id)]);
        try {
          const seen = JSON.parse(localStorage.getItem('yesminsk_seen_matches') || '[]');
          localStorage.setItem('yesminsk_seen_matches', JSON.stringify([...seen, id]));
        } catch (e) {}
        telegramService.haptic('success');
        setMatchPopupUser(updated);
      }
    } catch (err: any) {
      telegramService.alert(err.message || 'Не удалось сохранить реакцию');
    }
  };

  // «Отменить» в «На связи»: мой 👋 снят, человек остаётся в «Рядом» как обычная анкета
  const handleUnmatch = async (user: UserProfile) => {
    const id = user.telegramId;
    await api.unmatchUser(id);
    const undone = (u: UserProfile) => (u.telegramId === id ? { ...u, iLiked: false, isMatch: false, username: undefined } : u);
    setMatches(prev => prev.filter(u => u.telegramId !== id));
    setUsers(prev => prev.map(undone));
    setSelectedUser(prev => (prev ? undone(prev) : prev));
  };

  // Фильтр по цели. «🫂 Хочется поныть» видят только эмпаты — остальным объясняем и предлагаем анкету
  const handleSelectGoal = (goal: GoalFilter) => {
    if (goal === 'venting' && !currentUser.isEmpath) {
      telegramService.confirm(FEED_TEXTS.ventingOnlyEmpaths, { okText: FEED_TEXTS.ventingOpenProfile }).then((ok) => ok && handleNavigate('profile_edit'));
      return;
    }
    setSelectedGoal(goal);
  };

  const handleCreateEvent = async (eventData: EventPayload): Promise<AppEvent> => {
    const created = await api.createEvent({
      ...eventData,
      category: eventData.category as EventCategory
    });
    if (created) {
      const normalized: AppEvent = {
        ...created,
        id: String(created.id || (created as any)._id || Date.now()),
        coordinates: created.coordinates || [53.9045, 27.5615]
      };
      setEvents(prev => [normalized, ...prev]);
      return normalized;
    }
    throw new Error('Не удалось создать сходку');
  };

  const handleUpdateEvent = async (eventId: string, eventData: any): Promise<any> => {
    const updated = await api.updateEvent(eventId, eventData);
    if (updated) {
      setEvents(prev =>
        prev.map(ev =>
          ev.id === eventId || (ev as any)._id === eventId
            ? { ...ev, ...updated, id: String(updated.id || (updated as any)._id || eventId) }
            : ev
        )
      );
      return updated;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    await api.deleteEvent(eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId && (e as any)._id !== eventId));
  };

  // Записаться на сходку (options — с кем идёшь; повторно — поменять) или отказаться (options = null).
  // Возвращает обновлённую сходку или null, если не получилось (например, закончились места)
  const handleJoinEvent = async (event: AppEvent, options: JoinOptions | null): Promise<AppEvent | null> => {
    // Записался — пусть бот сможет прислать напоминание
    if (options) askBotAccess();
    try {
      const mySeats = event.isJoined ? 1 + (event.myGuests || 0) : 0;
      let updated: AppEvent;
      if (options) {
        const res = await api.joinEvent(event.id, options);
        updated = {
          ...event,
          participantsCount: event.participantsCount - mySeats + 1 + options.guests,
          groupsCount: (event.groupsCount ?? event.participantsCount) + (event.isJoined ? 0 : 1),
          ...(res.event?.id ? res.event : {}),
          id: event.id,
          isJoined: true,
          myGuests: options.guests,
          myWithKids: options.withKids
        };
      } else {
        await api.leaveEvent(event.id);
        updated = {
          ...event,
          isJoined: false,
          participantsCount: Math.max(0, event.participantsCount - mySeats),
          groupsCount: Math.max(0, (event.groupsCount ?? event.participantsCount) - 1),
          withKidsCount: Math.max(0, (event.withKidsCount || 0) - (event.myWithKids ? 1 : 0)),
          myGuests: 0,
          myWithKids: false
        };
      }
      setEvents(prev => prev.map(e => (e.id === event.id ? updated : e)));
      telegramService.haptic('success');
      return updated;
    } catch (e: any) {
      telegramService.alert(e?.message || 'Не получилось изменить участие');
      return null;
    }
  };

  // «⚡ Свободен сейчас»
  // «🫂 Хочется поныть»
  const handleSetVent = async (hours: number) => {
    try {
      const res = await api.setVent(hours);
      setCurrentUser(prev => ({ ...prev, ventUntil: res.ventUntil || null }));
      telegramService.haptic('success');
    } catch (e: any) {
      telegramService.alert(e?.message || 'Не получилось изменить статус');
    }
  };

  const handleSetAvailable = async (hours: number) => {
    const res = await api.setAvailable(hours);
    setCurrentUser(prev => ({ ...prev, availableUntil: res.availableUntil || null }));
    telegramService.haptic('success');
  };

  // Удалить себя из приложения: сервер стирает анкету и всё связанное, тут — местные настройки
  const handleDeleteAccount = async () => {
    await api.deleteAccount();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('yesminsk'))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    setSelectedUser(null);
    setCurrentScreen('deleted');
  };

  const handleAgreeRules = async () => {
    try {
      // Запись на сервере создаётся только сейчас, после согласия
      await api.agreeToRules(LEGAL_VERSION);
      setCurrentUser((prev) => ({ ...prev, legalVersion: LEGAL_VERSION, hasAgreedToRules: true }));
    } catch (e) {
      console.warn('Agree rules warning:', e);
    }
    // Первый вход: просим разрешить боту писать (иначе не дойдут ни напоминания, ни совпадения)
    askBotAccess();
    setCurrentScreen('profile_create');
  };

  const handleUpdateLocation = useCallback((coords: [number, number]) => {
    try {
      localStorage.setItem('yesminsk_user_coords', JSON.stringify(coords));
    } catch (e) {}

    setCurrentUser(prev => ({
      ...prev,
      coordinates: coords
    }));

    api.updateProfile({ coordinates: coords }).then((r: any) => {
      if (r?.shownCoordinates) setCurrentUser(prev => ({ ...prev, shownCoordinates: r.shownCoordinates, locationManual: Boolean(r.locationManual) }));
    }).catch((err) => {
      console.warn('Location sync warning:', err);
    });
  }, []);

  const isTab = ['main', 'feed', 'events', 'places', 'news', 'profile_edit'].includes(currentScreen);

  // Места: сохранить и «Сходка сюда» — общие для карты и вкладки «Места»
  const toggleSavePlace = async (p: PlaceItem): Promise<PlaceItem> => {
    const { saved } = await api.toggleSavePlace(p.id);
    const updated = { ...p, isSaved: saved };
    setPlaces(prev => prev.map(x => (x.id === p.id ? updated : x)));
    return updated;
  };
  const createEventAtPlace = (p: PlaceItem) => {
    setPendingCreate({ place: placeForMeetup(p), source: 'place' });
    handleNavigate('events');
  };

  // Число на вкладке «Сходки»: новые чужие сходки с прошлого захода на вкладку (куда не записан, ещё не начались)
  const [eventsBadgeSeen, setEventsBadgeSeen] = useState<Set<string>>(loadBadgeSeenEvents);
  useEffect(() => {
    if (currentScreen !== 'events' || !events.length) return;
    setEventsBadgeSeen(markBadgeSeenEvents(events.map((e) => String(e.id))));
  }, [currentScreen, events]);
  const newEventsCount = useMemo(() => {
    const now = Date.now();
    return events.filter(
      (e) =>
        !e.isJoined &&
        Number(e.creator?.telegramId) !== Number(currentUser.telegramId) &&
        new Date(e.dateTime).getTime() > now - 30 * 60 * 1000 &&
        !eventsBadgeSeen.has(String(e.id))
    ).length;
  }, [events, currentUser.telegramId, eventsBadgeSeen]);

  // «Первые шаги» для новичков
  const firstSteps = [
    {
      id: 'photo',
      title: 'Добавь своё фото',
      done: Boolean(currentUser.avatarUrl) && !currentUser.avatarUrl.includes('images.unsplash.com'),
      onClick: () => handleNavigate('profile_edit')
    },
    { id: 'bio', title: 'Напиши пару слов о себе', done: currentUser.bio.trim().length > 0, onClick: () => handleNavigate('profile_edit') },
    { id: 'hello', title: 'Нажми 👋 у того, с кем хочешь пообщаться', done: matches.length > 0 || users.some(u => u.iLiked) },
    { id: 'event', title: 'Запишись на сходку или собери свою', done: events.some(e => e.isJoined), onClick: () => handleNavigate('events') }
  ];
  const hideFirstSteps = () => {
    setIsFirstStepsHidden(true);
    try {
      localStorage.setItem('yesminsk_first_steps_hidden', '1');
    } catch {
      // не страшно
    }
  };

  const handleNavigate = (tab: TabId) => {
    setSelectedUser(null);
    setCurrentScreen(tab);
    if (tab === 'feed') fetchInbox();
    if (tab === 'news') {
      fetchNews();
      markNewsSeen();
    }
  };

  return (
    <OpenUserContext.Provider value={openUserById}>
    <YMaps
      query={{
        apikey: import.meta.env.VITE_YANDEX_MAPS_KEY || '',
        lang: 'ru_RU',
        // Только нужные модули, а не весь API: так карта не тормозит сразу после открытия
        load: 'Map,Placemark,Clusterer,templateLayoutFactory,geocode'
      }}
    >
      <div className="flex justify-center bg-zine-paper font-sans text-zine-ink">
        <div className="w-full max-w-[420px] h-[var(--tg-viewport-stable-height,100dvh)] bg-zine-paper overflow-hidden flex flex-col relative">
          <ServerWakingBanner />

          {apiError && (
            <div className="absolute top-[152px] inset-x-3 z-50 p-3.5 rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-float flex items-center justify-between gap-3">
              <span className="text-sm2 text-zine-ink">{apiError}</span>
              <button
                onClick={() => {
                  fetchNearbyUsers();
                  fetchEvents();
                }}
                className="h-11 px-4 shrink-0 rounded-full bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer"
              >
                Повторить
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 relative">
            {currentScreen === 'onboarding' && <OnboardingScreen onAgree={handleAgreeRules} />}

            {/* Аккаунт удалён по просьбе человека */}
            {currentScreen === 'deleted' && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-zine-paper">
                <div className="text-[56px] mb-4">👋</div>
                <h1 className="font-serif font-bold text-display text-zine-ink">{ACCOUNT_TEXTS.doneTitle}</h1>
                <p className="mt-3 text-body text-zine-inkMuted">{ACCOUNT_TEXTS.doneText}</p>
                <button
                  onClick={() => telegramService.close()}
                  className="mt-6 h-12 px-8 rounded-full bg-zine-ink text-zine-paper text-body font-bold cursor-pointer"
                >
                  {ACCOUNT_TEXTS.close}
                </button>
              </div>
            )}

            {currentScreen === 'banned' && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-zine-paper">
                <div className="text-[56px] mb-4">🚫</div>
                <h1 className="font-serif font-bold text-display text-zine-ink">Аккаунт заблокирован</h1>
                <p className="mt-3 text-body text-zine-inkMuted">
                  Мы заблокировали аккаунт за нарушение правил «ГУЛЯЙ!». Если считаешь, что это ошибка, напиши боту @yesminsk_app_bot.
                </p>
              </div>
            )}

            {currentScreen === 'profile_create' && (isMeLoaded ? <ProfileFormScreen isFirstTime={true} initialData={currentUser} onSave={handleSaveProfile} /> : <ProfileLoading failed={meFailed} />)}

            {currentScreen === 'profile_edit' &&
              (isMeLoaded ? (
                <ProfileFormScreen
                  isFirstTime={false}
                  initialData={currentUser}
                  onSave={handleSaveProfile}
                  onPlacesChanged={fetchPlaces}
                  onEventsChanged={fetchEvents}
                  onSetVent={handleSetVent}
                  onDeleteAccount={handleDeleteAccount}
                  onAddToHome={() => setIsHomeTipOpen(true)}
                />
              ) : (
                <ProfileLoading failed={meFailed} />
              ))}

            {currentScreen === 'main' && (
              <MapScreen
                users={users}
                events={events}
                currentUser={currentUser}
                selectedUser={selectedUser}
                onSelectUser={(u) => setSelectedUser(u)}
                selectedGoal={selectedGoal}
                onSelectGoal={handleSelectGoal}
                onOpenProfile={() => handleNavigate('profile_edit')}
                onJoinEvent={handleJoinEvent}
                onUpdateLocation={handleUpdateLocation}
                myPrefs={{ preferredGender: currentUser.preferredGender, preferredAgeRange: currentUser.preferredAgeRange }}
                onSetShownLocation={async (c) => {
                  const r = await api.setShownLocation(c);
                  setCurrentUser(prev => ({ ...prev, shownCoordinates: r.shownCoordinates, locationManual: r.locationManual }));
                }}
                onSetAvailable={handleSetAvailable}
                onOpenNews={() => handleNavigate('news')}
                fewPeople={isUsersLoaded && !apiError && users.length < 3}
                places={places}
                mapMode={mapMode}
                onChangeMapMode={setMapMode}
                onOpenEvents={() => handleNavigate('events')}
                onOpenPeople={() => handleNavigate('feed')}
                onToggleSavePlace={toggleSavePlace}
                unreadNews={unreadNews}
                initialPlaceId={initialPlaceId}
                onCreateEventAtPlace={createEventAtPlace}
                onCreateEvent={() => {
                  setPendingCreate({ source: 'map' });
                  handleNavigate('events');
                }}
                matchIds={matches.map((m) => m.telegramId)}
              />
            )}

            {currentScreen === 'feed' && (
              <FeedScreen
                users={users}
                likedMe={likedMe}
                matches={matches}
                isTourist={currentUser.isTourist}
                myGoals={currentUser.goals}
                myPrefs={{ preferredGender: currentUser.preferredGender, preferredAgeRange: currentUser.preferredAgeRange }}
                myUsername={currentUser.username}
                topSlot={!isFirstStepsHidden && firstSteps.some((s) => !s.done) && <FirstStepsCard steps={firstSteps} onDismiss={hideFirstSteps} />}
                selectedGoal={selectedGoal}
                onSelectGoal={handleSelectGoal}
                onSelectUser={(u) => setSelectedUser(u)}
                onReact={handleReact}
                onUnmatch={handleUnmatch}
                onSkip={handleSkip}
                onUnskip={handleUnskip}
              />
            )}

            {currentScreen === 'places' && (
              <PlacesScreen places={places} onToggleSave={toggleSavePlace} onCreateEvent={createEventAtPlace} events={events} onJoinEvent={handleJoinEvent} />
            )}

            {currentScreen === 'news' && (
              <NewsScreen news={news} isLoading={isNewsLoading} onOpenDonate={() => setIsDonateOpen(true)} onBack={() => handleNavigate('main')} />
            )}

            {currentScreen === 'events' && (
              <EventsScreen
                events={events}
                currentUserId={currentUser.telegramId}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onJoin={handleJoinEvent}
                onRefreshEvents={fetchEvents}
                initialCreate={pendingCreate}
                places={places}
                initialWish={pendingWish}
                onInitialWishUsed={() => setPendingWish(null)}
                onInitialCreateUsed={() => setPendingCreate(null)}
              />
            )}
          </div>

          {isTab && (
            <TabBar
              current={currentScreen as TabId}
              onNavigate={handleNavigate}
              badges={{ feed: likedMe.length, events: currentScreen === 'events' ? 0 : newEventsCount, news: currentScreen === 'news' ? 0 : unreadNews }}
              highlight="events"
            />
          )}

          {selectedUser && isTab && (
            <UserBottomSheet
              user={selectedUser}
              myGoals={currentUser.goals}
              onClose={() => setSelectedUser(null)}
              onReact={handleReact}
              onReported={handleUserReported}
            />
          )}

          {sharedEvent && isTab && !matchPopupUser && (
            <BottomSheet title={sharedEvent.title} onClose={() => setSharedEvent(null)}>
              <EventDetails
                event={sharedEvent}
                onJoin={async (options) => {
                  const updated = await handleJoinEvent(sharedEvent, options);
                  if (updated) setSharedEvent(updated);
                }}
              />
            </BottomSheet>
          )}

          {wishMembersGroup && (
            <WishMembersSheet
              groupId={wishMembersGroup}
              onClose={() => setWishMembersGroup(null)}
              onOpenUser={(u) => {
                setWishMembersGroup(null);
                setCurrentScreen('feed');
                setSelectedUser(u);
              }}
              onOpenEvent={(id) => {
                setWishMembersGroup(null);
                const ev = events.find((e) => String(e.id) === id);
                if (ev) setSharedEvent(ev);
              }}
            />
          )}

          {isHomeTipOpen && isTab && currentUser.ageConfirmed && !sharedEvent && !matchPopupUser && !selectedUser && <AddToHomeSheet onClose={closeHomeTip} />}

          {/* Зарегистрировались до документов (или редакция обновилась) — принять Соглашение и Политику */}
          {isMeLoaded && currentUser.hasAgreedToRules && currentUser.legalVersion !== LEGAL_VERSION && currentScreen !== 'onboarding' && currentScreen !== 'deleted' && currentScreen !== 'banned' && (
            <LegalUpdateOverlay
              onAccept={async () => {
                await api.acceptLegal(LEGAL_VERSION);
                setCurrentUser((prev) => ({ ...prev, legalVersion: LEGAL_VERSION }));
              }}
              onDecline={handleDeleteAccount}
            />
          )}

          {/* Пол не выбран: спрашиваем после возраста (за вход — не больше одного окна) */}
          {isMeLoaded && isTab && currentScreen !== 'profile_edit' && currentUser.ageConfirmed && currentUser.profileCompleted && !currentUser.genderConfirmed && currentUser.legalVersion === LEGAL_VERSION && !isGenderPromptDismissed && !isHomeTipOpen && !sharedEvent && !matchPopupUser && (
            <GenderPrompt
              myAge={Number(currentUser.age) || 25}
              onSave={async (gender) => {
                await api.updateProfile({ gender, genderConfirmed: true });
                // Пол сохраняем в анкете сразу, но окно не закрываем: дальше шаг «С кем комфортно»
                setGenderSavedInPrompt(gender);
              }}
              onSavePrefs={async (prefs) => {
                await api.updateProfile(prefs);
                setCurrentUser((prev) => ({ ...prev, ...prefs }));
              }}
              onClose={() => {
                setIsGenderPromptDismissed(true);
                if (genderSavedInPrompt) setCurrentUser((prev) => ({ ...prev, gender: genderSavedInPrompt, genderConfirmed: true }));
                try {
                  localStorage.setItem('yesminsk_gender_later', String(Date.now()));
                } catch {}
              }}
            />
          )}

          {/* Возраст остался по умолчанию: один раз спрашиваем */}
          {isMeLoaded && isTab && currentScreen !== 'profile_edit' && !currentUser.ageConfirmed && !isAgePromptDismissed && !sharedEvent && !matchPopupUser && (
            <AgePrompt
              onSave={async (age) => {
                await api.updateProfile({ age, ageConfirmed: true });
                setCurrentUser((prev) => ({ ...prev, age: String(age), ageConfirmed: true }));
              }}
              onClose={() => setIsAgePromptDismissed(true)}
            />
          )}

          {launchNotice && (
            <BottomSheet title={launchNotice.title} onClose={() => setLaunchNotice(null)}>
              <p className="text-body text-zine-inkMuted">{launchNotice.text}</p>
              <button
                onClick={() => {
                  const tab = launchNotice.tab;
                  setLaunchNotice(null);
                  handleNavigate(tab);
                }}
                className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
              >
                {launchNotice.tab === 'feed' ? 'Посмотреть людей' : 'Посмотреть сходки'}
              </button>
            </BottomSheet>
          )}

          {isDonateOpen && (
            <DonateSheet
              onClose={() => setIsDonateOpen(false)}
              onOpenNews={() => {
                setIsDonateOpen(false);
                handleNavigate('news');
              }}
            />
          )}

          {shareData && <ShareSheet data={shareData} onClose={() => setShareData(null)} />}

          {matchPopupUser && (
            <MatchModal
              user={matchPopupUser}
              myAvatarUrl={currentUser.avatarUrl}
              onClose={() => setMatchPopupUser(null)}
            />
          )}
        </div>
      </div>
    </YMaps>
    </OpenUserContext.Provider>
  );
};

export default App;

// Пока анкета грузится с сервера (он может просыпаться до минуты)
const ProfileLoading: React.FC<{ failed?: boolean }> = ({ failed }) =>
  failed ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center text-zine-inkMuted">
      <p className="text-lead font-bold text-zine-ink">Не получилось загрузить анкету</p>
      <p className="text-body">Сервер не ответил. Твои данные на месте, просто попробуй ещё раз.</p>
      <button onClick={() => window.location.reload()} className="mt-2 h-12 px-6 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
        Попробовать ещё раз
      </button>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-zine-inkMuted">
      <span className="w-8 h-8 rounded-full border-[3px] border-zine-border border-t-zine-terracotta animate-spin" />
      <p className="text-body">Загружаем анкету…</p>
    </div>
  );
