import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YMaps } from '@pbe/react-yandex-maps';
import { telegramService, ShareData, SHARE_EVENT } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { EventsScreen } from './screens/EventsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
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
import { UserProfile, ActivityGoal, GoalFilter, AppEvent, PlaceItem, Gender, PreferredGender, AgeRange, EventCategory, JoinOptions, GoesWith, DigestFrequency, EventPayload } from './types';

// Примерные координаты районов Минска
const AREA_COORDINATES: Record<string, [number, number]> = {
  'Я турист(ка) / не знаю города': [53.9045, 27.5615],
  'В Минске проездом / не знаю города': [53.9045, 27.5615],
  'Немига / Центр': [53.9045, 27.5520],
  'Осмоловка': [53.9115, 27.5612],
  'Октябрьская': [53.8905, 27.5740],
  'Золотая Горка': [53.9150, 27.5850],
  'Троицкое предместье': [53.9080, 27.5555],
  'Парк Челюскинцев': [53.9240, 27.6150],
  'Восток / Маяк Минска': [53.9335, 27.6530],
  'Комаровка': [53.9190, 27.5800],
  'Площадь Победы': [53.9085, 27.5750],
  'Парк Победы / Победителей': [53.9240, 27.5450]
};

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
    'onboarding' | 'profile_create' | 'main' | 'feed' | 'events' | 'places' | 'news' | 'profile_edit' | 'banned'
  >('main');

  const tgUser = telegramService.getUser();
  const [currentUser, setCurrentUser] = useState({
    telegramId: tgUser?.id || 0,
    name: tgUser?.first_name || '',
    username: tgUser?.username || '',
    age: '25',
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
    availableUntil: null as string | null,
    coordinates: getSavedCoordinates()
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalFilter>('all');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  // Анкета пришла с сервера? До этого форму не показываем — иначе она заполнится пустыми значениями и «Сохранить» их перезапишет
  const [isMeLoaded, setIsMeLoaded] = useState(false);
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
  const [pendingEventPlace, setPendingEventPlace] = useState<{ name: string; coordinates: [number, number]; category: EventCategory; placeId?: string; placeType?: string } | null>(null);

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
  const [launchNotice, setLaunchNotice] = useState<string | null>(null);

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
        goal: selectedGoal === 'guides' || selectedGoal === 'empaths' ? 'all' : selectedGoal,
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
      try {
        const me = await api.getMe();
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
            bio: me.bio ?? prev.bio,
            gender: me.gender || prev.gender,
            preferredGender: me.preferredGender || prev.preferredGender,
            preferredAgeRange: me.preferredAgeRange || prev.preferredAgeRange,
            goals: me.goals || (me.goal ? [me.goal] : prev.goals),
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
            availableUntil: me.availableUntil || null,
            coordinates: userCoords
          }));

          if (me.isBanned) {
            setCurrentScreen('banned');
            return;
          }
          if (me.hasAgreedToRules === false) {
            setCurrentScreen('onboarding');
          }
        }
      } catch (err) {
        console.warn('Профиль me не получен (новый пользователь):', err);
      }
      setIsMeLoaded(true);

      const [, loadedEvents] = await Promise.all([
        fetchNearbyUsers(),
        fetchEvents(),
        fetchInbox(true),
        fetchNews(),
        fetchPlaces()
      ]);


      // Открыли по ссылке на сходку или из уведомления бота
      const target = telegramService.getLaunchTarget();
      if (target.tab === 'events') {
        setCurrentScreen(prev => (prev === 'main' ? 'events' : prev));
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
      if (target.eventId) {
        const found = loadedEvents.find(e => String(e.id) === target.eventId);
        if (found) setSharedEvent(found);
        else setLaunchNotice('Эта сходка уже прошла или отменена. Загляни в «Сходки» — там есть другие встречи.');
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
    area: string;
    isTourist?: boolean;
    isProfileActive?: boolean;
    isGuide?: boolean;
    guideAbout?: string;
    coordinates?: [number, number];
    customCoordinates?: [number, number];
  }) => {
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
      bio: formData.bio,
      gender: formData.gender || 'not_specified',
      preferredGender: formData.preferredGender || 'all',
      preferredAgeRange: formData.preferredAgeRange || { min: 18, max: 99 },
      goal: formData.goal,
      goals: formData.goals,
      customGoal: formData.customGoal,
      goesWith: formData.goesWith,
      digest: formData.digest,
      isEmpath: formData.isEmpath,
      avatarUrl: formData.avatarUrl,
      areaName: formData.area,
      isTourist: formData.isTourist,
      isProfileActive: formData.isProfileActive,
      isGuide: formData.isGuide,
      guideAbout: formData.guideAbout,
      coordinates: coords
    });

    // Сверяем: сервер действительно записал то, что отправили? Если нет — покажем, что именно
    const saved = res?.user;
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
  const handleReact = async (user: UserProfile, type: ReactionType) => {
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

  const handleAgreeRules = async () => {
    try {
      await api.agreeToRules();
    } catch (e) {
      console.warn('Agree rules warning:', e);
    }
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

    api.updateProfile({ coordinates: coords }).catch((err) => {
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
    setPendingEventPlace({
      name: p.address && p.address !== p.name ? `${p.name}, ${p.address}` : p.name,
      coordinates: p.coordinates,
      category: p.moods.includes('food') || p.moods.includes('party') ? 'cafe_bar' : 'walk',
      placeId: p.id,
      placeType: p.category // шаблоны сходок подбираются под тип места
    });
    handleNavigate('events');
  };

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

            {currentScreen === 'banned' && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-zine-paper">
                <div className="text-[56px] mb-4">🚫</div>
                <h1 className="font-serif font-bold text-display text-zine-ink">Аккаунт заблокирован</h1>
                <p className="mt-3 text-body text-zine-inkMuted">
                  Мы заблокировали аккаунт за нарушение правил ДА! МИНСК. Если считаешь, что это ошибка, напиши боту @yesminsk_app_bot.
                </p>
              </div>
            )}

            {currentScreen === 'profile_create' && (isMeLoaded ? <ProfileFormScreen isFirstTime={true} initialData={currentUser} onSave={handleSaveProfile} /> : <ProfileLoading />)}

            {currentScreen === 'profile_edit' &&
              (isMeLoaded ? (
                <ProfileFormScreen isFirstTime={false} initialData={currentUser} onSave={handleSaveProfile} onPlacesChanged={fetchPlaces} onEventsChanged={fetchEvents} onSetVent={handleSetVent} />
              ) : (
                <ProfileLoading />
              ))}

            {currentScreen === 'main' && (
              <MapScreen
                users={users}
                events={events}
                currentUser={currentUser}
                selectedUser={selectedUser}
                onSelectUser={(u) => setSelectedUser(u)}
                selectedGoal={selectedGoal}
                onSelectGoal={(g) => setSelectedGoal(g)}
                onOpenProfile={() => handleNavigate('profile_edit')}
                onJoinEvent={handleJoinEvent}
                onUpdateLocation={handleUpdateLocation}
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
                topSlot={!isFirstStepsHidden && firstSteps.some((s) => !s.done) && <FirstStepsCard steps={firstSteps} onDismiss={hideFirstSteps} />}
                selectedGoal={selectedGoal}
                onSelectGoal={setSelectedGoal}
                onSelectUser={(u) => setSelectedUser(u)}
                onReact={handleReact}
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
                initialPlace={pendingEventPlace}
                onInitialPlaceUsed={() => setPendingEventPlace(null)}
              />
            )}
          </div>

          {isTab && (
            <TabBar
              current={currentScreen as TabId}
              onNavigate={handleNavigate}
              badges={{ feed: likedMe.length, news: currentScreen === 'news' ? 0 : unreadNews }}
            />
          )}

          {selectedUser && (currentScreen === 'feed' || currentScreen === 'main') && (
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

          {launchNotice && (
            <BottomSheet title="Сходка не найдена" onClose={() => setLaunchNotice(null)}>
              <p className="text-body text-zine-inkMuted">{launchNotice}</p>
              <button
                onClick={() => {
                  setLaunchNotice(null);
                  handleNavigate('events');
                }}
                className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
              >
                Посмотреть сходки
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
  );
};

export default App;

// Пока анкета грузится с сервера (он может просыпаться до минуты)
const ProfileLoading: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-zine-inkMuted">
    <span className="w-8 h-8 rounded-full border-[3px] border-zine-border border-t-zine-terracotta animate-spin" />
    <p className="text-body">Загружаем анкету…</p>
  </div>
);
