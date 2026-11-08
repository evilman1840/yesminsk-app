import React, { useState } from 'react';
import { useFund } from './FundBar';
import { Loader2, Copy, Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { STAR_AMOUNTS, CARD_URL, DONATE_COPY } from '../../config/donate';
import { isOwnPhoto, NO_PHOTO } from '../../utils/thumb';

const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

// «Уже поддержал 1 человек», «Уже поддержали 22 человека», «Уже поддержали 51 человек»
// (при 21, 31, 51… тоже «поддержали»: так звучит естественнее)
const supportedLine = (n: number) => {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `Уже ${n === 1 ? 'поддержал' : 'поддержали'} ${n} ${few ? 'человека' : 'человек'}`;
};

// «из 500 рублей», «из 21 рубля»
const ofRubles = (n: number) => (Number.isInteger(n) && n % 10 === 1 && n % 100 !== 11 ? 'рубля' : 'рублей');

// 51% приютам, волонтёрам и организаторам сходок, 49% проекту
const SHELTER_SHARE = 51;

/**
 * Окно «Поддержать проект»: всё понятно за 3 секунды и без прокрутки.
 * Заголовок → цель месяца (/fund, /goal) → кнопка «Поддержать картой» → другие способы (свёрнуты)
 * → две строки доверия → «Готово, перевод сделан ✓» (экран «Спасибо», на честном слове)
 */
export const DonateSheet: React.FC<{ onClose: () => void; onOpenNews?: () => void }> = ({ onClose, onOpenNews }) => {
  const [busyStars, setBusyStars] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fund = useFund();

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // запасной способ для старых браузеров
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    telegramService.haptic('success');
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  const donateStars = async (stars: number) => {
    setError(null);
    setBusyStars(stars);
    try {
      const { url } = await api.createDonateInvoice(stars);
      const status = await telegramService.openInvoice(url);
      if (status === 'paid') {
        telegramService.haptic('success');
        setThanks(true);
      }
    } catch (err: any) {
      setError(err.message || 'Не получилось открыть оплату');
    } finally {
      setBusyStars(null);
    }
  };

  if (thanks) return <ThanksSheet onClose={onClose} />;

  const month = fund?.month;
  const filled = month ? Math.min(100, (month.raised / Math.max(1, month.goal)) * 100) : 0;
  const last = fund?.lastTransfer;

  return (
    <BottomSheet title="ГУЛЯЙ! живёт на донаты 🧡" onClose={onClose}>
      {/* 1. Кто делает и что нужно */}
      <p className="text-body text-zine-ink">Делаю один. Миша Спасатель Позднев.</p>
      <p className="text-body font-bold text-zine-ink">Нужна ТВОЯ финансовая поддержка.</p>

      {/* 2. Цель месяца: заполнено 51/49 терракотой (приютам) и зелёным (проекту) */}
      <div className="mt-4 p-4 rounded-zine bg-zine-card">
        <p className="text-body text-zine-ink">
          {month ? (
            <>
              {month.name}: <b>{num(month.raised)}</b> из {num(month.goal)} {ofRubles(month.goal)}
            </>
          ) : (
            <span className="text-zine-inkMuted">Загружаю…</span>
          )}
        </p>
        <div className="mt-2 h-3 rounded-full overflow-hidden bg-zine-border" aria-hidden>
          <div className="h-full flex" style={{ width: `${filled}%` }}>
            <span className="bg-zine-terracotta" style={{ width: `${SHELTER_SHARE}%` }} />
            <span className="bg-zine-sage" style={{ width: `${100 - SHELTER_SHARE}%` }} />
          </div>
        </div>
        <p className="mt-2 text-cap text-zine-inkMuted">🐾 51% отдаю приютам, волонтёрам и организаторам сходок</p>
        <p className="text-cap text-zine-inkMuted">🛠 49%, чтобы ГУЛЯЙ! работал и становился лучше</p>
      </div>

      {/* 3. Главная кнопка */}
      <button
        onClick={() => telegramService.openLink(CARD_URL)}
        className="mt-4 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer active:scale-[0.99] transition-transform"
      >
        💳 Поддержать картой
      </button>

      <button
        onClick={() => setShowOther((v) => !v)}
        aria-expanded={showOther}
        className="mt-1 w-full h-11 flex items-center justify-center gap-1 text-sm2 font-semibold text-zine-inkMuted cursor-pointer"
      >
        Другие способы
        <ChevronDown size={18} className={`transition-transform ${showOther ? 'rotate-180' : ''}`} />
      </button>

      {showOther && (
        <div className="space-y-2">
          {DONATE_COPY.map((item) => {
            const isCopied = copied === item.copy;
            return (
              <button
                key={item.title}
                onClick={() => copyValue(item.copy)}
                className="w-full p-3 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
              >
                <span className="text-[24px] leading-none">{item.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm2 font-bold text-zine-ink">{item.title}</span>
                  <span className="block text-sm2 text-zine-inkMuted break-all">{isCopied ? 'Скопировано ✓' : item.shown}</span>
                </span>
                {isCopied ? (
                  <Check size={20} strokeWidth={3} className="text-zine-sage shrink-0" />
                ) : (
                  <Copy size={20} className="text-zine-inkMuted shrink-0" />
                )}
              </button>
            );
          })}
          <div className="p-3 rounded-zine-sm bg-zine-card">
            <p className="text-sm2 font-bold text-zine-ink">⭐ Звёзды Telegram</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {STAR_AMOUNTS.map((stars) => (
                <button
                  key={stars}
                  onClick={() => donateStars(stars)}
                  disabled={busyStars !== null}
                  className="h-11 rounded-zine-sm bg-zine-mustard/15 border border-zine-mustard/30 text-zine-ink text-body font-bold flex items-center justify-center active:scale-[0.98] transition-transform cursor-pointer"
                >
                  {busyStars === stars ? <Loader2 size={20} className="animate-spin" /> : stars}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="p-3 rounded-zine-sm bg-zine-danger/10 text-sm2 text-zine-danger">{error}</p>}
        </div>
      )}

      {/* 4. Две строки доверия */}
      <div className="mt-3 space-y-1">
        {fund?.people ? <p className="text-sm2 text-zine-ink">🧡 {supportedLine(fund.people)}</p> : null}
        {last &&
          (onOpenNews ? (
            <button onClick={onOpenNews} className="block w-full text-left text-sm2 text-zine-ink cursor-pointer">
              🐾 Помог: {dayMonth(last.at)}, {num(last.amount)} р. → <span className="underline decoration-zine-terracotta/50 underline-offset-2">{last.to}</span>
            </button>
          ) : (
            <p className="text-sm2 text-zine-ink">
              🐾 Помог: {dayMonth(last.at)}, {num(last.amount)} р. → {last.to}
            </p>
          ))}
      </div>

      {/* 5. После перевода */}
      <button
        onClick={() => setThanks(true)}
        className="mt-3 mx-auto block px-3 h-10 text-cap font-semibold text-zine-inkMuted underline underline-offset-2 cursor-pointer"
      >
        Готово, перевод сделан ✓
      </button>
    </BottomSheet>
  );
};

// Галочка с подписью
const Option: React.FC<{ checked: boolean; onChange: () => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <button
    role="checkbox"
    aria-checked={checked}
    onClick={onChange}
    className="w-full p-3 rounded-zine-sm bg-zine-card flex items-start gap-3 text-left cursor-pointer"
  >
    <span
      className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-zine-terracotta border-zine-terracotta text-white' : 'border-zine-inkMuted/50'
      }`}
    >
      {checked && <Check size={16} strokeWidth={3} />}
    </span>
    <span className="text-body text-zine-ink">{children}</span>
  </button>
);

// Как анкету видят другие: для превью после «Готово»
interface MyCard {
  firstName: string;
  age?: number;
  avatarUrl: string;
  profileCompleted?: boolean;
}

/**
 * «Спасибо огромное! 🧡»: две галочки, обе выключены. Проверки перевода нет, всё на честном слове.
 * Суммы и счётчик людей не меняются. Вторая галочка попадает в список /thanks у автора.
 * После «Готово» со значком показываем «СПАСИБО!» и превью своей анкеты, чтобы было видно, как она теперь выглядит
 */
const ThanksSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [badge, setBadge] = useState(false);
  const [named, setNamed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ card: MyCard | null; named: boolean } | null>(null);

  const submit = async () => {
    if (!badge && !named) {
      onClose();
      return;
    }
    setBusy(true);
    await api.sendDonateThanks(badge, named).catch(() => {});
    let card: MyCard | null = null;
    if (badge) {
      const me = await api.getMe().catch(() => null);
      const tg = telegramService.getUser();
      card = {
        firstName: me?.firstName || tg?.first_name || 'Ты',
        age: me?.age,
        avatarUrl: isOwnPhoto(me?.avatarUrl) ? me.avatarUrl : isOwnPhoto(tg?.photo_url) ? tg!.photo_url! : NO_PHOTO,
        profileCompleted: me?.profileCompleted
      };
    }
    setBusy(false);
    telegramService.haptic('success');
    setDone({ card, named });
  };

  if (done) {
    return (
      <BottomSheet title="СПАСИБО! 🧡" onClose={onClose}>
        {done.card ? (
          <>
            <p className="text-body text-zine-ink">Теперь твоя анкета выглядит вот так:</p>
            <div className="relative mt-3 mx-auto w-full max-w-[260px] aspect-[4/5] rounded-zine overflow-hidden bg-zine-card shadow-zine">
              <img src={done.card.avatarUrl} alt={done.card.firstName} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute top-3 left-3 h-7 px-2.5 rounded-full bg-white/90 text-zine-ink text-cap font-bold flex items-center shadow">
                🧡 Поддерживаю проект
              </span>
              <div className="absolute inset-x-0 bottom-0 px-3 pt-10 pb-3 bg-gradient-to-t from-black/75 to-transparent text-white">
                <p className="font-serif font-bold text-title leading-tight">
                  {done.card.firstName}
                  {done.card.age ? <span className="font-sans font-medium text-white/85">, {done.card.age}</span> : null}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm2 text-zine-inkMuted text-center">
              {done.card.profileCompleted === false
                ? 'Значок увидят, когда заполнишь анкету: возраст и интересы.'
                : 'Значок видят все, кто листает «Людей».'}
            </p>
          </>
        ) : (
          <p className="text-body text-zine-ink">Твоя поддержка очень важна для меня и для приютов.</p>
        )}
        {done.named && <p className="mt-2 text-sm2 text-zine-ink text-center">Скоро скажу тебе спасибо по имени в новостях и Тредсе 🤗</p>}
        <button onClick={onClose} className="mt-4 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          Отлично!
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Спасибо огромное! 🧡" onClose={onClose}>
      <div className="space-y-2">
        <Option checked={badge} onChange={() => setBadge((v) => !v)}>
          Добавить значок «🧡 Поддерживаю проект» в мою анкету
        </Option>
        <Option checked={named} onChange={() => setNamed((v) => !v)}>
          Можно сказать мне спасибо по имени в новостях приложения и Тредсе
        </Option>
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="mt-4 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center cursor-pointer"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : 'Готово'}
      </button>
    </BottomSheet>
  );
};
