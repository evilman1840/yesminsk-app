import React, { useState, useEffect, useCallback } from 'react';
import { telegramService } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
import { UserProfile, ActivityGoal } from './types';

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
  // Текущий активный экран
  const [currentScreen, setCurrentScreen] = useState<
    'onboarding' | 'profile_create' | 'main' | 'feed' | 'profile_edit'
  >('main');

  // Данные текущего пользователя (инициализируем из Telegram WebApp)
  const tgUser = telegramService.getUser();
  const [currentUser, setCurrentUser] = useState({
    telegramId: tgUser?.id || 0,
    name: tgUser?.first_name || '',
    username: tgUser?.username || '',
    age: '25',
    bio: '',
    goals: ['walk'] as ActivityGoal[],
    goal: 'walk' as ActivityGoal,
    avatarUrl: tgUser?.photo_url || '',
    area: 'Немига / Центр'
  });

  // Список реальных пользователей с бэкенда
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');
  const [apiError, setApiError] = useState<string | null>(null);

  // 1. Загрузка пользователей рядом с бэкенда (/api/users/nearby)
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
      if (data && data.length > 0 && !selectedUser) {
        setSelectedUser(data[0]);
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки пользователей:', err);
      setApiError('Бэкенд Render просыпается или недоступен');
    }
  }, [currentUser.area, selectedGoal]);

  // 2. Инициализация Telegram WebApp и получение своего профиля
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
            goals: me.goals || (me.goal ? [me.goal] : ['walk']),
            goal: me.goal || 'walk',
            avatarUrl: me.avatarUrl || tgUser?.photo_url || '',
            area: me.areaName || 'Немига / Центр'
          });

          // Если пользователь новый и еще не соглашался с правилами
          if (me.hasAgreedToRules === false) {
            setCurrentScreen('onboarding');
          }
        }
      } catch (err) {
        console.warn('Пользователь еще не зарегистрирован в базе или оффлайн:', err);
      }

      await fetchNearbyUsers();
    };

    initUserData();
  }, [fetchNearbyUsers]);

  // 3. Сохранение профиля (POST на /api/users/profile)
  const handleSaveProfile = async (formData: {
    name: string;
    age: string;
    bio: string;
    goals: ActivityGoal[];
    goal: ActivityGoal;
    avatarUrl: string;
    area: string;
  }) => {
    const coords = AREA_COORDINATES[formData.area] || [53.9045, 27.5615];

    // Отправляем реальный запрос на бэкенд на Render
    await api.updateProfile({
      name: formData.name,
      firstName: formData.name,
      age: Number(formData.age) || 25,
      bio: formData.bio,
      goal: formData.goal,
      goals: formData.goals,
      avatarUrl: formData.avatarUrl,
      areaName: formData.area,
      coordinates: coords,
      isProfileActive: true
    });

    // Обновляем локальное состояние
    setCurrentUser({
      ...currentUser,
      ...formData
    });

    // Перезапрашиваем пользователей рядом, чтобы сразу увидеть себя на карте
    await fetchNearbyUsers();

    // Возвращаемся на карту
    setCurrentScreen('main');
  };

  // 4. Подтверждение правил онбординга
  const handleAgreeRules = async () => {
    try {
      await api.agreeToRules();
    } catch (e) {
      console.warn('Agree rules error:', e);
    }
    setCurrentScreen('profile_create');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#E5DED5] p-0 sm:p-4">
      <div className="w-full max-w-[420px] h-screen sm:h-[840px] bg-zine-paper sm:rounded-[36px] overflow-hidden shadow-2xl border-0 sm:border-[6px] sm:border-zine-ink flex flex-col relative">
        
        {/* Баннер, если сервер Render находится в спящем режиме ("холодный старт") */}
        {apiError && (
          <div className="absolute top-2 inset-x-2 z-50 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center justify-between shadow-lg">
            <span>⏳ {apiError}</span>
            <button
              onClick={() => fetchNearbyUsers()}
              className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]"
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

        {/* Экран Редактирования профиля */}
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
          />
        )}

        {/* Экран: Список / Лента людей */}
        {currentScreen === 'feed' && (
          <FeedScreen
            users={users}
            currentArea={currentUser.area}
            onSelectUser={(u) => setSelectedUser(u)}
            onOpenMap={() => {
              telegramService.haptic('selection');
              setCurrentScreen('main');
            }}
            onOpenProfile={() => {
              telegramService.haptic('selection');
              setCurrentScreen('profile_edit');
            }}
          />
        )}

        {/* BottomSheet детального просмотра анкеты из вкладки "Люди" */}
        {currentScreen === 'feed' && selectedUser && (
          <UserBottomSheet
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}

      </div>
    </div>
  );
};

export default App;
