import React, { useState } from 'react';
import { useFund } from './FundBar';
import { Loader2, Copy, Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { STAR_AMOUNTS, CARD_URL, DONATE_COPY } from '../../config/donate';
import { isOwnPhoto, NO_PHOTO } from '../../utils/thumb';
import { Pechka, Pie, TierIcon, moodFor } from '../ui/Pechka';

const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

// «из 500 рублей», «из 21 рубля»
const ofRubles = (n: number) => (Number.isInteger(n) && n % 10 === 1 && n % 100 !== 11 ? 'рубля' : 'рублей');

// «Уже кормили Печку 23 человека» — так же, как «поддержали»: естественнее при 21, 31…
const fedLine = (n: number) => {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `Уже ${n === 1 ? 'кормил' : 'кормили'} Печку ${n} ${few ? 'человека' : 'человек'}`;
};

// Подсказки суммы: банк по ссылке сумму не принимает, человек вводит её сам
// 1 рубль = 1 пирожок. По выписке за 24.10–9.11 (45 донатов): чаще всего 5 р. (треть), потом 1 р.;
// 20–30 р. — всего 4 доната, но это треть денег. 100 р. не было ни разу, поэтому верх шкалы — 30
const TIERS = [
  { kind: 'one', name: 'Пирожок', rub: 1 },
  { kind: 'two', name: 'Тарелка', rub: 5 },
  { kind: 'basket', name: 'Корзинка', rub: 10 },
  { kind: 'loaf', name: 'Каравай', rub: 30 }
] as const;
const PIES = 20; // пирожков на противне = цель месяца

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
  const [tier, setTier] = useState(1);
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
  const filled = month ? Math.min(100, (month.raised / Math.max(1, month.goal)) * 100) : null;
  const pies = filled === null ? 0 : Math.round((filled / 100) * PIES);
  const last = fund?.lastTransfer;

  return (
    <BottomSheet title="Накорми Печку 🥧" onClose={onClose}>
      {/* 1. Печка и слово от Миши — коротко, чтобы кнопка доната была видна без прокрутки */}
      <div className="flex items-center gap-3">
        <Pechka mood={moodFor(filled)} size={72} className="shrink-0" />
        <p className="text-sm2 text-zine-ink">
          Я делаю ГУЛЯЙ! один, без инвесторов и рекламы. Каждый пирожок — это сервер, новое в приложении и помощь приютам.{' '}
          <b>Миша Спасатель</b>
        </p>
      </div>

      {/* 2. Цель месяца = сытость Печки, шкала из пирожков */}
      <div className="mt-3 px-3 py-2.5 rounded-zine bg-zine-card">
        {month ? (
          <p className="flex flex-wrap justify-between gap-x-3 text-sm2 text-zine-ink">
            <span>
              {month.name}: Печка ГУЛЯЙ сыта на <b className="text-body">{Math.round(filled!)}%</b>
            </span>
            <span className="text-zine-inkMuted">
              {num(month.raised)} из {num(month.goal)} {ofRubles(month.goal)}
            </span>
          </p>
        ) : (
          <p className="text-sm2 text-zine-inkMuted">Загружаю…</p>
        )}
        <div className="mt-1.5 grid grid-cols-10 gap-1 text-zine-inkMuted/50" aria-hidden>
          {Array.from({ length: PIES }, (_, i) => (
            <Pie key={i} empty={i >= pies} />
          ))}
        </div>
        <p className="mt-1.5 text-cap text-zine-inkMuted">🐾 51% приютам и сходкам · 🛠 49% на ГУЛЯЙ!</p>
      </div>

      {/* 3. Сколько пирожков (1 рубль = 1 пирожок) — подсказка, и главная кнопка с суммой */}
      <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Сколько пирожков">
        {TIERS.map((t, i) => (
          <button
            key={t.kind}
            onClick={() => {
              telegramService.haptic('selection');
              setTier(i);
            }}
            aria-pressed={tier === i}
            className={`py-1.5 px-1 rounded-zine-sm border-2 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              tier === i ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-card'
            }`}
          >
            <span className="h-[30px] flex items-center">
              <TierIcon kind={t.kind} />
            </span>
            <span className="text-[12px] leading-tight text-zine-inkMuted text-center">{t.name}</span>
            <span className="text-sm2 font-bold text-zine-ink">{t.rub} р.</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => telegramService.openLink(CARD_URL)}
        className="mt-3 w-full min-h-14 py-2 rounded-zine-sm bg-zine-terracotta text-white cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="block text-lead font-bold">Накормить донатом · {TIERS[tier].rub} р.</span>
        <span className="block text-cap font-medium opacity-90">онлайн на карту</span>
      </button>
      <p className="mt-1.5 text-cap text-zine-inkMuted text-center">
        <b className="text-zine-ink">1 рубль = 1 пирожок.</b> Можно любую сумму: её вводишь сам в банке
      </p>

      <button
        onClick={() => setShowOther((v) => !v)}
        aria-expanded={showOther}
        className="mt-1 w-full h-11 flex items-center justify-center gap-1 text-sm2 font-semibold text-zine-inkMuted cursor-pointer"
      >
        Другие способы: ЕРИП, телефон, звёзды
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
        {fund?.people ? <p className="text-sm2 text-zine-ink">🧡 {fedLine(fund.people)}</p> : null}
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
        Готово, Печка накормлена ✓
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
                🥧 Кормлю ГУЛЯЙ-Печку
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
    <BottomSheet title="Ням! Спасибо 🧡" onClose={onClose}>
      <Pechka mood="eating" size={130} className="mx-auto" />
      <p className="mt-2 mb-3 text-body text-zine-ink text-center">Печка тёплая, ГУЛЯЙ! работает. А пирожки она вернёт сходками.</p>
      <div className="space-y-2">
        <Option checked={badge} onChange={() => setBadge((v) => !v)}>
          Добавить значок «🥧 Кормлю ГУЛЯЙ-Печку» в мою анкету
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
