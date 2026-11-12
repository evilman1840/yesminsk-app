import React, { useState } from 'react';
import { api } from '../services/api';
import { UserProfile } from '../types';
import { MatchModal } from '../components/common/Reactions';
import { HelloSheet, DuelSheet, UsernameSheet } from '../components/common/ConnectSheets';
import { GenderPrompt } from '../components/common/GenderPrompt';
import { FeedScreen } from '../screens/FeedScreen';
import { UserBottomSheet } from '../components/common/UserBottomSheet';
import { ResultCard } from '../screens/GamesScreen';
import { loadFilters } from '../components/people/PeopleFilters';
import { GameView } from '../games/types';
import { GoTogetherContext } from '../context/connect';

/**
 * Только для разработки: ?preview=connect&screen=… — новые экраны вокруг «На связи» на выдуманных данных.
 * В сборку для людей не попадает (main.tsx подгружает файл только в dev)
 */

const avatar = (letter: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><circle cx="150" cy="118" r="58" fill="#fff" opacity=".85"/><rect x="62" y="196" width="176" height="120" rx="88" fill="#fff" opacity=".85"/><text x="150" y="138" font-size="62" font-family="Georgia" font-weight="700" text-anchor="middle" fill="${bg}">${letter}</text></svg>`
  )}`;
const ME_AVATAR = avatar('М', '#B5462A');

const friend: UserProfile = {
  id: '2',
  telegramId: 2002,
  username: 'anya_walks',
  firstName: 'Аня',
  avatarUrl: avatar('А', '#5E8C6A'),
  photos: [],
  bio: 'Люблю длинные прогулки и кофе с видом на реку',
  goal: 'walk',
  goals: ['walk', 'cafe_bar', 'boardgames'],
  age: 27,
  gender: 'female',
  preferredGender: 'all',
  preferredAgeRange: { min: 18, max: 99 },
  coordinates: [53.9, 27.56],
  areaName: 'Немига / Центр',
  isMatch: true,
  iLiked: true,
  likedMe: true
} as any;

// Монетку в превью показываем каждый раз
try {
  localStorage.removeItem('yesminsk_coin_seen');
} catch {}

// Ответы сервера — выдуманные
(api as any).getHello = async () => ({
  friend: { telegramId: 2002, firstName: 'Аня', username: 'anya_walks', avatarUrl: friend.avatarUrl },
  phrases: [
    'Привет! Вижу, ты тоже хочешь погулять по парку на выходных. Соберём компанию?',
    'Привет! Настолки — это серьёзно. В какую можешь разнести всех?',
    'Привет! Мы оба из района «Немига / Центр». Где тут нормальный кофе?'
  ],
  firstMove: new URLSearchParams(location.search).get('coin') === 'them' ? 'them' : 'me'
});
(api as any).checkUsername = async () => {
  await new Promise((r) => setTimeout(r, 600));
  return { username: null };
};
(api as any).waveGateEvent = () => {};
(api as any).pickHello = () => {};
(api as any).updateProfile = async () => ({});

const finishedGame = (winner: number): GameView => ({
  id: 'g1',
  game: 'five',
  mode: 'invite',
  source: 'match',
  status: 'finished',
  board: '.'.repeat(100),
  size: 10,
  turn: 0,
  me: 0,
  moves: 31,
  lastMove: 44,
  winner,
  reason: 'win',
  players: [
    { incognito: false, telegramId: 1001, name: 'Миша', avatar: ME_AVATAR, emoji: '', rematch: false, online: true },
    { incognito: false, telegramId: 2002, name: 'Аня', avatar: friend.avatarUrl, emoji: '', rematch: false, online: true, username: 'anya_walks' }
  ]
});

export const ConnectPreview: React.FC = () => {
  const screen = new URLSearchParams(location.search).get('screen') || 'match-me';
  const coin = new URLSearchParams(location.search).get('coin') === 'them' ? 'them' : 'me';
  const [replay, setReplay] = useState(0);
  const noop = () => {};

  return (
    <GoTogetherContext.Provider value={noop}>
      <div className="min-h-screen bg-zine-paper" key={replay} onDoubleClick={() => setReplay((n) => n + 1)}>
        {screen === 'match' && <MatchModal user={friend} myAvatarUrl={ME_AVATAR} coin={coin} onClose={noop} onHello={noop} />}
        {screen === 'hello' && <HelloSheet friendId={2002 + replay} name="Аня" myAvatarUrl={ME_AVATAR} onClose={noop} />}
        {screen === 'duel' && <DuelSheet friendId={2002} name="Аня" onClose={noop} onStarted={noop} />}
        {screen === 'gender' && <GenderPrompt myAge={27} onSave={async () => {}} onSavePrefs={async () => {}} onChosen={noop} onClose={noop} />}
        {screen === 'username' && <UsernameSheet onDone={noop} onLater={noop} />}
        {screen === 'sheet' && (
          <UserBottomSheet user={friend} myGoals={['walk', 'boardgames']} onClose={noop} onReact={noop} onReported={noop} onGoTogether={noop} onHello={noop} onDuel={noop} />
        )}
        {screen === 'card' && (
          <div className="h-[100dvh] flex flex-col">
          <FeedScreen
            users={[]}
            matches={[friend]}
            openTab={{ tab: 'matches', at: 1 }}
            onSelectUser={noop}
            onReact={noop}
            onUnmatch={async () => {}}
            onGoTogether={noop}
            onHello={noop}
            onDuel={noop}
            selectedGoal="all"
            onSelectGoal={noop}
            myPrefs={{ preferredGender: 'all', preferredAgeRange: { min: 18, max: 99 } }}
            peopleFilters={loadFilters()}
            onChangePeopleFilters={noop}
            myGoals={['walk', 'boardgames']}
            myUsername="misha"
          />
          </div>
        )}
        {(screen === 'result-win' || screen === 'result-lose') && (
          <div className="p-4 max-w-[430px] mx-auto">
            <ResultCard
              game={finishedGame(screen === 'result-win' ? 0 : 1)}
              rematchGone={false}
              blockedDone={false}
              showMainFallback
              mainText="Ещё партию"
              mainDisabled={false}
              onAgain={noop}
              onOther={noop}
              onMenu={noop}
              onOpenProfile={noop}
              onBlock={noop}
            />
          </div>
        )}
      </div>
    </GoTogetherContext.Provider>
  );
};
