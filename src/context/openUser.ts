import { createContext, useContext } from 'react';

/**
 * Открыть анкету человека из любого места (например, из «Кто идёт» в сходке)
 */
export const OpenUserContext = createContext<(telegramId: number) => void>(() => {});
export const useOpenUser = () => useContext(OpenUserContext);
