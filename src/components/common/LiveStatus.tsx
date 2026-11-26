import { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Drawer } from 'vaul';
import { useBackButton } from '../../hooks/useTelegram';
import { telegramService } from '../../services/telegram';
import { durationOptions, offerPhrases, shortOffer, upperFirst, wantPhrases } from '../../texts/liveStatus';
import type { LiveStatus } from '../../types';

export function currentLiveStatus(status?: LiveStatus | null) {
  return status && Date.parse(status.expiresAt) > Date.now() ? status : null;
}

export function useLiveStatus(status?: LiveStatus | null) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!currentLiveStatus(status) || !status) return;
    const timer = window.setTimeout(() => refresh(value => value + 1), Date.parse(status.expiresAt) - Date.now() + 20);
    return () => window.clearTimeout(timer);
  }, [status?.expiresAt]);
  return currentLiveStatus(status);
}

export function useLiveStatusExpiry(users: { liveStatus?: LiveStatus | null }[], enabled = true) {
  const [revision, refresh] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const next = users.reduce((time, user) => {
      const active = currentLiveStatus(user.liveStatus);
      return active ? Math.min(time, Date.parse(active.expiresAt)) : time;
    }, Infinity);
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => refresh(value => value + 1), Math.max(0, next - Date.now()) + 20);
    return () => window.clearTimeout(timer);
  }, [users, enabled, revision]);
  return revision;
}

export function LiveStatusText({ status, compact = false, onPhoto = false }: { status?: LiveStatus | null; compact?: boolean; onPhoto?: boolean }) {
  const active = useLiveStatus(status);
  if (!active) return null;
  if (onPhoto) return <span className="relative inline-grid w-fit max-w-[min(100%,240px)] gap-1 rounded-2xl border border-zine-border bg-zine-cardElevated px-3 py-2 text-left text-cap leading-tight text-zine-ink shadow-zine">
    <span aria-hidden className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 border-b border-r border-zine-border bg-zine-cardElevated" />
    {active.want && <span className="relative min-w-0 [overflow-wrap:anywhere]"><b className="mr-1 font-semibold text-zine-inkMuted">Хочу:</b>{active.want}</span>}
    {active.offer && <span className="relative min-w-0 [overflow-wrap:anywhere]"><b className="mr-1 font-semibold text-zine-inkMuted">Могу:</b>{active.offer}</span>}
  </span>;
  return <span className={compact ? 'grid max-w-full rounded-xl bg-zine-cardElevated px-2.5 py-1.5 text-cap text-zine-ink shadow-zine-sm' : 'block rounded-zine-sm bg-zine-card p-3 text-sm2 text-zine-ink break-words'}>
    {active.want && <span className={compact ? 'truncate font-bold' : 'block'}>{compact ? upperFirst(active.want) : <><b>Хочу</b> {active.want}</>}</span>}
    {active.offer && <span className={compact ? 'truncate text-zine-inkMuted' : 'block'}>{compact ? shortOffer(active.offer) : <><b>Могу</b> {active.offer}</>}</span>}
  </span>;
}

const press = 'transition-transform motion-reduce:transition-none motion-safe:active:scale-[0.97]';
const toastStyle = {
  background: 'rgb(var(--c-card-elevated))',
  color: 'rgb(var(--c-ink))',
  borderColor: 'rgb(var(--c-border))',
  pointerEvents: 'none' as const,
};

function StatusField({ label, value, onChange, phrases }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  phrases: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const ideasId = useId();
  const reducedMotion = useReducedMotion();
  return <div>
    <label className="block text-sm2 font-bold">{label}
      <input className="field mt-2" value={value} maxLength={45} onChange={event => onChange(event.target.value)} placeholder={phrases[0]} />
    </label>
    <button type="button" aria-expanded={expanded} aria-controls={expanded ? ideasId : undefined}
      aria-label={`Идеи для «${label}»`}
      onClick={() => { telegramService.haptic('light'); setExpanded(value => !value); }}
      className={`inline-flex min-h-11 items-center gap-1.5 text-sm2 font-semibold text-zine-inkMuted ${press}`}>
      Идеи <ChevronDown size={16} aria-hidden className={expanded ? 'rotate-180' : ''} />
    </button>
    <AnimatePresence initial={false}>
      {expanded && <motion.div key={ideasId} id={ideasId}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
        className="overflow-hidden">
        <div className="flex flex-wrap gap-1.5 pb-1">
          {phrases.map(phrase => <button type="button" aria-pressed={phrase === value} key={phrase}
            onClick={() => { telegramService.haptic('light'); onChange(phrase); }}
            className={`min-h-11 rounded-full bg-zine-card px-3 text-cap font-semibold aria-pressed:bg-zine-sage/20 aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-zine-sage ${press}`}>
            {phrase}
          </button>)}
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

const hourMs = 3600000;
export function LiveStatusEditor({ status, visible = true, onClose, onSave, onOpenActivity, activityUnread = 0 }: {
  status?: LiveStatus | null;
  visible?: boolean;
  onClose: () => void;
  onSave: (want: string, offer: string, hours: number) => Promise<void>;
  onOpenActivity?: () => void;
  activityUnread?: number;
}) {
  const active = useLiveStatus(status);
  const [want, setWant] = useState(active?.want || '');
  const [offer, setOffer] = useState(active?.offer || '');
  const [hours, setHours] = useState(String(active ? Math.min(48, Math.max(1, Math.ceil((Date.parse(active.expiresAt) - Date.now()) / hourMs))) : 3));
  const [customHours, setCustomHours] = useState(!durationOptions.includes(Number(hours)));
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [failure, setFailure] = useState<{ message: string; clearing: boolean } | null>(null);
  const duration = Number(hours);
  const validDuration = Number.isInteger(duration) && duration >= 1 && duration <= 48;

  useBackButton(open ? () => closeButton.current?.click() : null);

  const save = async (duration: number) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailure(null);
    try {
      await onSave(want, offer, duration);
      if (duration) toast.success('Статус обновлён', { style: toastStyle });
      else toast.success('Статус снят', { style: toastStyle });
      telegramService.haptic('success');
      closeButton.current?.click();
    } catch (err) {
      setFailure({ message: err instanceof Error ? err.message : 'Не удалось сохранить статус', clearing: duration === 0 });
      telegramService.haptic('error');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const chooseHours = (value: number) => {
    telegramService.haptic('light');
    setHours(String(value));
    setCustomHours(false);
  };

  const headerButton = `relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-zine-inkMuted hover:bg-zine-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta ${press}`;

  return <Drawer.Root open={open} onOpenChange={setOpen} autoFocus={false} onAnimationEnd={open => { if (!open) onClose(); }}>
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-[60] bg-zine-ink/50 motion-reduce:!animate-none" />
      <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[calc(min(100dvh,var(--tg-viewport-height,100dvh))-max(16px,env(safe-area-inset-top),var(--tg-safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px)))] w-full max-w-[420px] flex-col rounded-t-zine-lg bg-zine-cardElevated text-zine-ink shadow-zine-float outline-none motion-reduce:!animate-none">
        <div className="shrink-0 px-4 pb-2 pt-3">
          <Drawer.Handle className="!h-1 !w-10 !bg-zine-border" />
          <div className="mt-2 flex items-center gap-1">
            <Drawer.Title className="flex-1 font-serif text-title font-bold">Я сейчас</Drawer.Title>
            {onOpenActivity && <button type="button" aria-label={activityUnread ? `Уведомления и новости, новых: ${activityUnread}` : 'Уведомления и новости'}
              className={headerButton} onClick={() => { telegramService.haptic('light'); onOpenActivity(); }}>
              <Bell size={20} aria-hidden />
              {activityUnread > 0 && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-zine-terracotta ring-2 ring-zine-cardElevated" />}
            </button>}
            <Drawer.Close ref={closeButton} type="button" aria-label="Закрыть" className={`${headerButton} bg-zine-card`}>
              <X size={21} aria-hidden />
            </Drawer.Close>
          </div>
          <Drawer.Description className="mt-1 text-cap text-zine-inkMuted">{visible
            ? 'Статус видно на карте и в анкете. Заполни одну строку или обе.'
            : 'Сейчас тебя не видно. Статус появится вместе с анкетой, если ты выйдешь из режима невидимки.'}
          </Drawer.Description>
        </div>

        <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); if (validDuration && (want.trim() || offer.trim())) void save(duration); }}>
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
            <StatusField label="Хочу" value={want} onChange={setWant} phrases={wantPhrases} />
            <StatusField label="Могу" value={offer} onChange={setOffer} phrases={offerPhrases} />

            <fieldset>
              <legend className="mb-2 text-sm2 font-bold">На сколько часов</legend>
              <div className="grid grid-cols-6 gap-1">
                {durationOptions.map(value => <button type="button" aria-pressed={duration === value} key={value}
                  onClick={() => chooseHours(value)}
                  className={`min-h-11 rounded-full bg-zine-card px-0.5 text-cap font-bold tabular-nums aria-pressed:bg-zine-ink aria-pressed:text-zine-paper ${press}`}>
                  {value} ч
                </button>)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <button type="button" aria-expanded={customHours} onClick={() => { telegramService.haptic('light'); if (validDuration || !customHours) setCustomHours(!customHours); }}
                  className={`min-h-11 text-sm2 font-semibold text-zine-inkMuted ${press}`}>Своё время{!customHours && validDuration && !durationOptions.includes(duration) ? ` · ${duration} ч` : ''}</button>
                {customHours && <label className="flex items-center gap-2 text-cap text-zine-inkMuted">
                  <input aria-label="Своё время в часах" className="field min-h-11 !w-[72px] !px-2 text-center tabular-nums" type="number"
                    min={1} max={48} required inputMode="numeric" value={hours} onChange={event => setHours(event.target.value)} />
                  от 1 до 48 ч
                </label>}
              </div>
            </fieldset>
            {active && <button type="button" disabled={saving} onClick={() => void save(0)}
              className={`min-h-11 text-sm2 font-semibold text-zine-inkMuted disabled:opacity-50 ${press}`}>{failure?.clearing ? 'Повторить снятие' : 'Снять статус'}</button>}
          </div>
          <div className="shrink-0 space-y-2 border-t border-zine-border bg-zine-cardElevated px-4 pt-3 pb-[calc(12px+max(env(safe-area-inset-bottom,0px),var(--tg-safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))]">
            {active && <p className="text-cap text-zine-inkMuted">Текущий статус до {new Date(active.expiresAt).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} по Минску.</p>}
            {failure && <p role="alert" className="text-cap text-zine-danger">{failure.message}</p>}
            <button type="submit" aria-busy={saving} disabled={saving || !validDuration || (!want.trim() && !offer.trim())}
              className={`min-h-12 w-full rounded-zine-sm bg-zine-terracotta px-3 font-bold text-white disabled:opacity-50 ${press}`}>
              {saving ? 'Сохраняем…' : failure && !failure.clearing ? 'Попробовать ещё раз' : 'Сохранить статус'}
            </button>
          </div>
        </form>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>;
}
