import React, { useState, useEffect, useCallback } from 'react';
import { telegramService } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { EventsScreen } from './screens/EventsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender, AgeRange } from './types';

// Примерные координаты районов Минска
const AREA_COORDINATES: Record<string, [number, number]> = {
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

export const App: React.FC = () => {
  // Экраны приложения
  const [currentScreen, setCurrentScreen] = useState<
    'onboarding' | 'profile_create' | 'main' | 'feed' | 'events' | 'profile_edit'
  >('main');

  // Данные текущего пользователя
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
    isTourist: false
  });

  // Пользователи и события с сервера
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');
  const [apiError, setApiError] = useState<string | null>(null);

  // 1. Загрузка реальных пользователей с бэкенда (/api/users/nearby)
  const fetchNearbyUsers = useCallback(async () => {
    try {
      setApiError(null);
      const coords = AREA_COORDINATES[currentUser.area] || [53.9045, 27.5615];
      const data = await api.getNearbyUsers({
        goal: selectedGoal,
        lat: coords[0],
        lng: coords[1],
        radiusKm: 25
      });

      setUsers(data || []);
    } catch (err: any) {
      console.warn('Ошибка загрузки пользователей рядом:', err);
      setApiError('Сервер просыпается или временно недоступен. Проверь логи Render.');
    }
  }, [currentUser.area, selectedGoal]);

  // 2. Загрузка событий со сходками с бэкенда (/api/events)
  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getEvents();
      setEvents(data || []);
    } catch (err: any) {
      console.warn('Ошибка загрузки событий:', err);
    }
  }, []);

  // 3. Инициализация Telegram WebApp, профиля пользователя и сходок
  useEffect(() => {
    telegramService.init();

    const initUserData = async () => {
      try {
        const me = await api.getMe();
        if (me) {
          setCurrentUser({
            telegramId: me.telegramId || tgUser?.id || 0,
            name: me.firstName || tgUser?.first_name || '',
            username: me.username || tgUser?.username || '',
            age: me.age ? String(me.age) : '25',
            bio: me.bio || '',
            gender: me.gender || 'not_specified',
            preferredGender: me.preferredGender || 'all',
            preferredAgeRange: me.preferredAgeRange || { min: 18, max: 45 },
            goals: me.goals || (me.goal ? [me.goal] : ['walk']),
            goal: me.goal || 'walk',
            avatarUrl: me.avatarUrl || tgUser?.photo_url || '',
            area: me.areaName || 'Немига / Центр',
            isTourist: Boolean(me.isTourist)
          });

          // Если пользователь новый и еще не соглашался с правилами
          if (me.hasAgreedToRules === false) {
            setCurrentScreen('onboarding');
          }
        }
      } catch (err) {
        console.warn('Не удалось получить me профиль (новый пользователь или оффлайн):', err);
      }

      await Promise.all([fetchNearbyUsers(), fetchEvents()]);
    };

    initUserData();
  }, [fetchNearbyUsers, fetchEvents]);

  // 4. Сохранение профиля (отправка POST на /api/users/profile)
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
    customCoordinates?: [number, number];
  }) => {
    const coords = formData.customCoordinates || AREA_COORDINATES[formData.area] || [53.9045, 27.5615];

    // Отправляем запрос на бэкенд
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
      coordinates: coords,
      isTourist: Boolean(formData.isTourist),
      isProfileActive: true
    });

    // Обновляем локальный стейт
    setCurrentUser(prev => ({
      ...prev,
      ...formData,
      gender: formData.gender || prev.gender,
      preferredGender: formData.preferredGender || prev.preferredGender,
      preferredAgeRange: formData.preferredAgeRange || prev.preferredAgeRange,
      isTourist: Boolean(formData.isTourist)
    }));

    // Обновляем список пользователей рядом на карте
    await fetchNearbyUsers();

    // Переходим на главный экран карты
    setCurrentScreen('main');
  };

  // 5. Обработка блокировки пользователя
  const handleUserBlocked = (blockedUserId: string | number) => {
    setUsers(prev => prev.filter(u => u.id !== blockedUserId && u.telegramId !== blockedUserId));
    setSelectedUser(null);
  };

  // 6. Создание нового события
  const handleCreateEvent = async (eventData: Partial<AppEvent>) => {
    try {
      const created = await api.createEvent(eventData as any);
      if (created) {
        setEvents(prev => [created, ...prev]);
        return created;
      }
    } catch (e) {
      console.error('Ошибка при создании сходки:', e);
      throw e;
    }
  };

  // 7. Присоединение / выход из сходки (передаем 2 аргумента: event.id и isJoined)
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
      console.error('Ошибка при изменении участия в сходке:', e);
    }
  };

  // 8. Подтверждение онбординга
  const handleAgreeRules = async () => {
    try {
      await api.agreeToRules();
    } catch (e) {
      console.warn('Agree rules warning:', e);
    }
    setCurrentScreen('profile_create');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#E5DED5] p-0 sm:p-4 font-sans text-zine-ink">
      <div className="w-full max-w-[420px] h-screen sm:h-[840px] bg-zine-paper sm:rounded-[36px] overflow-hidden shadow-2xl border-0 sm:border-[6px] sm:border-zine-ink flex flex-col relative">
        
        {/* Баннер оповещения, если сервер Render еще "холодно" стартует */}
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

        {/* Экран Онбординга */}
        {currentScreen === 'onboarding' && (
          <OnboardingScreen onAgree={handleAgreeRules} />
        )}

        {/* Экран Создания профиля при первом входе */}
        {currentScreen === 'profile_create' && (
          <ProfileFormScreen
            isFirstTime={true}
            initialData={currentUser}
            onSave={handleSaveProfile}
          />
        )}

        {/* Экран Редактирования профиля из меню */}
        {currentScreen === 'profile_edit' && (
          <ProfileFormScreen
            isFirstTime={false}
            initialData={currentUser}
            onBack={() => setCurrentScreen('main')}
            onSave={handleSaveProfile}
          />
        )}

        {/* Главный экран: Карта */}
        {currentScreen === 'main' && (
          <MapScreen
            users={users}
            events={events}
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
            }}
            onOpenEvents={() => {
              telegramService.haptic('selection');
              setCurrentScreen('events');
            }}
            onToggleJoinEvent={handleToggleJoinEvent}
          />
        )}

        {/* Экран: Список / Лента людей */}
        {currentScreen === 'feed' && (
          <FeedScreen
            users={users}
            eventsCount={events.length}
            currentArea={currentUser.area}
            onSelectUser={(u) => setSelectedUser(u)}
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

        {/* Экран: Лента событий (Сходки) */}
        {currentScreen === 'events' && (
          <EventsScreen
            events={events}
            onCreateEvent={handleCreateEvent}
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

        {/* BottomSheet детального просмотра профиля из вкладки "Люди" */}
        {currentScreen === 'feed' && selectedUser && (
          <UserBottomSheet
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onUserBlocked={handleUserBlocked}
          />
        )}

      </div>
    </div>
  );
};

export default App;
