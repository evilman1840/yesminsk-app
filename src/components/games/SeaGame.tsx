import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Shuffle, UserPlus, ChevronRight, HelpCircle } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { useBackButton, useMainButton } from '../../hooks/useTelegram';
import { useOpenUser } from '../../context/openUser';
import { SEA_TEXTS as T } from '../../texts/sea';
import { GAME_TEXTS as GT } from '../../texts/games';
import { SeaView, SeaPlayer, SeaLobby } from '../../games/types';
import { askBotAccess } from '../../services/botAccess';
import { SEA, SEA_LETTERS, randomFleet, rotateShip, fire, shotView, shipsLeft, emptyShots, botShot, SeaBotLevel, ShotResult } from '../../games/sea';
import { formatElapsed, Toggle, PickRow, Avatar } from './GameBits';
import { Celebration } from './Celebration';

/**
 * «Морской бой» один на один: с ботом (целиком в приложении), со случайным игроком (вживую) или со знакомым по ссылке.
 * Партии с людьми ведёт сервер (/api/sea), приложение узнаёт о новостях долгим опросом — как в «Крестиках-Ноликах»
 */

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
type Pick = 'random' | 'bot' | 'friend';
const SEARCH_BOT_OFFER_MS = 20 * 1000;

// Партия с ботом: та же форма, что у сервера, плюс то, что знает только приложение
type SeaGameState = SeaView & { bot?: { fleet: string; myShots: string; botShots: string; level: SeaBotLevel } };

function newBotGame(prev: SeaGameState | null, level: SeaBotLevel, myFleet: string): SeaGameState {
  const me = prev ? 1 - prev.me : 0; // по очереди: то ты стреляешь первым, то бот
  const user = telegramService.getUser();
  const mePlayer: SeaPlayer = { incognito: false, name: user?.first_name || T.you, avatar: user?.photo_url || '', emoji: '', rematch: false, online: true };
  const botPlayer: SeaPlayer = { incognito: false, name: T.bot, level: level === 'easy' ? 'полегче' : 'посложнее', avatar: '', emoji: '🤖', rematch: false, online: true, isBot: true, ready: true };
  return {
    id: `bot-${Date.now()}`,
    game: 'sea',
    mode: 'bot',
    status: 'active',
    phase: 'placing',
    size: SEA,
    turn: 0,
    me,
    moves: 0,
    winner: -1,
    myFleet,
    myBoard: emptyShots(),
    enemyBoard: emptyShots(),
    shipsLeft: [10, 10],
    players: me === 0 ? [mePlayer, botPlayer] : [botPlayer, mePlayer],
    bot: { fleet: randomFleet(), myShots: emptyShots(), botShots: emptyShots(), level }
  };
}

// Выстрел в партии с ботом: shooter — индекс стреляющего
function botGameShot(g: SeaGameState, shooter: number, cell: number): { next: SeaGameState; result: ShotResult } {
  const b = g.bot!;
  const mine = shooter === g.me;
  const shot = mine ? fire(b.fleet, b.myShots, cell) : fire(g.myFleet, b.botShots, cell);
  const bot = { ...b, ...(mine ? { myShots: shot.shots } : { botShots: shot.shots }) };
  const next: SeaGameState = {
    ...g,
    bot,
    enemyBoard: shotView(b.fleet, bot.myShots),
    myBoard: shotView(g.myFleet, bot.botShots),
    shipsLeft: [shipsLeft(g.myFleet, bot.botShots), shipsLeft(b.fleet, bot.myShots)],
    lastShot: { by: shooter, cell },
    moves: g.moves + 1,
    turn: shot.result === 'miss' ? 1 - shooter : shooter,
    ...(shot.won ? { status: 'finished', winner: shooter, reason: 'win', enemyFleet: b.fleet } : {})
  };
  return { next, result: shot.result };
}

// Что вышло у последнего выстрела: по виду поля после него
const resultAt = (board: string, cell: number): ShotResult => (board[cell] === 'm' ? 'miss' : board[cell] === 's' ? 'sunk' : 'hit');

export const SeaGame: React.FC<{
  launch?: { id?: string; code?: string };
  onExit: () => void;
  onPhaseChange?: (phase: 'menu' | 'search' | 'game') => void;
}> = ({ launch, onExit, onPhaseChange }) => {
  const openUser = useOpenUser();
  const [phase, setPhase] = useState<Phase>(launch?.id || launch?.code ? 'game' : 'menu');
  const [game, setGame] = useState<SeaGameState | null>(null);
  const gameRef = useRef<SeaGameState | null>(null);
  gameRef.current = game;
  const [draft, setDraft] = useState(() => randomFleet()); // расстановка, пока не нажал «Готов»
  const draftFor = useRef('');
  const [pick, setPickState] = useState<Pick>(() => {
    const v = store.get('yesminsk_sea_pick', 'random');
    return v === 'bot' || v === 'friend' ? v : 'random';
  });
  const [level, setLevelState] = useState<SeaBotLevel>(() => (store.get('yesminsk_sea_level', 'easy') === 'normal' ? 'normal' : 'easy'));
  const [incognito, setIncognitoState] = useState(() => store.get('yesminsk_game_incognito', '0') === '1');
  const [lobby, setLobby] = useState<SeaLobby | null>(null);
  const [notify, setNotify] = useState<boolean | null>(null); // «🔔 Звать, когда кто-то ищет» — общее для всех игр
  // Ищем живого соперника, пока идёт партия с ботом; нашёлся — предлагаем перейти
  const [bgSearch, setBgSearch] = useState<SeaView | null>(null);
  const [found, setFound] = useState<SeaView | null>(null);
  const [foundLeft, setFoundLeft] = useState<number | null>(null);
  const foundRef = useRef<SeaView | null>(null);
  foundRef.current = found;
  const incognitoRef = useRef(false);
  incognitoRef.current = incognito;
  const [mine, setMine] = useState<SeaView[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchStarted, setSearchStarted] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [placeDeadline, setPlaceDeadline] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | 'plain'; key: string } | null>(null);
  const [bubble, setBubble] = useState<{ from: number; text: string; key: string } | null>(null);
  const [reply, setReply] = useState<{ text: string; key: string } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const rulesSeen = useRef(store.get('yesminsk_sea_rules_seen', '0') === '1');
  const [celebrate, setCelebrate] = useState<{ kind: 'win' | 'lose'; key: string } | null>(null);
  const celebrated = useRef('');
  const [rematchAsked410, setRematchGone] = useState(false);
  const [blockedDone, setBlockedDone] = useState(false);
  const mySayAt = useRef(0);
  const lastSayAt = useRef('');
  const movePending = useRef(false);

  const rematchGone = rematchAsked410 || Boolean(game && game.mode !== 'bot' && game.status === 'finished' && (game.reason === 'left' || game.reason === 'resign'));

  const setPick = (v: Pick) => {
    telegramService.haptic('selection');
    setPickState(v);
    store.set('yesminsk_sea_pick', v);
  };
  const setLevel = (v: SeaBotLevel) => {
    telegramService.haptic('selection');
    setLevelState(v);
    store.set('yesminsk_sea_level', v);
  };
  const setIncognito = (v: boolean) => {
    telegramService.haptic('selection');
    setIncognitoState(v);
    store.set('yesminsk_game_incognito', v ? '1' : '0');
  };
  const toggleNotify = async () => {
    const on = !notify;
    telegramService.haptic('selection');
    if (on && !(await askBotAccess(true))) {
      telegramService.alert(GT.notifyNeedBot);
      return;
    }
    setNotify(on);
    try {
      await api.gameNotify(on);
      if (on) {
        telegramService.haptic('success');
        telegramService.alert(GT.notifyOn);
      }
    } catch (e) {
      setNotify(!on);
      fail(e);
    }
  };
  const fail = (err: any) => telegramService.alert(err?.message || T.errorGeneric);
  const openRules = () => {
    telegramService.haptic('light');
    setRulesOpen(true);
  };
  const closeRules = () => {
    setRulesOpen(false);
    rulesSeen.current = true;
    store.set('yesminsk_sea_rules_seen', '1');
  };
  const showToast = (text: string, tone: 'good' | 'bad' | 'plain') => setToast({ text, tone, key: String(Date.now()) });

  // Ответ сервера: та же партия (новый выстрел, соперник готов), новая (реванш) или эмодзи от соперника
  const receive = useCallback((next: SeaView) => {
    const prev = gameRef.current;
    if (prev && prev.id === next.id && prev.mode !== 'bot') {
      const pv = prev.v ?? 0, nv = next.v ?? 0;
      if (nv < pv || (movePending.current && nv === pv)) return;
    }
    if (next.say && next.say.at !== lastSayAt.current) {
      lastSayAt.current = next.say.at;
      if (next.say.from !== next.me) {
        setBubble({ from: next.say.from, text: next.say.text, key: next.say.at });
        if (Date.now() - mySayAt.current > 8000) setReply({ text: next.say.text, key: next.say.at });
        telegramService.haptic('light');
      }
    }
    if (prev && prev.id === next.id) {
      // Соперник выстрелил по мне
      const ls = next.lastShot;
      if (ls && ls.by !== next.me && next.moves > prev.moves) {
        const r = resultAt(next.myBoard, ls.cell);
        telegramService.haptic(r === 'miss' ? 'light' : r === 'sunk' ? 'heavy' : 'medium');
        showToast(T.theyShot[r], r === 'miss' ? 'plain' : 'bad');
      }
      if (prev.phase === 'placing' && next.phase === 'battle') telegramService.haptic('success');
      if (prev.status !== 'finished' && next.status === 'finished') telegramService.haptic(next.winner === next.me ? 'success' : 'warning');
    }
    if (prev?.status === 'searching' && next.status === 'active') telegramService.haptic('success');
    if (prev?.id !== next.id) {
      setRematchGone(false);
      setBlockedDone(false);
    }
    if (next.placeLeft != null) setPlaceDeadline(Date.now() + next.placeLeft);
    setGame(next);
    if (next.status === 'searching') setPhase('search');
    else if (next.status !== 'cancelled') setPhase('game');
  }, []);

  // Открыли по ссылке: приглашение знакомого или «Заходи» от бота
  const launched = useRef(false);
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    if (launch?.id) api.seaGet(launch.id).then(receive).catch((e) => { fail(e); setPhase('menu'); });
    else if (launch?.code) api.seaJoin(launch.code, incognito).then(receive).catch((e) => { fail(e); setPhase('menu'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Меню: счётчик и мои партии со знакомыми
  useEffect(() => {
    if (phase !== 'menu') return;
    api.seaMine().then(setMine).catch(() => {});
    api.gameLobby().then((l) => setNotify(l.notify)).catch(() => {});
    const load = () => {
      if (!document.hidden) api.seaLobby().then(setLobby).catch(() => {});
    };
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [phase]);

  // Новая расстановка — новая случайная раскладка
  useEffect(() => {
    if (!game || game.phase !== 'placing' || draftFor.current === game.id) return;
    draftFor.current = game.id;
    setDraft(game.myFleet || randomFleet());
  }, [game]);

  // Долгий опрос сервера, пока партия может поменяться
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
    const finishedSince = Date.now();
    (async () => {
      while (!stop) {
        if (document.hidden) {
          await sleep(1000);
          continue;
        }
        const g = gameRef.current;
        if (stop || !g || g.id !== id) break;
        if (g.status === 'finished' && Date.now() - finishedSince > 70 * 1000) break;
        const started = Date.now();
        try {
          const next = await api.seaGet(id, { since: g.v ?? 0, wait: true, signal: ctrl.signal });
          if (stop) break;
          receive(next);
          if (Date.now() - started < 1000 && (next.v ?? 0) === (g.v ?? 0)) await sleep(1500);
        } catch {
          if (stop) break;
          await sleep(3000);
        }
      }
    })();
    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [pollKey, receive]);

  // Свернул — сервер подождёт 15 секунд; закрыл — партия завершается, поиск отменяется
  const liveId = game && game.mode !== 'bot' && (game.status === 'active' || game.status === 'searching') ? game.id : null;
  const bgId = found?.id || bgSearch?.id || null;
  useEffect(() => {
    if (!liveId && !bgId) return;
    const onHide = () => {
      if (!document.hidden) return;
      if (liveId && gameRef.current?.id === liveId && gameRef.current.status === 'active') api.seaAway(liveId).catch(() => {});
      if (bgId && foundRef.current?.id === bgId) api.seaAway(bgId).catch(() => {});
    };
    const onClose = () => {
      const g = gameRef.current;
      if (liveId && g?.id === liveId && (g.status === 'active' || g.status === 'searching')) api.seaLeave(liveId, true).catch(() => {});
      if (bgId) api.seaLeave(bgId, true).catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onClose);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onClose);
    };
  }, [liveId, bgId]);

  // Фоновый поиск: долгий опрос своей заявки. Свёрнуто — не спрашиваем; заявка устареет, и, вернувшись, ищем заново
  useEffect(() => {
    if (!bgId) return;
    const ctrl = new AbortController();
    let stop = false;
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    (async () => {
      let v = (foundRef.current?.id === bgId ? foundRef.current?.v : undefined) ?? 0;
      while (!stop) {
        if (document.hidden) {
          await sleep(1000);
          continue;
        }
        try {
          const next = await api.seaGet(bgId, { since: v, wait: true, signal: ctrl.signal });
          if (stop) break;
          v = next.v ?? v;
          if (next.status === 'active') {
            if (!foundRef.current) telegramService.haptic('success');
            setFound(next);
            setBgSearch(null);
          } else if (next.status !== 'searching') {
            // Заявка устарела или соперник ушёл, пока решали, — ищем заново
            const again = await api.seaSearch(incognitoRef.current).catch(() => null);
            if (stop) break;
            setFound(again?.status === 'active' ? again : null);
            setBgSearch(again?.status === 'searching' ? again : null);
            break;
          }
        } catch {
          if (stop) break;
          await sleep(3000);
        }
      }
    })();
    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [bgId]);

  // Соперник нашёлся: бой с ботом ещё не начат или уже кончился — переходим сразу, иначе через 10 секунд
  const switchToFound = useCallback(() => {
    const f = foundRef.current;
    if (!f) return;
    setFound(null);
    setBgSearch(null);
    setFoundLeft(null);
    telegramService.haptic('medium');
    receive(f);
  }, [receive]);
  useEffect(() => {
    if (!found) return;
    const g = gameRef.current;
    if (!g || g.mode !== 'bot' || g.status !== 'active' || g.phase !== 'battle' || g.moves === 0) {
      switchToFound();
      return;
    }
    setFoundLeft(10);
    const t = window.setInterval(() => setFoundLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.id]);
  useEffect(() => {
    if (foundLeft !== null && foundLeft <= 0) switchToFound();
  }, [foundLeft, switchToFound]);

  // Хватит искать: отменяем заявку (или найденную партию — соперник увидит «вышел из игры»)
  const stopBg = () => {
    const id = foundRef.current?.id || bgSearch?.id;
    if (id) api.seaLeave(id).catch(() => {});
    setFound(null);
    setBgSearch(null);
    setFoundLeft(null);
  };

  // Оба нажали «Ещё партию» — переходим в новую
  useEffect(() => {
    if (game?.nextId && game.mode !== 'bot') api.seaGet(game.nextId).then(receive).catch(() => {});
  }, [game?.nextId, game?.mode, receive]);

  // Часы: поиск и расстановка
  const ticking = phase === 'search' || Boolean(bgSearch) || (game?.status === 'active' && game.phase === 'placing' && game.mode !== 'bot');
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ticking]);

  // Выстрел бота
  useEffect(() => {
    if (!game || game.mode !== 'bot' || game.status !== 'active' || game.phase !== 'battle' || game.turn === game.me || rulesOpen) return;
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      if (!g || g.mode !== 'bot' || g.status !== 'active' || g.turn === g.me || !g.bot) return;
      const cell = botShot(shotView(g.myFleet, g.bot.botShots), g.bot.level);
      const { next, result } = botGameShot(g, 1 - g.me, cell);
      telegramService.haptic(result === 'miss' ? 'light' : result === 'sunk' ? 'heavy' : 'medium');
      showToast(T.theyShot[result], result === 'miss' ? 'plain' : 'bad');
      setGame(next);
    }, 700 + Math.random() * 600);
    return () => window.clearTimeout(t);
  }, [game, rulesOpen]);

  // Партия с ботом закончилась — в статистику
  const reportedBot = useRef('');
  useEffect(() => {
    if (game?.mode === 'bot' && game.status === 'finished' && game.reason === 'win' && reportedBot.current !== game.id) {
      reportedBot.current = game.id;
      api.seaBotPlayed();
    }
  }, [game]);

  // Правила — сами перед первой партией
  useEffect(() => {
    if (phase === 'game' && game && !rulesSeen.current) setRulesOpen(true);
  }, [phase, game]);

  // Салют или падающие эмодзи — один раз на партию
  useEffect(() => {
    if (!game || game.status !== 'finished' || celebrated.current === game.id) return;
    celebrated.current = game.id;
    if (game.reason === 'resign' || game.reason === 'left') return;
    setCelebrate({ kind: game.winner === game.me ? 'win' : 'lose', key: game.id });
    if (game.winner === game.me) window.setTimeout(() => telegramService.haptic('heavy'), 250);
  }, [game]);
  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(null), 4800);
    return () => window.clearTimeout(t);
  }, [celebrate]);
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 3500);
    return () => window.clearTimeout(t);
  }, [bubble]);
  useEffect(() => {
    if (!reply) return;
    const t = window.setTimeout(() => setReply(null), 6000);
    return () => window.clearTimeout(t);
  }, [reply]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---------- Действия ----------

  const startBot = (prev: SeaGameState | null = null) => {
    telegramService.haptic('medium');
    setRematchGone(false);
    setBlockedDone(false);
    const fleet = randomFleet();
    draftFor.current = '';
    setGame(newBotGame(prev?.mode === 'bot' ? prev : null, level, fleet));
    setPhase('game');
  };

  const startSearch = async () => {
    telegramService.haptic('medium');
    setBusy(true);
    setSearchStarted(Date.now());
    setNow(Date.now());
    try {
      const g = await api.seaSearch(incognito);
      if (g.status !== 'searching') {
        receive(g);
        return;
      }
      setFound(null);
      setBgSearch(g);
      const cur = gameRef.current;
      if (!(cur?.mode === 'bot' && cur.status === 'active')) startBot(cur?.mode === 'bot' ? cur : null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const startInvite = async () => {
    telegramService.haptic('medium');
    setBusy(true);
    try {
      const g = await api.seaInvite(incognito);
      receive(g);
      if (g.inviteCode) telegramService.shareSeaInvite(g.inviteCode);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const playPicked = () => {
    if (busy) return;
    if (pick === 'bot') return startBot();
    if (pick === 'friend') return startInvite();
    return startSearch();
  };

  const cancelCurrent = () => {
    const g = gameRef.current;
    if (g && g.mode !== 'bot' && (g.status === 'searching' || g.status === 'waiting')) api.seaLeave(g.id).catch(() => {});
    setGame(null);
    setPhase('menu');
  };

  const searchToBot = () => {
    cancelCurrent();
    startBot();
  };

  // Расстановка
  const shuffle = () => {
    telegramService.haptic('light');
    setDraft(randomFleet());
  };
  const tapOwn = (cell: number) => {
    const next = rotateShip(draft, cell);
    if (next) {
      telegramService.haptic('selection');
      setDraft(next);
    } else if (draft[cell] !== '.') {
      telegramService.haptic('error');
      showToast(T.cantRotate, 'plain');
    }
  };
  const submitFleet = async () => {
    const g = gameRef.current;
    if (!g || g.status !== 'active' || g.phase !== 'placing' || busy) return;
    telegramService.haptic('medium');
    if (g.mode === 'bot') {
      setGame({ ...g, myFleet: draft, phase: 'battle', turn: 0, players: g.players.map((p, i) => (i === g.me ? { ...p, ready: true } : p)) });
      return;
    }
    setBusy(true);
    try {
      receive(await api.seaFleet(g.id, draft));
    } catch (e: any) {
      if (e?.data?.game) receive(e.data.game);
      else fail(e);
    } finally {
      setBusy(false);
    }
  };

  // Выстрел
  const shoot = async (cell: number) => {
    const g = gameRef.current;
    if (!g || g.status !== 'active' || g.phase !== 'battle' || g.turn !== g.me || g.enemyBoard[cell] !== '.' || movePending.current) return;
    if (g.mode === 'bot') {
      const { next, result } = botGameShot(g, g.me, cell);
      telegramService.haptic(result === 'miss' ? 'light' : result === 'sunk' ? 'heavy' : 'medium');
      if (next.status !== 'finished') showToast(T.shot[result], result === 'miss' ? 'plain' : 'good');
      setGame(next);
      return;
    }
    telegramService.haptic('light');
    movePending.current = true;
    try {
      const done = await api.seaShot(g.id, cell);
      movePending.current = false;
      const r = resultAt(done.enemyBoard, cell);
      telegramService.haptic(r === 'miss' ? 'light' : r === 'sunk' ? 'heavy' : 'medium');
      if (done.status !== 'finished') showToast(T.shot[r], r === 'miss' ? 'plain' : 'good');
      receive(done);
    } catch (e: any) {
      movePending.current = false;
      if (e?.data?.game) receive(e.data.game);
      else telegramService.haptic('error');
    }
  };

  const say = (key: string, text: string) => {
    const g = gameRef.current;
    if (!g) return;
    telegramService.haptic('light');
    mySayAt.current = Date.now();
    setReply(null);
    setBubble({ from: g.me, text, key: String(Date.now()) });
    if (g.mode === 'bot') {
      const id = g.id;
      const answers = ['🗿', '🤌', '💅', 'Это база', '🔥'];
      window.setTimeout(() => {
        if (gameRef.current?.id === id) setBubble({ from: 1 - g.me, text: answers[Math.floor(Math.random() * answers.length)], key: `bot-${Date.now()}` });
      }, 1500 + Math.random() * 700);
      return;
    }
    api.seaSay(g.id, key).then((next) => { if (next.say) lastSayAt.current = next.say.at; }).catch(() => {});
  };

  const resign = async () => {
    const g = gameRef.current;
    if (!g || g.status !== 'active') return;
    if (!(await telegramService.confirm(T.resignConfirm, { okText: T.resignYes, destructive: true }))) return;
    if (g.mode === 'bot') {
      setGame({ ...g, status: 'finished', winner: 1 - g.me, reason: 'resign', enemyFleet: g.bot?.fleet });
      return;
    }
    api.seaLeave(g.id).then(receive).catch(fail);
  };

  const again = async () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.mode === 'bot') return startBot(g);
    if (rematchGone) return g.mode === 'invite' ? startInvite() : startSearch();
    telegramService.haptic('medium');
    try {
      receive(await api.seaRematch(g.id));
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
      await api.seaBlock(g.id);
      telegramService.haptic('success');
      setBlockedDone(true);
      setRematchGone(true);
      api.seaGet(g.id).then(receive).catch(() => {});
    } catch (e) {
      fail(e);
    }
  };

  const back = async () => {
    const g = gameRef.current;
    if (phase === 'menu') return onExit();
    if (phase === 'search') return cancelCurrent();
    stopBg();
    if (g && g.mode !== 'bot' && g.status === 'active') {
      if (!(await telegramService.confirm(T.leaveLive, { okText: T.leaveYes, destructive: true }))) return;
      api.seaLeave(g.id).catch(() => {});
    }
    setGame(null);
    setPhase('menu');
  };
  useBackButton(back);

  // Главная кнопка: «Играть» в меню, «Готов к бою» в расстановке, «Ещё партию» после боя
  const finished = game?.status === 'finished';
  const placing = phase === 'game' && game?.status === 'active' && game.phase === 'placing' && !game.players[game.me]?.ready;
  const iAskedRematch = Boolean(game && game.mode !== 'bot' && game.players[game.me]?.rematch && !game.nextId);
  const againText = rematchGone ? (game?.mode === 'invite' ? T.inviteAgain : T.findNew) : iAskedRematch ? T.againWaiting : T.again;
  const isNativeMain = useMainButton({
    text: phase === 'menu' ? T.play : placing ? T.ready : againText,
    onClick: phase === 'menu' ? playPicked : placing ? submitFleet : again,
    enabled: phase === 'menu' || placing ? !busy : !iAskedRematch && !(blockedDone && game?.mode === 'invite'),
    loading: phase === 'menu' || placing ? busy : iAskedRematch,
    active: phase === 'menu' || Boolean(placing) || (phase === 'game' && finished && !(blockedDone && game?.mode === 'invite'))
  });

  // ---------- Вид ----------

  const opp = game ? game.players[1 - game.me] : undefined;
  const placeSec = Math.max(0, Math.ceil((placeDeadline - Math.max(now, Date.now())) / 1000));

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden select-none">
      <header className={`shrink-0 px-5 ${phase === 'game' ? 'pt-2 pb-1' : 'pt-4 pb-2'}`}>
        <div className="flex items-center gap-1">
          <button onClick={back} aria-label="Назад" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer">
            <ArrowLeft size={24} />
          </button>
          <h1 className={`flex-1 min-w-0 font-serif font-bold text-zine-ink ${phase === 'game' ? 'text-title' : 'text-display'}`}>{T.title}</h1>
          <button onClick={openRules} aria-label={T.howToPlay} className="w-11 h-11 rounded-full flex items-center justify-center text-zine-terracotta cursor-pointer active:opacity-70">
            <HelpCircle size={24} />
          </button>
        </div>
      </header>

      {phase === 'menu' && (
        <main className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          <button onClick={openRules} className="w-full p-2.5 rounded-zine bg-zine-cardElevated border border-zine-border flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform">
            <SeaArt className="w-14 shrink-0" />
            <span className="flex-1 min-w-0 text-body text-zine-ink">{T.intro}</span>
          </button>

          {lobby && (
          <section className={`px-3.5 py-3 rounded-zine border ${lobby.searching || lobby.playing ? 'bg-zine-sage/15 border-zine-sage/40' : 'bg-zine-cardElevated border-zine-border'}`}>
            <p className="flex items-center gap-2 text-body font-bold text-zine-ink">
              {(lobby.searching > 0 || lobby.playing > 0) && <span className="relative w-2.5 h-2.5 shrink-0 rounded-full bg-zine-sage game-live-dot" aria-hidden />}
              <span className="min-w-0">
                {lobby.searching > 0 ? T.liveSearching(lobby.searching) : lobby.playing > 0 ? T.livePlaying(lobby.playing) : lobby.totalGames > 0 ? T.liveTotal(lobby.totalGames) : T.liveFirst}
              </span>
            </p>
          </section>
          )}

          {notify !== null && (
            <button onClick={toggleNotify} role="switch" aria-checked={notify} className="w-full px-3.5 py-2.5 rounded-zine bg-zine-cardElevated border border-zine-border flex items-center gap-3 text-left cursor-pointer">
              <span className="flex-1 min-w-0">
                <span className="block text-sm2 font-semibold text-zine-ink">{GT.notifyMe}</span>
                <span className="block text-cap text-zine-inkMuted">{GT.notifyHint}</span>
              </span>
              <Toggle on={notify} />
            </button>
          )}

          <section>
            <h2 className="px-1 mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">{T.whoPlays}</h2>
            <div className="space-y-2" role="radiogroup" aria-label={T.whoPlays}>
              <PickRow icon={<Shuffle size={22} />} title={T.pickRandom} hint={T.pickRandomHint} selected={pick === 'random'} onClick={() => setPick('random')} />
              <PickRow icon={<Bot size={22} />} title={T.pickBot} hint={T.pickBotHint} selected={pick === 'bot'} onClick={() => setPick('bot')}>
                {pick === 'bot' && (
                  <div className="px-3 pb-3 -mt-1 flex gap-2">
                    {(['easy', 'normal'] as SeaBotLevel[]).map((l) => (
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
                )}
              </PickRow>
              <PickRow icon={<UserPlus size={22} />} title={T.pickFriend} hint={T.pickFriendHint} selected={pick === 'friend'} onClick={() => setPick('friend')} />
            </div>
          </section>

          {pick !== 'bot' && (
            <button onClick={() => setIncognito(!incognito)} className="w-full px-3 py-2.5 rounded-zine bg-zine-cardElevated border border-zine-border flex items-center gap-3 text-left cursor-pointer" role="switch" aria-checked={incognito}>
              <span className="w-8 shrink-0 text-[20px] leading-7 text-center">🕶</span>
              <span className="flex-1 min-w-0">
                <span className="block text-body font-bold text-zine-ink">{GT.incognito}</span>
                <span className="block text-cap text-zine-inkMuted">{incognito ? GT.incognitoShortOn : GT.incognitoShortOff}</span>
              </span>
              <Toggle on={incognito} />
            </button>
          )}

          {!isNativeMain && (
            <button onClick={playPicked} disabled={busy} className="w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-transform">
              {T.play}
            </button>
          )}

          {mine.length > 0 && (
            <section>
              <h2 className="px-1 mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">{T.myGames}</h2>
              <div className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden">
                {mine.map((g, i) => {
                  const o = g.players[1 - g.me];
                  const myMove = g.status === 'active' && g.phase === 'battle' && g.turn === g.me;
                  const status = g.status === 'waiting' ? T.waitingFriend : g.phase === 'placing' ? T.placingNow : myMove ? T.yourTurn : T.theirTurn;
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
                        <Avatar player={o} size={40} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-body font-semibold text-zine-ink truncate">{o ? o.name : '…'}</span>
                          <span className={`block text-cap ${myMove ? 'text-zine-terracotta font-bold' : 'text-zine-inkMuted'}`}>{status}</span>
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
            <span className="absolute inset-0 rounded-full bg-zine-sky/20 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-zine-sky/15 flex items-center justify-center text-[52px]">🚢</span>
          </div>
          <h2 className="font-serif font-bold text-title text-zine-ink">{T.searching}</h2>
          <p className="mt-2 text-sm2 text-zine-inkMuted">{T.searchingHint}</p>
          <p className="mt-3 text-body font-semibold tabular-nums text-zine-ink">{formatElapsed(now - searchStarted)}</p>
          {incognito && <p className="mt-2 text-cap text-zine-inkMuted">{GT.incognitoBadge}</p>}
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

      {phase === 'game' && !game && <main className="flex-1 flex items-center justify-center text-zine-inkMuted text-body">{T.loading}</main>}

      {phase === 'game' && game && (
        // Расстановка и бой помещаются в один экран без прокрутки: поле подстраивается под высоту.
        // После боя — карточка итога ниже, тогда экран прокручивается
        <main className={`flex-1 min-h-0 px-3 pb-3 flex flex-col ${finished || game.status === 'waiting' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {game.mode === 'bot' && (bgSearch || found) && (
            <SearchBanner found={found} elapsed={now - searchStarted} left={foundLeft} onCancel={() => { telegramService.haptic('light'); stopBg(); }} onGo={switchToFound} />
          )}
          <PlayersBar game={game} bubble={bubble} onOpen={(id) => openUser(id)} />

          {game.status === 'waiting' && (
            <div className="mt-4 p-4 rounded-zine bg-zine-card text-center">
              <p className="text-body text-zine-ink">{T.waitingInvite}</p>
              <p className="mt-1 text-cap text-zine-inkMuted">{T.waitingInviteAway}</p>
              <div className="mt-3 flex gap-2 justify-center">
                <button onClick={() => game.inviteCode && telegramService.shareSeaInvite(game.inviteCode)} className="h-11 px-4 rounded-full bg-zine-ink text-zine-paper text-sm2 font-bold cursor-pointer">
                  {T.shareAgain}
                </button>
                <button onClick={cancelCurrent} className="h-11 px-4 rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer">
                  {T.cancelInvite}
                </button>
              </div>
            </div>
          )}

          {/* Расстановка */}
          {game.status === 'active' && game.phase === 'placing' && (
            <>
              <div className="mt-2 mb-1.5 flex items-baseline justify-between gap-2 px-1">
                <h2 className="font-serif font-bold text-lead text-zine-ink">{placing ? T.placeTitle : T.mySea}</h2>
                {game.mode !== 'bot' && <span className={`text-sm2 font-semibold tabular-nums ${placeSec <= 15 ? 'text-zine-terracotta' : 'text-zine-inkMuted'}`}>{T.placeLeft(placeSec)}</span>}
              </div>
              <FitBoard>
                <SeaBoard fleet={placing ? draft : game.myFleet} shots={emptyShots()} showShips onTap={placing ? tapOwn : undefined} labels />
              </FitBoard>
              <p className="mt-1.5 px-1 h-5 text-cap text-zine-inkMuted text-center truncate">
                {placing ? T.placeHint : game.mode !== 'bot' && opp ? (opp.ready ? T.oppReady : T.oppPlacing) : ''}
              </p>
              {placing ? (
                <div className="mt-1.5 flex gap-2">
                  <button onClick={shuffle} className="flex-1 h-11 rounded-full border border-zine-border bg-zine-cardElevated text-zine-ink text-sm2 font-semibold cursor-pointer active:scale-[0.98] transition-transform">
                    {T.shuffle}
                  </button>
                  {!isNativeMain && (
                    <button onClick={submitFleet} disabled={busy} className="flex-1 h-11 rounded-full bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-transform">
                      {T.ready}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 px-3 py-2.5 rounded-zine bg-zine-card text-sm2 text-zine-ink text-center">{T.waitingOpp}</p>
              )}
              <SayRow reply={reply} onSay={say} onPhrases={() => setPhrasesOpen(true)} />
              <button onClick={resign} className="mt-1 h-9 self-center px-4 rounded-full text-zine-inkMuted text-sm2 font-semibold cursor-pointer">
                🚪 {T.resign}
              </button>
            </>
          )}

          {/* Бой и итог */}
          {(game.status === 'finished' || (game.status === 'active' && game.phase === 'battle')) && (
            <>
              <div className="mt-2 mb-1 h-7 flex items-center justify-between gap-2 px-1">
                <span className="shrink-0 text-cap font-bold text-zine-ink">
                  {T.enemySea} <span className="font-semibold text-zine-inkMuted tabular-nums">· 🚢 {game.shipsLeft[1]}</span>
                </span>
                <span className="min-w-0 text-sm2 font-semibold truncate">
                  {toast ? (
                    <span key={toast.key} className={`fade-swap inline-block px-2.5 py-0.5 rounded-full ${toast.tone === 'good' ? 'bg-zine-sage/20 text-zine-ink' : toast.tone === 'bad' ? 'bg-zine-terracotta/15 text-zine-terracotta' : 'bg-zine-card text-zine-inkMuted'}`}>
                      {toast.text}
                    </span>
                  ) : game.status === 'active' ? (
                    <span className={game.turn === game.me ? 'text-zine-terracotta' : 'text-zine-inkMuted'}>
                      {game.turn === game.me ? T.yourShot : game.mode === 'bot' ? T.botThinking : T.theirShot}
                    </span>
                  ) : (
                    game.enemyFleet && <span className="text-zine-inkMuted text-cap">{T.enemyRevealedShort}</span>
                  )}
                </span>
              </div>

              <FitBoard fixed={finished}>
                <SeaBoard
                  fleet={game.status === 'finished' ? game.enemyFleet || '' : ''}
                  shots={game.enemyBoard}
                  showShips={game.status === 'finished'}
                  last={game.lastShot && game.lastShot.by === game.me ? game.lastShot.cell : -1}
                  onTap={game.status === 'active' && game.turn === game.me ? shoot : undefined}
                  dim={game.status === 'active' && game.turn !== game.me}
                  labels
                />
              </FitBoard>

              {/* Свой флот — рядом с подписью и кнопкой «Завершить игру» */}
              <div className="mt-2 flex gap-3 items-stretch">
                <div className="w-[36%] max-w-[150px] shrink-0">
                  <SeaBoard fleet={game.myFleet} shots={game.myBoard} showShips last={game.lastShot && game.lastShot.by !== game.me ? game.lastShot.cell : -1} mini />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                  <div>
                    <p className="text-sm2 font-bold text-zine-ink">{T.mySea}</p>
                    <p className="text-cap text-zine-inkMuted tabular-nums">🚢 {T.shipsLeft(game.shipsLeft[0])}</p>
                    {game.status === 'active' && game.mode !== 'bot' && opp && !opp.online && (
                      <p className="mt-1 px-2 py-1.5 rounded-zine-sm bg-zine-mustard/15 text-cap text-zine-ink">{opp.away ? T.oppAwayNote : T.oppNotHereNote}</p>
                    )}
                  </div>
                  {game.status === 'active' && (
                    <button onClick={resign} className="h-10 px-3 self-start rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer active:scale-[0.98] transition-transform">
                      🚪 {T.resign}
                    </button>
                  )}
                </div>
              </div>

              {game.status === 'active' && <SayRow reply={reply} onSay={say} onPhrases={() => setPhrasesOpen(true)} />}
            </>
          )}

          {finished && (
            <ResultCard
              game={game}
              rematchGone={rematchGone}
              blockedDone={blockedDone}
              showMainFallback={!isNativeMain && !(blockedDone && game.mode === 'invite')}
              mainText={againText}
              mainDisabled={iAskedRematch}
              onAgain={again}
              onOther={startSearch}
              onMenu={() => {
                stopBg();
                setGame(null);
                setPhase('menu');
              }}
              onOpenProfile={(id) => openUser(id)}
              onBlock={block}
            />
          )}
        </main>
      )}

      {phrasesOpen && (
        <PhrasesSheet
          label={game?.mode === 'bot' ? GT.sayLabelBot : GT.sayLabel(opp?.name)}
          onClose={() => setPhrasesOpen(false)}
          onSay={(k, t) => {
            setPhrasesOpen(false);
            say(k, t);
          }}
        />
      )}
      {rulesOpen && <RulesSheet onClose={closeRules} />}
      {celebrate && <Celebration key={celebrate.key} kind={celebrate.kind} />}
    </div>
  );
};

// ---------- Части экрана ----------

// Партия с ботом, а фоном ищем человека: плашка сверху; нашёлся — «Играть с ним»
const SearchBanner: React.FC<{ found: SeaView | null; elapsed: number; left: number | null; onCancel: () => void; onGo: () => void }> = ({ found, elapsed, left, onCancel, onGo }) => {
  if (!found) {
    return (
      <div className="mb-2 h-11 px-3 rounded-zine-sm bg-zine-card flex items-center gap-2 text-sm2">
        <span className="relative w-2.5 h-2.5 shrink-0 rounded-full bg-zine-sage game-live-dot" aria-hidden />
        <span className="flex-1 min-w-0 truncate text-zine-ink font-semibold">{GT.bgSearching}</span>
        <span className="tabular-nums text-zine-inkMuted">{formatElapsed(elapsed)}</span>
        <button onClick={onCancel} className="h-9 px-2 -mr-1 text-zine-inkMuted font-semibold cursor-pointer">
          {GT.bgCancel}
        </button>
      </div>
    );
  }
  const opp = found.players[1 - found.me];
  return (
    <div className="mb-2 p-3 rounded-zine bg-zine-sage/15 border border-zine-sage/50 fade-swap">
      <div className="flex items-center gap-2.5">
        <Avatar player={opp} size={36} />
        <span className="flex-1 min-w-0">
          <span className="block text-body font-bold text-zine-ink">🎉 {GT.bgFound}</span>
          <span className="block text-cap text-zine-inkMuted truncate">
            {opp?.name}
            {left !== null && left > 0 ? ` · ${GT.bgFoundAuto(left)}` : ''}
          </span>
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="h-10 rounded-full border border-zine-border text-zine-ink text-sm2 font-semibold cursor-pointer">
          {GT.bgFoundStay}
        </button>
        <button onClick={onGo} className="h-10 rounded-full bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer active:scale-[0.98] transition-transform">
          {GT.bgFoundGo}
        </button>
      </div>
    </div>
  );
};

/**
 * Поле, которое помещается в оставшееся место: квадрат по меньшей из сторон (ширина или высота).
 * fixed — после боя: экран прокручивается, поле просто во всю ширину
 */
const FitBoard: React.FC<{ fixed?: boolean; children: React.ReactNode }> = ({ fixed, children }) =>
  fixed ? (
    <div className="w-full max-w-[420px] self-center shrink-0">{children}</div>
  ) : (
    <div className="flex-1 min-h-[160px] flex justify-center" style={{ containerType: 'size' } as React.CSSProperties}>
      <div style={{ width: 'min(100cqw, 100cqh)' }}>{children}</div>
    </div>
  );

// Эмодзи — одной строкой во всю ширину, последняя кнопка открывает готовые фразы
const SayRow: React.FC<{ reply: { text: string; key: string } | null; onSay: (key: string, text: string) => void; onPhrases: () => void }> = ({ reply, onSay, onPhrases }) => (
  <div className="relative mt-2 shrink-0">
    {reply && (
      <span key={reply.key} className="say-hint-in absolute -top-7 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-zine-ink text-zine-paper text-cap font-semibold whitespace-nowrap shadow-zine-float" aria-live="polite">
        {GT.sayReply(reply.text)}
      </span>
    )}
    <div className="grid grid-cols-8 gap-1.5">
      {GT.emojis.map(([key, e], i) => (
        <button
          key={`${key}-${reply?.key || ''}`}
          onClick={() => onSay(key, e)}
          aria-label={`Отправить ${e}`}
          style={{ '--d': `${i * 0.06}s` } as React.CSSProperties}
          className={`aspect-square max-h-11 rounded-full text-[20px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${reply ? 'bg-zine-terracotta/15 say-pulse' : 'bg-zine-card'}`}
        >
          {e}
        </button>
      ))}
      <button onClick={onPhrases} aria-label={T.phrases} className="aspect-square max-h-11 rounded-full bg-zine-ink text-zine-paper text-[18px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform">
        💬
      </button>
    </div>
  </div>
);

const PhrasesSheet: React.FC<{ label: string; onClose: () => void; onSay: (key: string, text: string) => void }> = ({ label, onClose, onSay }) => (
  <BottomSheet title={T.phrases} onClose={onClose}>
    <p className="-mt-1 mb-3 text-cap text-zine-inkMuted">{label}</p>
    <div className="pb-4 flex flex-wrap gap-2">
      {GT.phrases.map(([k, text]) => (
        <button key={k} onClick={() => onSay(k, text)} className="h-11 px-4 rounded-full bg-zine-card text-body font-semibold text-zine-ink cursor-pointer active:scale-95 transition-transform">
          {text}
        </button>
      ))}
    </div>
  </BottomSheet>
);

/**
 * Поле 10×10. fleet — где стоят корабли (показываем, если showShips), shots — выстрелы по этому полю.
 * Корабль рисуем цельным «корпусом»: скругляем только его концы
 */
const SeaBoard: React.FC<{
  fleet: string;
  shots: string;
  showShips?: boolean;
  last?: number;
  onTap?: (cell: number) => void;
  dim?: boolean;
  mini?: boolean;
  labels?: boolean;
}> = ({ fleet, shots, showShips, last = -1, onTap, dim, mini, labels }) => {
  // Номер корабля в клетке: по расстановке или, для потопленных у соперника, по выстрелам
  const shipAt = (i: number): string | null => {
    if (showShips && fleet && fleet[i] && fleet[i] !== '.') return fleet[i];
    if (shots[i] === 's') return 's';
    return null;
  };
  const same = (i: number, r: number, c: number) => r >= 0 && r < SEA && c >= 0 && c < SEA && shipAt(r * SEA + c) === shipAt(i);
  const grid = (
    <div
      className={`w-full aspect-square grid gap-px p-px rounded-zine-sm bg-zine-sky/25 overflow-hidden transition-opacity ${dim ? 'opacity-70' : ''}`}
      style={{ gridTemplateColumns: `repeat(${SEA}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SEA}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SEA * SEA }, (_, i) => {
        const r = Math.floor(i / SEA), c = i % SEA;
        const ship = shipAt(i);
        const shot = shots[i];
        const tappable = Boolean(onTap) && (showShips ? ship !== null : shot === '.');
        const round = ship
          ? [
              !same(i, r - 1, c) && !same(i, r, c - 1) ? 'rounded-tl-md' : '',
              !same(i, r - 1, c) && !same(i, r, c + 1) ? 'rounded-tr-md' : '',
              !same(i, r + 1, c) && !same(i, r, c - 1) ? 'rounded-bl-md' : '',
              !same(i, r + 1, c) && !same(i, r, c + 1) ? 'rounded-br-md' : ''
            ].join(' ')
          : '';
        const hit = shot === 'h' || shot === 's';
        const bg = ship ? (hit ? 'bg-zine-terracotta/85' : 'bg-zine-ink/70') : hit ? 'bg-zine-terracotta/25' : 'bg-zine-cardElevated';
        return (
          <button
            key={i}
            onClick={() => onTap?.(i)}
            disabled={!tappable}
            aria-label={`${SEA_LETTERS[c]}${r + 1}`}
            className={`relative min-w-0 min-h-0 flex items-center justify-center ${bg} ${round} ${i === last ? 'sea-last' : ''} ${tappable ? 'cursor-pointer active:bg-zine-mustard/40' : ''}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {hit && (
              <svg viewBox="0 0 24 24" className={`w-[62%] h-[62%] ${ship ? 'text-white' : 'text-zine-terracotta'}`} aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none" />
              </svg>
            )}
            {shot === 'm' && <span className={`${mini ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full bg-zine-sky`} />}
            {shot === 'a' && <span className={`${mini ? 'w-0.5 h-0.5' : 'w-1 h-1'} rounded-full bg-zine-sky/50`} />}
          </button>
        );
      })}
    </div>
  );
  if (!labels) return grid;
  // Подписи А–К и 1–10, как на бумаге
  return (
    <div className="w-full shrink-0 grid gap-1" style={{ gridTemplateColumns: '14px 1fr' }}>
      <span />
      <div className="grid text-[11px] leading-3 text-zine-inkMuted text-center" style={{ gridTemplateColumns: `repeat(${SEA}, minmax(0, 1fr))` }}>
        {SEA_LETTERS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="grid text-[11px] text-zine-inkMuted text-right" style={{ gridTemplateRows: `repeat(${SEA}, minmax(0, 1fr))` }}>
        {SEA_LETTERS.map((_, k) => (
          <span key={k} className="flex items-center justify-end">{k + 1}</span>
        ))}
      </div>
      {grid}
    </div>
  );
};

// Картинка в меню: кусочек моря с кораблём и выстрелами
export const SeaArt: React.FC<{ className?: string }> = ({ className = 'w-40' }) => {
  const fleet = '.......' + '.000...' + '.......' + '....1..' + '....1..' + '.2.....' + '.......';
  const shots = '..m....' + '.hh....' + '....m..' + 'm......' + '..a....' + '.s.....' + '...m...';
  return (
    <div className={`${className} grid grid-cols-7 gap-px p-px rounded-zine-sm overflow-hidden bg-zine-sky/25`} aria-hidden>
      {Array.from({ length: 49 }, (_, i) => {
        const ship = fleet[i] !== '.' || shots[i] === 's';
        const hit = shots[i] === 'h' || shots[i] === 's';
        return (
          <span key={i} className={`aspect-square flex items-center justify-center ${ship ? (hit ? 'bg-zine-terracotta/85' : 'bg-zine-ink/70') : 'bg-zine-cardElevated'}`}>
            {hit && (
              <svg viewBox="0 0 24 24" className="w-[64%] h-[64%] text-white">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" />
              </svg>
            )}
            {shots[i] === 'm' && <span className="w-1 h-1 rounded-full bg-zine-sky" />}
          </span>
        );
      })}
    </div>
  );
};

const PlayersBar: React.FC<{ game: SeaView; bubble: { from: number; text: string; key: string } | null; onOpen: (telegramId: number) => void }> = ({ game, bubble, onOpen }) => {
  const order = [game.me, 1 - game.me];
  return (
    <div className="grid grid-cols-2 gap-2">
      {order.map((idx) => {
        const p = game.players[idx];
        const isMe = idx === game.me;
        const active = game.status === 'active' && game.phase === 'battle' && game.turn === idx;
        const canOpen = !isMe && p && !p.incognito && !p.isBot && p.telegramId;
        return (
          <div key={idx} className="relative">
            <button
              onClick={() => canOpen && onOpen(p.telegramId!)}
              disabled={!canOpen}
              className={`w-full h-12 px-2.5 rounded-zine-sm flex items-center gap-2 text-left border transition-colors ${
                active ? 'bg-zine-cardElevated border-zine-terracotta/60 shadow-zine-sm' : 'bg-zine-card border-transparent'
              } ${canOpen ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            >
              <Avatar player={p || { incognito: false, name: '', avatar: '', emoji: '👋', rematch: false, online: false }} size={32} />
              <span className="min-w-0">
                <span className="block text-sm2 font-bold text-zine-ink truncate">{isMe ? T.you : p?.name || T.friend}</span>
                <span className="block text-cap text-zine-inkMuted truncate">
                  {isMe
                    ? p?.incognito ? `🕶 ${p.emoji} ${p.name}` : p?.name
                    : !p ? T.friendWaiting
                    : game.status === 'active' && p.away ? T.oppAway
                    : game.status === 'active' && !p.isBot && !p.online ? T.oppNotHere
                    : p.isBot ? p.level : p.incognito ? '🕶 инкогнито' : canOpen ? 'анкета ›' : ''}
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
      <div className="flex gap-3 items-center">
        <SeaArt className="w-24 shrink-0" />
        <p className="text-body text-zine-ink">{T.rulesGoal}</p>
      </div>
      <ul className="space-y-2.5">
        {T.rules.map(([emoji, text]) => (
          <li key={text} className="flex gap-3 text-body text-zine-ink">
            <span className="w-6 shrink-0 text-center">{emoji}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  </BottomSheet>
);

const ResultCard: React.FC<{
  game: SeaView;
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
  const quit = game.reason === 'resign' || game.reason === 'left';
  const title = quit ? (won ? T.oppLeft : T.ended) : won ? T.win : game.mode === 'bot' ? T.loseBot : T.lose;
  const note = quit ? (won ? T.oppLeftNote : game.reason === 'left' ? T.reasonLeftMe : T.reasonResignMe) : '';
  const oppWantsAgain = game.mode !== 'bot' && opp?.rematch && !game.players[game.me]?.rematch && !rematchGone;
  const canOpen = opp && !opp.incognito && !opp.isBot && opp.telegramId && !blockedDone;
  const kind = quit ? 'quit' : won ? 'win' : 'lose';
  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'end' }), 600);
    return () => window.clearTimeout(t);
  }, [game.id]);
  const { icon, joke } = React.useMemo(() => {
    const pick = <V,>(list: V[]) => list[Math.floor(Math.random() * list.length)];
    return {
      icon: kind === 'quit' ? '🚪' : kind === 'win' ? pick(['🏆', '⚓', '👑']) : pick(['🫧', '🥀', '🫠']),
      joke: kind === 'quit' ? '' : pick(kind === 'win' ? T.winJokes : T.loseJokes)
    };
  }, [game.id, kind]);
  return (
    <div
      ref={cardRef}
      className={`mt-4 p-4 rounded-zine border shadow-zine text-center ${kind === 'win' ? 'bg-zine-mustard/15 border-zine-mustard/50 fade-swap' : kind === 'lose' ? 'bg-zine-cardElevated border-zine-border game-shake' : 'bg-zine-cardElevated border-zine-border fade-swap'}`}
    >
      <div className={`text-[64px] leading-none mb-2 inline-block ${kind === 'win' ? 'game-trophy' : kind === 'lose' ? 'game-wobble' : 'game-pop'}`} aria-hidden>
        {icon}
      </div>
      <h2 className={`font-serif font-bold text-display ${kind === 'win' ? 'text-zine-terracotta' : 'text-zine-ink'}`}>{title}</h2>
      {joke && <p className="mt-1 text-body font-semibold text-zine-ink">{joke}</p>}
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
