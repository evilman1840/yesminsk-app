import React, { useState, useEffect } from 'react';
import { telegramService } from './services/telegram';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserBottomSheet } from './components/common/UserBottomSheet';
import { UserProfile, ActivityGoal } from './types';

// Начальные данные пользователей Минска для демонстрации
const INITIAL_USERS: UserProfile[] = [
  {
    id: '1',
    telegramId: 101,
    firstName: 'Полина',
    username: 'polina_minsk',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Люблю тихие улочки Осмоловки, пить фильтр в «Зерне» и обсуждать минский конструктивизм. Без свиданий, только дружеская компания! ☕️',
    goal: 'walk',
    areaName: 'Осмоловка',
    coordinates: [53.9115, 27.5612],
    distanceMeters: 350
  },
  {
    id: '2',
    telegramId: 102,
    firstName: 'Максим',
    username: 'max_nemiga',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Ищу компанию протестировать новые спешелти споты на Немиге и в Раковском. Люблю настолки и пешие маршруты.',
    goal: 'cafe_bar',
    areaName: 'Немига',
    coordinates: [53.9045, 27.5520],
    distanceMeters: 780
  },
  {
    id: '3',
    telegramId: 103,
    firstName: 'Алина',
    username: 'alina_art',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: 'Собираюсь на выставку в НЦСИ на Некрасова, буду рада компании ценителей современного арта и независимого кино.',
    goal: 'expo_cinema',
    areaName: 'Парк Победы',
    coordinates: [53.9240, 27.5450],
    distanceMeters: 1200
  },
  {
    id: '4',
    telegramId: 104,
    firstName: 'Денис',
    username: 'denis_nature',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Хочу выбраться на Минское море на закат или покататься на сапах. Ищу компанию на авто/шеринг.',
    goal: 'trip_outdoors',
    areaName: 'Минское море',
    coordinates: [53.9780, 27.4200],
    distanceMeters: 4500
  }
];

export const App: React.FC = () => {
  // Навигация по экранам: 'main' | 'onboarding' | 'profile_edit'
  const [currentScreen, setCurrentScreen] = useState<'main' | 'onboarding' | 'profile_edit'>('main');
  // Вкладки нижнего меню: 'map' | 'list'
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

  // Данные текущего пользователя
  const [currentUser, setCurrentUser] = useState({
    name: 'Алексей',
    age: '27',
    bio: 'Люблю гулять вдоль Свислочи от Троицкого до парка Горького, фотографировать город на плёнку.',
    goals: ['walk', 'cafe_bar'] as ActivityGoal[],
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    area: 'Осмоловка'
  });

  const [users] = useState<UserProfile[]>(INITIAL_USERS);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');

  useEffect(() => {
    telegramService.init();
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#E5DED5] p-0 sm:p-4">
      <div className="w-full max-w-[420px] h-screen sm:h-[840px] bg-zine-paper sm:rounded-[36px] overflow-hidden shadow-2xl border-0 sm:border-[6px] sm:border-zine-ink flex flex-col relative">
        
        {/* 1. Экран онбординга (Манифест) */}
        {currentScreen === 'onboarding' && (
          <OnboardingScreen onAgree={() => setCurrentScreen('main')} />
        )}

        {/* 2. Экран редактирования профиля */}
        {currentScreen === 'profile_edit' && (
          <ProfileFormScreen
            initialData={currentUser}
            onBack={() => setCurrentScreen('main')}
            onSave={(data) => {
              setCurrentUser({ ...currentUser, ...data });
              setCurrentScreen('main');
            }}
          />
        )}

        {/* 3. Главный экран: Интерактивная Карта */}
        {currentScreen === 'main' && activeTab === 'map' && (
          <MapScreen
            users={users}
            selectedUser={selectedUser}
            onSelectUser={setSelectedUser}
            selectedGoal={selectedGoal}
            onSelectGoal={setSelectedGoal}
            currentArea={currentUser.area}
            onOpenProfile={() => setCurrentScreen('profile_edit')}
            onOpenFeed={() => setActiveTab('list')}
          />
        )}

        {/* 4. Главный экран: Вкладка «Список» карточек */}
        {currentScreen === 'main' && activeTab === 'list' && (
          <FeedScreen
            users={users}
            onSelectUser={setSelectedUser}
            onOpenMap={() => setActiveTab('map')}
            onOpenProfile={() => setCurrentScreen('profile_edit')}
            currentArea={currentUser.area}
          />
        )}

        {/* Универсальная всплывающая шторка мини-профиля (Bottom Sheet) */}
        {selectedUser && (
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
