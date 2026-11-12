import { createContext, useContext } from 'react';

/**
 * «👯 Пойдём вместе» с человеком «На связи» из любого места (например, с экрана итога партии)
 */
export const GoTogetherContext = createContext<((telegramId: number) => void) | null>(null);
export const useGoTogether = () => useContext(GoTogetherContext);
