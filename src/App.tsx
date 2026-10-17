import React, { useState, useEffect, useCallback } from 'react';
import { telegramService } from './services/telegram';
import { api } from './services/api';
import { MapScreen } from './screens/MapScreen';
import { FeedScreen } from './screens/FeedScreen';
import { EventsScreen } from './screens/EventsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileFormScreen } from './screens/ProfileFormScreen';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender, AgeRange, EventCategory } from './types';

const AREA_COORDINATES: Record<string, [number, number]> = {
  'Немига / Центр': [53.9045, 27.5520],
  'Центр / Немига': [53.9045, 27.5520],
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
    area: 'Центр / Немига',
    isTourist: false,
    coordinates: [53.9045, 27.5520] as [number, number]
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchNearbyUsers = useCallback(async () => {
    try {
      setApiError(null);
      const coords = currentUser.coordinates || [53.9045, 27.5615];
      const data = await api.getNearbyUsers({
        goal: selectedGoal,
        lat: coords[0],
        lng: coords[1],
        radiusKm: 30
      });

      if (Array.isArray(data) && data.length > 0) {
        setUsers(data);
      } else if (Array.isArray(data) && selectedGoal !== 'all') {
        setUsers(data);
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки пользователей:', err);
    }
  }, [currentUser.coordinates, selectedGoal]);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getEvents();
      setEvents(data || []);
    } catch (err: any) {
      console.warn('Ошибка загрузки событий:', err);
    }
  }, []);

  useEffect(() => {
    telegramService.init();

    const initUserData = async () => {
      try {
        const me = await api.getMe();
        if (me) {
          const userCoords: [number, number] = (me.coordinates && Array.isArray(me.coordinates) && me.coordinates.length === 2)
            ? [Number(me.coordinates[0]), Number(me.coordinates[1])]
            : (AREA_COORDINATES[me.areaName] || [53.9045, 27.5520]);

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
            area: me.areaName || 'Центр / Немига',
            isTourist: Boolean(me.isTourist),
            coordinates: userCoords
          });
        }
      } catch (err) {
        console.warn('Профиль me не получен:', err);
      }

      await Promise.all([fetchNearbyUsers(), fetchEvents()]);
    };

    initUserData();
  }, [fetchNearbyUsers, fetchEvents]);

  // Коллбек обновления координат по кнопке GPS
  const handleUpdateUserCoordinates = (newCoords: [number, number]) => {
    setCurrentUser((prev) => ({
      ...prev,
      coordinates: newCoords
    }));
  };

  const handleSaveProfile = async (formData: {
    name: string;
    age: string;
    bio: string;
    gender: Gender;
    preferredGender: PreferredGender;
    preferredAgeRange: AgeRange;
    goal: ActivityGoal;
    goals: ActivityGoal[];
    avatarUrl: string;
    area: string;
    isTourist?: boolean;
    customCoordinates?: [number, number];
  }) => {
    const coords = formData.customCoordinates || AREA_COORDINATES[formData.area] || [53.9045, 27.5615];

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
      coordinates: coords
    });

    setCurrentUser((prev) => ({
      ...prev,
      ...formData,
      coordinates: coords
    }));

    setCurrentScreen('main');
    await fetchNearbyUsers();
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
        coordinates: created.coordinates || eventData.coordinates
      };
      setEvents((prev) => [normalized, ...prev]);
      return normalized;
    }
    throw new Error('Не удалось создать сходку');
  };

  const handleUpdateEvent = async (eventId: string, eventData: any): Promise<any> => {
    const updated = await api.updateEvent(eventId, eventData);
    if (updated) {
      setEvents((prev) =>
        prev.map((ev) =>
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
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId && (ev as any)._id !== eventId));
  };

  const handleToggleJoinEvent = async (event: AppEvent) => {
    const isJoined = Boolean(event.isJoined);
    await api.toggleJoinEvent(event.id, isJoined);
    setEvents((prev) =>
      prev.map((e) =>
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
  };

  return (
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
          <OnboardingScreen onAgree={() => setCurrentScreen('profile_create')} />
        )}

        {currentScreen === 'profile_create' && (
          <ProfileFormScreen isFirstTime={true} initialData={currentUser} onSave={handleSaveProfile} />
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
            onOpenProfile={() => setCurrentScreen('profile_edit')}
            onOpenFeed={() => setCurrentScreen('feed')}
            onOpenEvents={() => setCurrentScreen('events')}
            onToggleJoinEvent={handleToggleJoinEvent}
            onUpdateUserCoordinates={handleUpdateUserCoordinates}
          />
        )}

        {currentScreen === 'feed' && (
          <FeedScreen
            users={users}
            eventsCount={events.length}
            currentArea={currentUser.area}
            onSelectUser={(u) => setSelectedUser(u)}
            onOpenMap={() => setCurrentScreen('main')}
            onOpenEvents={() => setCurrentScreen('events')}
            onOpenProfile={() => setCurrentScreen('profile_edit')}
          />
        )}

        {currentScreen === 'events' && (
          <EventsScreen
            events={events}
            onCreateEvent={handleCreateEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onToggleJoin={handleToggleJoinEvent}
            onOpenMap={() => setCurrentScreen('main')}
            onOpenFeed={() => setCurrentScreen('feed')}
            onOpenProfile={() => setCurrentScreen('profile_edit')}
            currentUserId={currentUser.telegramId}
          />
        )}
      </div>
    </div>
  );
};

export default App;
