import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Shuffle, UserPlus, ChevronRight, HelpCircle } from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { api } from '../services/api';
import { telegramService } from '../services/telegram';
import { useBackButton, useMainButton } from '../hooks/useTelegram';
import { useOpenUser } from '../context/openUser';
import { GAME_TEXTS as T } from '../texts/games';
import { GameView, GamePlayer } from '../games/types';
import { SIZE, emptyBoard, place, winLineAt, botMove, BotLevel } from '../games/five';

/**
 * Мини-игра «Пять в ряд»: с ботом (целиком в приложении), со случайным игроком (вживую) или со знакомым по ссылке.
 * Партии с людьми ведёт сервер; приложение спрашивает о новых ходах раз в 1–4 секунды
 */

const SEARCH_BOT_OFFER_MS = 20 * 1000; // через 20 секунд поиска предлагаем бота

const store = {
  get(key: string, fallback: string) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* приватный режим */
    }
  }
};

type Phase = 'menu' | 'search' | 'game';

// ---------- Партия с ботом: та же форма, что у сервера ----------

function newBotGame(prev: GameView | null, level: BotLevel): GameView {
  const me = prev ? 1 - prev.me : 0; // по очереди: то ты первым, то бот
  const user = telegramService.getUser();
  const mePlayer: GamePlayer = { incognito: false, name: user?.first_name || T.you, avatar: user?.photo_url || '', emoji: '', rematch: false, online: true };
  const botPlayer: GamePlayer = { incognito: false, name: T.bot, level: level === 'easy' ? 'полегче' : 'посложнее', avatar: '', emoji: '🤖', rematch: false, online: true, isBot: true };
  return {
    id: `bot-${Date.now()}`,
    game: 'five',
    mode: 'bot',
    status: 'active',
    board: emptyBoard(),
    size: SIZE,
    turn: 0,
    me,
    moves: 0,
    lastMove: -1,
    winner: -1,
    players: me === 0 ? [mePlayer, botPlayer] : [botPlayer, mePlayer]
  };
}

function applyMove(g: GameView, cell: number): GameView {
  const mark = g.turn === 0 ? 'x' : 'o';
  const board = place(g.board, cell, mark);
  const line = winLineAt(board, cell);
  const full = !board.includes('.');
  return {
    ...g,
    board,
    lastMove: cell,
    moves: g.moves + 1,
    turn: 1 - g.turn,
    ...(line ? { status: 'finished', winner: g.turn, winLine: line, reason: 'win' } : full ? { status: 'finished', winner: -1, reason: 'draw' } : {})
  };
}

// ---------- Экран ----------

export const GamesScreen: React.FC<{
  initial?: { id?: string; code?: string };
  onBack: () => void;
}> = ({ initial, onBack }) => {
  const openUser = useOpenUser();
  const [phase, setPhase] = useState<Phase>(initial?.id || initial?.code ? 'game' : 'menu');
  const [game, setGame] = useState<GameView | null>(null);
  const [incognito, setIncognitoState] = useState(() => store.get('yesminsk_game_incognito', '0') === '1');
  const [level, setLevelState] = useState<BotLevel>(() => (store.get('yesminsk_game_level', 'easy') === 'normal' ? 'normal' : 'easy'));
  const [mine, setMine] = useState<GameView[]>([]);
  const [searchStarted, setSearchStarted] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [rematchAsked410, setRematchGone] = useState(false);
  const [bubble, setBubble] = useState<{ from: number; text: string; key: string } | null>(null);
  const [blockedDone, setBlockedDone] = useState(false);
  // «Как играть»: сам открывается перед первой партией, потом — по кнопке
  const [rulesOpen, setRulesOpen] = useState(false);
  // Конец партии: конфетти или падающие эмодзи, один раз на партию
  const [celebrate, setCelebrate] = useState<{ kind: 'win' | 'lose' | 'draw'; key: string } | null>(null);
  const celebrated = useRef('');
  const rulesSeen = useRef(store.get('yesminsk_game_rules_seen', '0') === '1');
  const openRules = () => {
    telegramService.haptic('light');
    setRulesOpen(true);
  };
  const closeRules = () => {
    setRulesOpen(false);
    rulesSeen.current = true;
    store.set('yesminsk_game_rules_seen', '1');
  };
  const lastSayAt = useRef('');
  const gameRef = useRef<GameView | null>(null);
  gameRef.current = game;
  // Реванша не будет: соперник ушёл, отказался ждать или его заблокировали — предлагаем другого
  const rematchGone = rematchAsked410 || Boolean(game && game.mode === 'random' && game.status === 'finished' && game.reason === 'left');

  const setIncognito = (v: boolean) => {
    telegramService.haptic('selection');
    setIncognitoState(v);
    store.set('yesminsk_game_incognito', v ? '1' : '0');
  };
  const setLevel = (v: BotLevel) => {
    telegramService.haptic('selection');
    setLevelState(v);
    store.set('yesminsk_game_level', v);
  };

  const fail = (err: any) => {
    telegramService.alert(err?.message || T.errorGeneric);
  };

  // Ответ сервера: та же партия, новая (подобрали соперника, реванш) или эмодзи от соперника
  const movePending = useRef(false);
  const receive = useCallback((next: GameView) => {
    const prev = gameRef.current;
    // Устаревший ответ (опрос ответил раньше, чем дошёл наш ход) — не затираем доску
    if (prev && prev.id === next.id && prev.mode !== 'bot') {
      const pv = prev.v ?? 0, nv = next.v ?? 0;
      if (nv < pv || (movePending.current && nv === pv)) return;
    }
    if (next.say && next.say.at !== lastSayAt.current) {
      lastSayAt.current = next.say.at;
      if (next.say.from !== next.me) {
        setBubble({ from: next.say.from, text: next.say.text, key: next.say.at });
        telegramService.haptic('light');
      }
    }
    if (prev && prev.id === next.id) {
      if (next.status === 'active' && next.moves > prev.moves && next.turn === next.me) telegramService.haptic('light'); // соперник сходил
      if (prev.status !== 'finished' && next.status === 'finished') telegramService.haptic(next.winner === next.me ? 'success' : next.winner === -1 ? 'medium' : 'warning');
    }
    if (prev?.status === 'searching' && next.status === 'active') telegramService.haptic('success');
    if (prev?.id !== next.id) {
      setRematchGone(false);
      setBlockedDone(false);
    }
    setGame(next);
    if (next.status === 'searching') setPhase('search');
    else if (next.status !== 'cancelled') setPhase('game');
  }, []);

  // Открыли по ссылке: «Твой ход» от бота или приглашение знакомого
  useEffect(() => {
    if (initial?.id) api.gameGet(initial.id).then(receive).catch((e) => { fail(e); setPhase('menu'); });
    else if (initial?.code) api.gameJoin(initial.code, incognito).then(receive).catch((e) => { fail(e); setPhase('menu'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Мои партии со знакомыми — в меню
  useEffect(() => {
    if (phase !== 'menu') return;
    api.gameMine().then(setMine).catch(() => {});
  }, [phase]);

  // Опрос сервера «долгим запросом»: сервер отвечает, как только соперник сходил, подобрался соперник или
  // кто-то нажал «Ещё партию». Пока приложение свёрнуто — не спрашиваем (в живой партии соперник через 45 секунд
  // получит победу, как и раньше). Опрашиваем, пока партия может поменяться
  const pollKey = (() => {
    if (!game || game.mode === 'bot' || game.status === 'cancelled') return null;
    if (game.status === 'finished') {
      if (game.nextId || rematchGone) return null;
      if (game.mode === 'invite' && !game.players[game.me]?.rematch && !game.players[1 - game.me]?.rematch) return null;
      return `${game.id}:finished`;
    }
    return game.id;
  })();
  useEffect(() => {
    if (!pollKey) return;
    const id = pollKey.split(':')[0];
    const ctrl = new AbortController();
    let stop = false;
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    const visible = () =>
      new Promise<void>((resolve) => {
        if (!document.hidden) return resolve();
        const on = () => {
          if (document.hidden && !stop) return;
          document.removeEventListener('visibilitychange', on);
          ctrl.signal.removeEventListener('abort', on);
          resolve();
        };
        document.addEventListener('visibilitychange', on);
        ctrl.signal.addEventListener('abort', on);
      });
    const finishedSince = Date.now();
    (async () => {
      while (!stop) {
        await visible();
        const g = gameRef.current;
        if (stop || !g || g.id !== id) break;
        if (g.status === 'finished' && Date.now() - finishedSince > 70 * 1000) break; // «ещё партию» ждём не дольше минуты
        const started = Date.now();
        try {
          const next = await api.gameGet(id, { since: g.v ?? 0, wait: true, signal: ctrl.signal });
          if (stop) break;
          receive(next);
          // Сервер ответил сразу и без новостей (например, их стало несколько) — не частим
          if (Date.now() - started < 1000 && (next.v ?? 0) === (g.v ?? 0)) await sleep(1500);
        } catch {
          if (stop) break;
          await sleep(3000); // нет сети — попробуем снова
        }
      }
    })();
    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [pollKey, receive]);

  // Партия с ботом закончилась — в статистику автора
  const reportedBot = useRef('');
  useEffect(() => {
    if (game?.mode === 'bot' && game.status === 'finished' && reportedBot.current !== game.id) {
      reportedBot.current = game.id;
      api.gameBotPlayed();
    }
  }, [game]);

  // Оба нажали «Ещё партию» — переходим в новую
  useEffect(() => {
    if (game?.nextId && game.mode !== 'bot') api.gameGet(game.nextId).then(receive).catch(() => {});
  }, [game?.nextId, game?.mode, receive]);

  // Ход бота
  useEffect(() => {
    if (!game || game.mode !== 'bot' || game.status !== 'active' || game.turn === game.me || rulesOpen) return;
    const t = window.setTimeout(() => {
      setGame((g) => {
        if (!g || g.mode !== 'bot' || g.status !== 'active' || g.turn === g.me) return g;
        const next = applyMove(g, botMove(g.board, g.turn === 0 ? 'x' : 'o', level));
        if (next.status === 'finished') telegramService.haptic(next.winner === next.me ? 'success' : next.winner === -1 ? 'medium' : 'warning');
        else telegramService.haptic('light');
        return next;
      });
    }, 450 + Math.random() * 500);
    return () => window.clearTimeout(t);
  }, [game, level, rulesOpen]);

  useEffect(() => {
    if (phase === 'game' && game && !rulesSeen.current) setRulesOpen(true);
  }, [phase, game]);

  useEffect(() => {
    if (!game || game.status !== 'finished' || celebrated.current === game.id) return;
    celebrated.current = game.id;
    setCelebrate({ kind: game.winner === -1 ? 'draw' : game.winner === game.me ? 'win' : 'lose', key: game.id });
    if (game.winner === game.me) window.setTimeout(() => telegramService.haptic('heavy'), 250); // второй толчок — «салют»
  }, [game]);
  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(null), 4800);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  // Пузырь с эмодзи соперника гаснет сам
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 3500);
    return () => window.clearTimeout(t);
  }, [bubble]);

  // Часы поиска
  useEffect(() => {
    if (phase !== 'search') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // ---------- Действия ----------

  const startBot = (prev: GameView | null = null) => {
    telegramService.haptic('medium');
    setRematchGone(false);
    setBlockedDone(false);
    setGame(newBotGame(prev?.mode === 'bot' ? prev : null, level));
    setPhase('game');
  };

  const startSearch = async () => {
    telegramService.haptic('medium');
    setBusy(true);
    setSearchStarted(Date.now());
    setNow(Date.now());
    try {
      receive(await api.gameSearch(incognito));
    } catch (e) {
      fail(e);
      setPhase('menu');
    } finally {
      setBusy(false);
    }
  };

  const startInvite = async () => {
    telegramService.haptic('medium');
    setBusy(true);
    try {
      const g = await api.gameInvite(incognito);
      receive(g);
      if (g.inviteCode) telegramService.shareGameInvite(g.inviteCode);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const cancelCurrent = async () => {
    const g = gameRef.current;
    if (g && g.mode !== 'bot' && (g.status === 'searching' || g.status === 'waiting')) api.gameLeave(g.id).catch(() => {});
    setGame(null);
    setPhase('menu');
  };

  const searchToBot = () => {
    cancelCurrent();
    startBot();
  };

  const tapCell = async (cell: number) => {
    const g = gameRef.current;
    if (!g || g.status !== 'active' || g.turn !== g.me || g.board[cell] !== '.') return;
    telegramService.haptic('light');
    const optimistic = applyMove(g, cell);
    setGame(optimistic);
    if (g.mode === 'bot') {
      if (optimistic.status === 'finished') telegramService.haptic(optimistic.winner === optimistic.me ? 'success' : 'medium');
      return;
    }
    movePending.current = true;
    try {
      const done = await api.gameMove(g.id, cell);
      movePending.current = false;
      receive(done);
    } catch (e: any) {
      movePending.current = false;
      if (e?.data?.game) receive(e.data.game);
      else {
        setGame(g); // ход не дошёл — возвращаем доску
        telegramService.haptic('error');
      }
    }
  };

  const say = (key: string, text: string) => {
    const g = gameRef.current;
    if (!g || g.mode === 'bot') return;
    telegramService.haptic('light');
    setBubble({ from: g.me, text, key: String(Date.now()) });
    api.gameSay(g.id, key).then((next) => { if (next.say) lastSayAt.current = next.say.at; }).catch(() => {});
  };

  const resign = async () => {
    const g = gameRef.current;
    if (!g || g.status !== 'active') return;
    if (!(await telegramService.confirm(T.resignConfirm, { okText: T.resign, destructive: true }))) return;
    if (g.mode === 'bot') {
      setGame({ ...g, status: 'finished', winner: 1 - g.me, reason: 'resign' });
      return;
    }
    api.gameLeave(g.id).then(receive).catch(fail);
  };

  const again = async () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.mode === 'bot') return startBot(g);
    if (rematchGone) return startSearch();
    telegramService.haptic('medium');
    try {
      receive(await api.gameRematch(g.id));
    } catch (e: any) {
      if (e?.status === 410) setRematchGone(true);
      else fail(e);
    }
  };

  const block = async () => {
    const g = gameRef.current;
    if (!g || g.mode === 'bot') return;
    if (!(await telegramService.confirm(T.blockConfirm, { okText: T.blockYes, destructive: true }))) return;
    try {
      await api.gameBlock(g.id);
      telegramService.haptic('success');
      setBlockedDone(true);
      setRematchGone(true);
      api.gameGet(g.id).then(receive).catch(() => {});
    } catch (e) {
      fail(e);
    }
  };

  // «Назад»: из партии — в меню (живую партию со случайным игроком — только сдавшись), из меню — из игр
  const back = async () => {
    const g = gameRef.current;
    if (phase === 'menu') return onBack();
    if (phase === 'search') return cancelCurrent();
    if (g && g.mode === 'random' && g.status === 'active') {
      if (!(await telegramService.confirm(T.leaveLive, { okText: T.leaveYes, destructive: true }))) return;
      api.gameLeave(g.id).catch(() => {});
    }
    setGame(null);
    setPhase('menu');
  };
  useBackButton(back);

  // Главная кнопка: «Ещё партию» после окончания
  const finished = game?.status === 'finished';
  const iAskedRematch = Boolean(game && game.mode !== 'bot' && game.players[game.me]?.rematch && !game.nextId);
  const mainText = rematchGone ? T.otherOpponent : iAskedRematch ? T.againWaiting : T.again;
  const isNativeMain = useMainButton({
    text: mainText,
    onClick: again,
    enabled: !iAskedRematch && !(blockedDone && game?.mode === 'invite'),
    loading: iAskedRematch,
    active: phase === 'game' && finished && !(blockedDone && game?.mode === 'invite')
  });

  // ---------- Вид ----------

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden select-none">
      <header className="shrink-0 px-5 pt-5 pb-2">
        <div className="flex items-center gap-1">
          {!telegramService.isInsideTelegram() && (
            <button onClick={back} aria-label="Назад" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer">
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="font-serif font-bold text-display text-zine-ink">{T.title}</h1>
        </div>
        {phase === 'menu' && (
          <>
            <p className="mt-1 text-sm2 text-zine-inkMuted">{T.subtitle}</p>
            <button onClick={openRules} className="mt-2 -ml-1 h-10 px-2 inline-flex items-center gap-1.5 rounded-full text-zine-terracotta text-sm2 font-bold cursor-pointer active:opacity-70">
              <HelpCircle size={18} /> {T.howToPlay}
            </button>
          </>
        )}
      </header>

      {phase === 'menu' && (
        <main className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          <MiniBoardArt />

          {/* С ботом */}
          <section className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden">
            <MenuRow icon={<Bot size={22} />} title={T.withBot} hint={T.withBotHint} onClick={() => startBot()} />
            <div className="px-4 pb-3 flex gap-2">
              {(['easy', 'normal'] as BotLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`h-9 px-3.5 rounded-full text-sm2 font-semibold border cursor-pointer active:scale-95 transition-transform ${
                    level === l ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-transparent text-zine-ink border-zine-border'
                  }`}
                >
                  {l === 'easy' ? T.levelEasy : T.levelNormal}
                </button>
              ))}
            </div>
          </section>

          {/* С людьми */}
          <section className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden">
            <MenuRow icon={<Shuffle size={22} />} title={T.withRandom} hint={T.withRandomHint} onClick={startSearch} disabled={busy} />
            <div className="ml-14 border-t border-zine-border" />
            <MenuRow icon={<UserPlus size={22} />} title={T.withFriend} hint={T.withFriendHint} onClick={startInvite} disabled={busy} />
            <div className="border-t border-zine-border" />
            <button onClick={() => setIncognito(!incognito)} className="w-full px-4 py-3.5 flex items-start gap-3 text-left cursor-pointer" role="switch" aria-checked={incognito}>
              <span className="w-8 shrink-0 text-[22px] leading-7 text-center">🕶</span>
              <span className="flex-1 min-w-0">
                <span className="block text-body font-bold text-zine-ink">{T.incognito}</span>
                <span className="block mt-0.5 text-cap text-zine-inkMuted">{incognito ? T.incognitoOn : T.incognitoOff}</span>
              </span>
              <span className={`mt-1 w-12 h-7 shrink-0 rounded-full p-0.5 transition-colors ${incognito ? 'bg-zine-terracotta' : 'bg-zine-border'}`}>
                <span className={`block w-6 h-6 rounded-full bg-white shadow-zine-sm transition-transform ${incognito ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          </section>

          {/* Партии со знакомыми */}
          {mine.length > 0 && (
            <section>
              <h2 className="px-1 mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">{T.myGames}</h2>
              <div className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden">
                {mine.map((g, i) => {
                  const opp = g.players[1 - g.me];
                  const status = g.status === 'waiting' ? T.waitingFriend : g.turn === g.me ? T.yourTurn : T.theirTurn;
                  return (
                    <React.Fragment key={g.id}>
                      {i > 0 && <div className="ml-16 border-t border-zine-border" />}
                      <button
                        onClick={() => {
                          telegramService.haptic('light');
                          receive(g);
                        }}
                        className="w-full min-h-[56px] px-4 py-2.5 flex items-center gap-3 text-left cursor-pointer active:bg-zine-card"
                      >
                        <Avatar player={opp} size={40} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-body font-semibold text-zine-ink truncate">{opp ? opp.name : '…'}</span>
                          <span className={`block text-cap ${g.status === 'active' && g.turn === g.me ? 'text-zine-terracotta font-bold' : 'text-zine-inkMuted'}`}>{status}</span>
                        </span>
                        <ChevronRight size={20} className="text-zine-inkMuted shrink-0" />
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      )}

      {phase === 'search' && (
        <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="relative w-28 h-28 mb-6">
            <span className="absolute inset-0 rounded-full bg-zine-terracotta/15 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-zine-terracotta/10 flex items-center justify-center text-[52px]">🎲</span>
          </div>
          <h2 className="font-serif font-bold text-title text-zine-ink">{T.searching}</h2>
          <p className="mt-2 text-sm2 text-zine-inkMuted">{T.searchingHint}</p>
          <p className="mt-3 text-body font-semibold tabular-nums text-zine-ink">{formatElapsed(now - searchStarted)}</p>
          {incognito && <p className="mt-2 text-cap text-zine-inkMuted">{T.incognitoBadge}</p>}
          {now - searchStarted > SEARCH_BOT_OFFER_MS && <p className="mt-5 text-body text-zine-ink">{T.searchNobody}</p>}
          <div className="mt-5 w-full flex flex-col gap-2">
            <button onClick={searchToBot} className="h-12 rounded-full bg-zine-ink text-zine-paper text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
              🤖 {T.playBotInstead}
            </button>
            <button onClick={cancelCurrent} className="h-12 rounded-full text-zine-inkMuted text-body font-semibold cursor-pointer">
              {T.cancelSearch}
            </button>
          </div>
        </main>
      )}

      {phase === 'game' && !game && (
        <main className="flex-1 flex items-center justify-center text-zine-inkMuted text-body">Загружаем партию…</main>
      )}

      {phase === 'game' && game && (
        <main className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col">
          <PlayersBar game={game} bubble={bubble} onOpen={(id) => openUser(id)} />

          <div className="mt-1 mb-2 h-6 text-center text-sm2 font-semibold">
            {game.status === 'active' && (
              <span className={game.turn === game.me ? 'text-zine-terracotta' : 'text-zine-inkMuted'}>
                {game.turn === game.me ? `${T.yourMove} ${game.me === 0 ? '✕' : '◯'}` : game.mode === 'bot' ? T.botThinking : T.theirMove}
              </span>
            )}
          </div>

          <Board game={game} onTap={tapCell} />

          {game.status === 'waiting' && (
            <div className="mt-4 p-4 rounded-zine bg-zine-card text-center">
              <p className="text-body text-zine-ink">{T.waitingInvite}</p>
              <p className="mt-1 text-cap text-zine-inkMuted">{T.waitingInviteAway}</p>
              <div className="mt-3 flex gap-2 justify-center">
                <button onClick={() => game.inviteCode && telegramService.shareGameInvite(game.inviteCode)} className="h-11 px-4 rounded-full bg-zine-ink text-zine-paper text-sm2 font-bold cursor-pointer">
                  {T.shareAgain}
                </button>
                <button onClick={cancelCurrent} className="h-11 px-4 rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer">
                  {T.cancelInvite}
                </button>
              </div>
            </div>
          )}

          {game.status === 'active' && (
            <>
              {game.mode !== 'bot' && <SayBar onSay={say} />}
              <div className="mt-3 flex justify-center gap-1">
                <button onClick={openRules} className="h-11 px-4 rounded-full text-zine-inkMuted text-sm2 font-semibold cursor-pointer inline-flex items-center gap-1.5">
                  <HelpCircle size={17} /> {T.howToPlay}
                </button>
                <button onClick={resign} className="h-11 px-4 rounded-full text-zine-inkMuted text-sm2 font-semibold cursor-pointer">
                  🏳️ {T.resign}
                </button>
              </div>
            </>
          )}

          {finished && (
            <ResultCard
              game={game}
              rematchGone={rematchGone}
              blockedDone={blockedDone}
              showMainFallback={!isNativeMain && !(blockedDone && game.mode === 'invite')}
              mainText={mainText}
              mainDisabled={iAskedRematch}
              onAgain={again}
              onOther={startSearch}
              onMenu={() => {
                setGame(null);
                setPhase('menu');
              }}
              onOpenProfile={(id) => openUser(id)}
              onBlock={block}
            />
          )}
        </main>
      )}

      {rulesOpen && <RulesSheet onClose={closeRules} />}
      {celebrate && <Celebration key={celebrate.key} kind={celebrate.kind} />}
    </div>
  );
};

// ---------- Части экрана ----------

// Маленькое поле 5×5 с подсвеченной линией — картинка к правилу
const RuleArt: React.FC<{ line: number[]; extra?: [number, 'x' | 'o'][] }> = ({ line, extra = [] }) => (
  <div className="w-[76px] shrink-0 grid grid-cols-5 gap-px p-px rounded-md bg-zine-border overflow-hidden" aria-hidden>
    {Array.from({ length: 25 }, (_, i) => {
      const other = extra.find(([c]) => c === i);
      return (
        <span key={i} className={`aspect-square flex items-center justify-center ${line.includes(i) ? 'bg-zine-terracotta/20' : 'bg-zine-cardElevated'}`}>
          {line.includes(i) ? <Mark mark="x" /> : other ? <Mark mark={other[1]} /> : null}
        </span>
      );
    })}
  </div>
);

const RulesSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BottomSheet
    title={T.rulesTitle}
    onClose={onClose}
    footer={
      <button onClick={onClose} className="w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
        {T.rulesOk}
      </button>
    }
  >
    <div className="pb-4 space-y-4">
      <p className="text-body text-zine-ink">{T.rulesGoal}</p>
      <div className="flex gap-2 justify-between">
        <RuleArt line={[10, 11, 12, 13, 14]} />
        <RuleArt line={[2, 7, 12, 17, 22]} />
        <RuleArt line={[0, 6, 12, 18, 24]} />
      </div>
      <ul className="space-y-2.5">
        {T.rules.map(([emoji, text]) => (
          <li key={text} className="flex gap-3 text-body text-zine-ink">
            <span className="w-6 shrink-0 text-center">{emoji}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="p-3.5 rounded-zine-sm bg-zine-card flex gap-3 items-center">
        <RuleArt line={[]} extra={[[11, 'x'], [12, 'x'], [13, 'x'], [14, 'o']]} />
        <p className="text-sm2 text-zine-ink">
          <b>{T.rulesTipTitle}</b> {T.rulesTip}
        </p>
      </div>
    </div>
  </BottomSheet>
);

const formatElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const MenuRow: React.FC<{ icon: React.ReactNode; title: string; hint: string; onClick: () => void; disabled?: boolean }> = ({ icon, title, hint, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="w-full min-h-[64px] px-4 py-3 flex items-center gap-3 text-left cursor-pointer active:bg-zine-card disabled:opacity-60">
    <span className="w-8 h-8 shrink-0 flex items-center justify-center text-zine-terracotta">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-body font-bold text-zine-ink">{title}</span>
      <span className="block text-cap text-zine-inkMuted">{hint}</span>
    </span>
    <ChevronRight size={20} className="text-zine-inkMuted shrink-0" />
  </button>
);

// Картинка в меню: кусочек поля с пятью в ряд
const MiniBoardArt: React.FC = () => {
  const xs = [12, 23, 34, 45, 56];
  const os = [13, 24, 33, 44, 22];
  return (
    <div className="mx-auto w-40 grid grid-cols-7 gap-px rounded-zine-sm overflow-hidden bg-zine-border border border-zine-border" aria-hidden>
      {Array.from({ length: 49 }, (_, i) => {
        const r = Math.floor(i / 7), c = i % 7;
        const id = r * 10 + c + 1;
        return (
          <span key={i} className={`aspect-square flex items-center justify-center ${xs.includes(id) ? 'bg-zine-terracotta/15' : 'bg-zine-cardElevated'}`}>
            {xs.includes(id) ? <Mark mark="x" /> : os.includes(id) ? <Mark mark="o" /> : null}
          </span>
        );
      })}
    </div>
  );
};

const Mark: React.FC<{ mark: 'x' | 'o' }> = ({ mark }) =>
  mark === 'x' ? (
    <svg viewBox="0 0 24 24" className="w-[70%] h-[70%] text-zine-terracotta" aria-label="крестик">
      <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-[70%] h-[70%] text-zine-plum" aria-label="нолик">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="3" fill="none" />
    </svg>
  );

const Avatar: React.FC<{ player?: GamePlayer; size: number }> = ({ player, size }) => {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (player?.avatar && !broken) return <img src={player.avatar} alt="" style={style} onError={() => setBroken(true)} className="rounded-full object-cover bg-zine-card shrink-0" />;
  return (
    <span style={{ ...style, fontSize: size * 0.55 }} className="rounded-full bg-zine-card flex items-center justify-center shrink-0 leading-none">
      {player?.emoji || (player?.name ? player.name[0] : '?')}
    </span>
  );
};

const PlayersBar: React.FC<{ game: GameView; bubble: { from: number; text: string; key: string } | null; onOpen: (telegramId: number) => void }> = ({ game, bubble, onOpen }) => {
  const order = [game.me, 1 - game.me];
  return (
    <div className="grid grid-cols-2 gap-2">
      {order.map((idx) => {
        const p = game.players[idx];
        const isMe = idx === game.me;
        const active = game.status === 'active' && game.turn === idx;
        const canOpen = !isMe && p && !p.incognito && !p.isBot && p.telegramId;
        return (
          <div key={idx} className="relative">
            <button
              onClick={() => canOpen && onOpen(p.telegramId!)}
              disabled={!canOpen}
              className={`w-full h-16 px-3 rounded-zine-sm flex items-center gap-2.5 text-left border transition-colors ${
                active ? 'bg-zine-cardElevated border-zine-terracotta/60 shadow-zine-sm' : 'bg-zine-card border-transparent'
              } ${canOpen ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            >
              <span className="relative">
                <Avatar player={p || { incognito: false, name: '', avatar: '', emoji: '👋', rematch: false, online: false }} size={40} />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zine-cardElevated border border-zine-border flex items-center justify-center">
                  <Mark mark={idx === 0 ? 'x' : 'o'} />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm2 font-bold text-zine-ink truncate">{isMe ? T.you : p?.name || T.friend}</span>
                <span className="block text-cap text-zine-inkMuted truncate">
                  {isMe ? (p?.incognito ? `🕶 ${p.emoji} ${p.name}` : p?.name) : !p ? T.friendWaiting : p.isBot ? p.level : p.incognito ? '🕶 инкогнито' : canOpen ? 'анкета ›' : ''}
                </span>
              </span>
            </button>
            {bubble && bubble.from === idx && (
              <span key={bubble.key} className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 px-3 py-1.5 rounded-full bg-zine-ink text-zine-paper text-sm2 font-semibold whitespace-nowrap shadow-zine-float">
                {bubble.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Board: React.FC<{ game: GameView; onTap: (cell: number) => void }> = ({ game, onTap }) => {
  const win = new Set(game.winLine || []);
  const myTurn = game.status === 'active' && game.turn === game.me;
  return (
    <div className={`w-full shrink-0 aspect-square grid gap-px p-px rounded-zine-sm bg-zine-border overflow-hidden ${myTurn ? '' : 'opacity-[0.97]'}`} style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${game.size}, minmax(0, 1fr))` }}>
      {Array.from(game.board).map((ch, i) => (
        <button
          key={i}
          onClick={() => onTap(i)}
          disabled={!myTurn || ch !== '.'}
          aria-label={`Клетка ${Math.floor(i / game.size) + 1}-${(i % game.size) + 1}`}
          className={`min-w-0 min-h-0 flex items-center justify-center ${win.has(i) ? 'game-win-cell' : ''} ${
            win.has(i) ? (ch === 'x' ? 'bg-zine-terracotta/25' : 'bg-zine-plum/25') : i === game.lastMove ? 'bg-zine-mustard/25' : 'bg-zine-cardElevated'
          } ${myTurn && ch === '.' ? 'active:bg-zine-card cursor-pointer' : ''}`}
          style={{ WebkitTapHighlightColor: 'transparent', ...(win.has(i) ? ({ '--delay': `${(game.winLine || []).indexOf(i) * 0.08}s` } as React.CSSProperties) : {}) }}
        >
          {ch === 'x' && <Mark mark="x" />}
          {ch === 'o' && <Mark mark="o" />}
        </button>
      ))}
    </div>
  );
};

const SayBar: React.FC<{ onSay: (key: string, text: string) => void }> = ({ onSay }) => (
  <div className="mt-3 -mx-3 px-3 overflow-x-auto [scrollbar-width:none]">
    <div className="flex gap-1.5 w-max">
      {T.emojis.map(([key, e]) => (
        <button
          key={key}
          onClick={() => onSay(key, e)}
          className={`h-11 rounded-full bg-zine-card text-[22px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${key === 'six7' ? 'px-2.5 gap-0.5' : 'w-11'}`}
        >
          {e}
        </button>
      ))}
      {T.phrases.map(([k, text]) => (
        <button key={k} onClick={() => onSay(k, text)} className="h-11 px-3.5 rounded-full bg-zine-card text-sm2 font-semibold text-zine-ink whitespace-nowrap cursor-pointer active:scale-95 transition-transform">
          {text}
        </button>
      ))}
    </div>
  </div>
);

// Конфетти и эмодзи поверх экрана: при победе — салют из центра и дождь конфетти, при проигрыше — медленно падают 💀😭🥀,
// при ничьей — 🤝. Нажатия проходят насквозь. При «уменьшить движение» в системе не показываем
const CONFETTI = ['--c-terracotta', '--c-mustard', '--c-sage', '--c-plum', '--c-sky', '--c-blush'];
const Celebration: React.FC<{ kind: 'win' | 'lose' | 'draw' }> = ({ kind }) => {
  const parts = React.useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const out: { cls: string; style: React.CSSProperties; content?: string }[] = [];
    if (kind === 'win') {
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2;
        const dist = rnd(110, 190);
        out.push({
          cls: 'game-burst rounded-sm',
          style: { width: 9, height: 14, background: `rgb(var(${CONFETTI[i % CONFETTI.length]}))`, '--bx': `${Math.cos(angle) * dist}px`, '--by': `${Math.sin(angle) * dist}px`, '--rot': `${rnd(-360, 360)}deg`, '--delay': `${rnd(0, 0.12)}s` } as React.CSSProperties
        });
      }
      for (let i = 0; i < 46; i++) {
        const emoji = i % 6 === 0 ? ['🎉', '✨', '🔥', '⭐'][i % 4] : '';
        out.push({
          cls: `game-fall ${emoji ? 'text-[24px]' : 'rounded-sm'}`,
          content: emoji,
          style: {
            left: `${rnd(0, 100)}%`,
            ...(emoji ? {} : { width: rnd(7, 11), height: rnd(10, 16), background: `rgb(var(${CONFETTI[i % CONFETTI.length]}))` }),
            '--dx': `${rnd(-60, 60)}px`, '--rot': `${rnd(-540, 540)}deg`, '--dur': `${rnd(2.2, 3.6)}s`, '--delay': `${rnd(0.2, 1.2)}s`
          } as React.CSSProperties
        });
      }
    } else {
      const set = kind === 'lose' ? ['💀', '😭', '🥀', '🫠', '🙈'] : ['🤝', '✨'];
      const n = kind === 'lose' ? 18 : 12;
      for (let i = 0; i < n; i++) {
        out.push({
          cls: 'game-fall',
          content: set[i % set.length],
          style: { left: `${rnd(2, 92)}%`, fontSize: rnd(26, 40), '--dx': `${rnd(-30, 30)}px`, '--rot': `${rnd(-90, 90)}deg`, '--dur': `${rnd(2.8, 4.2)}s`, '--delay': `${rnd(0, 1.2)}s` } as React.CSSProperties
        });
      }
    }
    return out;
  }, [kind]);
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden" aria-hidden>
      {parts.map((p, i) => (
        <span key={i} className={p.cls} style={p.style}>
          {p.content}
        </span>
      ))}
    </div>
  );
};

const ResultCard: React.FC<{
  game: GameView;
  rematchGone: boolean;
  blockedDone: boolean;
  showMainFallback: boolean;
  mainText: string;
  mainDisabled: boolean;
  onAgain: () => void;
  onOther: () => void;
  onMenu: () => void;
  onOpenProfile: (telegramId: number) => void;
  onBlock: () => void;
}> = ({ game, rematchGone, blockedDone, showMainFallback, mainText, mainDisabled, onAgain, onOther, onMenu, onOpenProfile, onBlock }) => {
  const opp = game.players[1 - game.me];
  const won = game.winner === game.me;
  const title = game.winner === -1 ? T.draw : won ? T.win : game.mode === 'bot' ? T.loseBot : T.lose;
  const note =
    game.reason === 'resign' ? (won ? T.reasonResignThem : T.reasonResignMe) : game.reason === 'left' && won ? T.reasonLeft : game.reason === 'expired' ? T.reasonExpired : '';
  const oppWantsAgain = game.mode !== 'bot' && opp?.rematch && !game.players[game.me]?.rematch && !rematchGone;
  const canOpen = opp && !opp.incognito && !opp.isBot && opp.telegramId && !blockedDone;
  const kind = game.winner === -1 ? 'draw' : won ? 'win' : 'lose';
  // Значок и шутка — случайные, но одни и те же для этой партии
  const { icon, joke } = React.useMemo(() => {
    const pick = <V,>(list: V[]) => list[Math.floor(Math.random() * list.length)];
    return {
      icon: kind === 'win' ? pick(['🏆', '🥇', '👑']) : kind === 'lose' ? pick(['😵‍💫', '🥀', '🫠', '💀']) : '🤝',
      joke: pick(kind === 'win' ? T.winJokes : kind === 'lose' ? T.loseJokes : T.drawJokes)
    };
  }, [game.id, kind]);
  return (
    <div
      className={`mt-4 p-4 rounded-zine border shadow-zine text-center ${
        kind === 'win' ? 'bg-zine-mustard/15 border-zine-mustard/50 fade-swap' : kind === 'lose' ? 'bg-zine-cardElevated border-zine-border game-shake' : 'bg-zine-cardElevated border-zine-border fade-swap'
      }`}
    >
      <div className={`text-[64px] leading-none mb-2 inline-block ${kind === 'win' ? 'game-trophy' : kind === 'lose' ? 'game-wobble' : 'game-pop'}`} aria-hidden>
        {icon}
      </div>
      <h2 className={`font-serif font-bold text-display ${kind === 'win' ? 'text-zine-terracotta' : 'text-zine-ink'}`}>{title}</h2>
      <p className="mt-1 text-body font-semibold text-zine-ink">{joke}</p>
      {note && <p className="mt-1 text-sm2 text-zine-inkMuted">{note}</p>}
      {oppWantsAgain && <p className="mt-2 text-sm2 font-semibold text-zine-terracotta">{T.rematchAsked}</p>}
      {blockedDone && <p className="mt-2 text-sm2 text-zine-inkMuted">{T.blocked}</p>}

      {showMainFallback && (
        <button onClick={onAgain} disabled={mainDisabled} className="mt-4 w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-transform">
          {mainText}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        {game.mode === 'random' && !rematchGone && (
          <button onClick={onOther} className="h-11 px-4 rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer">
            {T.otherOpponent}
          </button>
        )}
        <button onClick={onMenu} className="h-11 px-4 rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer">
          {T.toMenu}
        </button>
      </div>

      {(canOpen || (game.mode !== 'bot' && !blockedDone)) && (
        <div className="mt-3 pt-3 border-t border-zine-border flex flex-wrap gap-2 justify-center">
          {canOpen && (
            <button onClick={() => onOpenProfile(opp.telegramId!)} className="h-11 px-4 rounded-full bg-zine-terracotta/10 text-zine-terracotta text-sm2 font-bold cursor-pointer">
              👋 {T.openProfile}
            </button>
          )}
          {game.mode !== 'bot' && !blockedDone && (
            <button onClick={onBlock} className="h-11 px-4 rounded-full text-zine-inkMuted text-sm2 font-semibold cursor-pointer">
              🚫 {T.block}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GamesScreen;
