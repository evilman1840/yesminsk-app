import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UserProfile, ActivityGoal } from '../types';

export const useUsers = (selectedGoal: ActivityGoal | 'all') => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMapUsers({
        goal: selectedGoal,
        lat: 53.9045,
        lng: 27.5615,
        radiusKm: 20
      });
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  }, [selectedGoal]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refreshUsers: fetchUsers };
};
