import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YMaps } from '@pbe/react-yandex-maps';
import { telegramService } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { EventsScreen } from './screens/EventsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
import { MatchModal, ReactionType } from './components/common/Reactions';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender, AgeRange, EventCategory } from './types';

// Примерные координаты районов Минска
const AREA_COORDINATES: Record<string, [number, number]> = {
  'Я турист(ка) / не знаю города': [53.9045, 27.5615],
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
    'onboarding' | 'profile_create' | 'main' | 'feed' | 'events' | 'profile_edit'
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
    preferredAgeRange: { min: 18, max: 45 } as AgeRange,
    goals: ['walk'] as ActivityGoal[],
    goal: 'walk' as ActivityGoal,
    avatarUrl: tgUser?.photo_url || '',
    area: 'Немига / Центр',
    isTourist: false,
    isProfileActive: true,
    coordinates: getSavedCoordinates()
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');
  const [apiError, setApiError] = useState<string | null>(null);
  const [likedMe, setLikedMe] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<UserProfile[]>([]);
  const [matchPopupUser, setMatchPopupUser] = useState<UserProfile | null>(null);

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
        goal: selectedGoal,
        lat: coords[0],
        lng: coords[1],
        radiusKm: 25
      });

      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки пользователей:', err);
      setApiError('Сервер временно недоступен или обновляется.');
    }
  }, [selectedGoal]);

  // Загрузка событий
  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getEvents();
      setEvents(data || []);
    } catch (err: any) {
      console.warn('Ошибка загрузки событий:', err);
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
            avatarUrl: me.avatarUrl || tgUser?.photo_url || prev.avatarUrl,
            area: me.areaName || prev.area,
            isTourist: Boolean(me.isTourist),
            isProfileActive: me.isProfileActive !== false,
            coordinates: userCoords
          }));

          if (me.hasAgreedToRules === false) {
            setCurrentScreen('onboarding');
          }
        }
      } catch (err) {
        console.warn('Профиль me не получен (новый пользователь):', err);
      }

      await Promise.all([fetchNearbyUsers(), fetchEvents(), fetchInbox(true)]);
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
    avatarUrl: string;
    area: string;
    isTourist?: boolean;
    isProfileActive?: boolean;
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

    await api.updateProfile({
      name: formData.name,
      firstName: formData.name,
      age: Number(formData.age) || 25,
      bio: formData.bio,
      gender: formData.gender || 'not_specified',
      preferredGender: formData.preferredGender || 'all',
      preferredAgeRange: formData.preferredAgeRange || { min: 18, max: 45 },
      goal: formData.goal,
      goals: formData.goals,
      avatarUrl: formData.avatarUrl,
      areaName: formData.area,
      isTourist: formData.isTourist,
      isProfileActive: formData.isProfileActive,
      coordinates: coords
    });

    setCurrentUser(prev => ({
      ...prev,
      ...formData,
      coordinates: coords
    }));

    setCurrentScreen('main');
    await fetchNearbyUsers();
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
      telegramService.haptic('error');
      alert(err.message || 'Не удалось сохранить реакцию');
    }
  };

  const handleCreateEvent = async (eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }): Promise<AppEvent> => {
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

  const handleToggleJoinEvent = async (event: AppEvent) => {
    try {
      const isJoined = Boolean(event.isJoined);
      await api.toggleJoinEvent(event.id, isJoined);
      setEvents(prev =>
        prev.map(e =>
          e.id === event.id
            ? {
                ...e,
                isJoined: !isJoined,
                participantsCount: !isJoined
                  ? (e.participantsCount || 0) + 1
                  : Math.max(0, (e.participantsCount || 1) - 1)
              }
            : e
        )
      );
    } catch (e) {
      console.error('Ошибка изменения участия:', e);
    }
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

  return (
    <YMaps
      query={{
        apikey: import.meta.env.VITE_YANDEX_MAPS_KEY || '',
        lang: 'ru_RU',
        load: 'package.full'
      }}
    >
      <div className="flex justify-center items-center min-h-screen bg-[#E5DED5] p-0 sm:p-4 font-sans text-zine-ink">
        <div className="w-full max-w-[420px] h-screen sm:h-[840px] bg-zine-paper sm:rounded-[36px] overflow-hidden shadow-2xl border-0 sm:border-[6px] sm:border-zine-ink flex flex-col relative">
          
          {apiError && (
            <div className="absolute top-2 inset-x-2 z-50 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center justify-between shadow-lg">
              <span>⏳ {apiError}</span>
              <button
                onClick={() => {
                  fetchNearbyUsers();
                  fetchEvents();
                }}
                className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px] cursor-pointer"
              >
                Повторить
              </button>
            </div>
          )}

          {currentScreen === 'onboarding' && (
            <OnboardingScreen onAgree={handleAgreeRules} />
          )}

          {currentScreen === 'profile_create' && (
            <ProfileFormScreen
              isFirstTime={true}
              initialData={currentUser}
              onSave={handleSaveProfile}
            />
          )}

          {currentScreen === 'profile_edit' && (
            <ProfileFormScreen
              isFirstTime={false}
              initialData={currentUser}
              onBack={() => setCurrentScreen('main')}
              onSave={handleSaveProfile}
            />
          )}

          {currentScreen === 'main' && (
            <MapScreen
              users={users}
              events={events}
              currentUser={currentUser}
              selectedUser={selectedUser}
              onSelectUser={(u) => setSelectedUser(u)}
              selectedGoal={selectedGoal}
              onSelectGoal={(g) => setSelectedGoal(g)}
              currentArea={currentUser.area}
              onOpenProfile={() => {
                telegramService.haptic('selection');
                setCurrentScreen('profile_edit');
              }}
              onOpenFeed={() => {
                telegramService.haptic('selection');
                setCurrentScreen('feed');
                fetchInbox();
              }}
              onOpenEvents={() => {
                telegramService.haptic('selection');
                setCurrentScreen('events');
              }}
              onToggleJoinEvent={handleToggleJoinEvent}
              onUpdateLocation={handleUpdateLocation}
              onUpdateUserCoordinates={handleUpdateLocation}
              onReact={handleReact}
              inboxCount={likedMe.length}
            />
          )}

          {currentScreen === 'feed' && (
            <FeedScreen
              users={users}
              eventsCount={events.length}
              currentArea={currentUser.area}
              onSelectUser={(u) => setSelectedUser(u)}
              likedMe={likedMe}
              matches={matches}
              onReact={handleReact}
              onOpenMap={() => {
                telegramService.haptic('selection');
                setCurrentScreen('main');
              }}
              onOpenEvents={() => {
                telegramService.haptic('selection');
                setCurrentScreen('events');
              }}
              onOpenProfile={() => {
                telegramService.haptic('selection');
                setCurrentScreen('profile_edit');
              }}
            />
          )}

          {currentScreen === 'events' && (
            <EventsScreen
              events={events}
              currentUserId={currentUser.telegramId}
              onCreateEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onToggleJoin={handleToggleJoinEvent}
              onRefreshEvents={fetchEvents}
              currentArea={currentUser.area}
              onOpenMap={() => {
                telegramService.haptic('selection');
                setCurrentScreen('main');
              }}
              onOpenFeed={() => {
                telegramService.haptic('selection');
                setCurrentScreen('feed');
              }}
              onOpenProfile={() => {
                telegramService.haptic('selection');
                setCurrentScreen('profile_edit');
              }}
            />
          )}

          {currentScreen === 'feed' && selectedUser && (
            <UserBottomSheet
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onReact={handleReact}
            />
          )}

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
