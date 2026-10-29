import { createContext, useContext } from 'react';

/**
 * Модератор (ADMIN_TELEGRAM_IDS на сервере): может удалять любые сходки
 */
export const AdminContext = createContext(false);
export const useIsAdmin = () => useContext(AdminContext);

// Модератор удалил сходку — убрать её из списков, где бы она ни была открыта
export const EVENT_DELETED = 'yesminsk:event-deleted';
