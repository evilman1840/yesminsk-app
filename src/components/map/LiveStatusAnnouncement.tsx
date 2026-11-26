import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MapPin, MessageCircle, X } from 'lucide-react';
import { Drawer } from 'vaul';
import { useBackButton } from '../../hooks/useTelegram';
import { telegramService } from '../../services/telegram';
import { NO_PHOTO } from '../../utils/thumb';

const dismissed = new Set<number>();
const storageKey = (userId: number) => `gulyai-live-status-announcement-v1:${userId}`;
const mapLines = [
  'repeating-linear-gradient(154deg, transparent 0 30px, rgb(var(--c-mustard) / 0.22) 31px 33px, transparent 34px 61px)',
  'repeating-linear-gradient(68deg, transparent 0 38px, rgb(var(--c-mustard) / 0.16) 39px 40px, transparent 41px 68px)',
  'linear-gradient(26deg, transparent 0 33%, rgb(var(--c-sage) / 0.13) 34% 40%, transparent 41%)',
].join(', ');

export function LiveStatusAnnouncement({ userId, onTry }: { userId: number; onTry: () => void }) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(() => {
    if (dismissed.has(userId)) return false;
    try { return localStorage.getItem(storageKey(userId)) !== '1'; }
    catch { return true; }
  });
  const tryStatus = useRef(false);
  const close = () => {
    dismissed.add(userId);
    try { localStorage.setItem(storageKey(userId), '1'); }
    catch { /* The in-memory flag also works without local storage. */ }
    setOpen(false);
  };
  useBackButton(open ? close : null);

  return (
    <Drawer.Root open={open} onOpenChange={value => { if (!value) close(); }}
      onAnimationEnd={value => { if (!value && tryStatus.current) { tryStatus.current = false; onTry(); } }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-zine-ink/50 motion-reduce:!animate-none" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[min(90dvh,calc(var(--tg-viewport-stable-height,100dvh)-max(20px,env(safe-area-inset-top),var(--tg-safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))))] w-full max-w-[420px] flex-col rounded-t-zine-lg border-t border-zine-blush bg-zine-cardElevated text-zine-ink shadow-zine-float outline-none motion-reduce:!animate-none">
          <div className="shrink-0 px-5 pt-3">
            <Drawer.Handle className="!h-1 !w-10 !bg-zine-border" />
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="rounded-full bg-zine-terracotta/10 px-3 py-1 text-xs font-bold">Новое в ГУЛЯЙ!</p>
              <Drawer.Close type="button" aria-label="Закрыть" className="grid size-11 shrink-0 place-items-center rounded-full bg-zine-card text-zine-inkMuted transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
                <X size={20} aria-hidden />
              </Drawer.Close>
            </div>
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">
            <Drawer.Title className="max-w-[19rem] font-serif text-[clamp(30px,8.6vw,36px)] font-bold leading-[1.08]">
              Что тебе хочется прямо сейчас?
            </Drawer.Title>

            <div role="group" aria-label="Пример статуса на карте"
              className="relative isolate flex min-h-[104px] items-center justify-center gap-3 overflow-hidden rounded-2xl border border-zine-mustard/20 bg-zine-mustard/10 p-4">
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: mapLines }} />
              <div aria-hidden className="relative -mt-1 size-12 shrink-0 rounded-full border-[3px] border-zine-terracotta bg-zine-cardElevated p-0.5 shadow-zine-sm">
                <img src={NO_PHOTO} alt="" className="h-full w-full rounded-full object-cover" />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-zine-terracotta" />
              </div>
              <motion.div initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30, delay: 0.2 }}
                className="relative min-w-0 origin-left rounded-2xl border border-zine-border bg-zine-cardElevated px-2.5 py-1.5 shadow-zine-sm">
                <span aria-hidden className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 border-b border-l border-zine-border bg-zine-cardElevated" />
                <p className="relative text-xs font-semibold leading-tight">На кофе вечером</p>
                <p className="relative text-xs leading-tight text-zine-inkMuted">Могу выслушать</p>
              </motion.div>
            </div>

            <div className="space-y-3 text-sm2 leading-snug">
              <Drawer.Description>
                Я добавил в ГУЛЯЙ! статусы «Хочу / Могу». Напиши одну строку или обе и выбери время от 1 до 48 часов.
              </Drawer.Description>
              <ul className="space-y-2.5 text-zine-inkMuted">
                <li className="flex items-start gap-2.5">
                  <MapPin size={17} aria-hidden className="mt-0.5 shrink-0 text-zine-terracotta" />
                  <span>Нажми на свою аватарку справа вверху. Статус появится у твоей метки на карте и в анкете.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MessageCircle size={17} aria-hidden className="mt-0.5 shrink-0 text-zine-terracotta" />
                  <span>Увидишь знакомое настроение на карте, жми на облачко, чтобы открыть анкету и передать привет.</span>
                </li>
              </ul>
              <p className="font-hand text-xl font-semibold leading-tight text-zine-inkMuted">🤗 Миша Спасатель</p>
            </div>
          </div>

          <div className="shrink-0 border-t border-zine-border px-5 pt-3 pb-[calc(14px+max(env(safe-area-inset-bottom,0px),var(--tg-safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))]">
            <Drawer.Close asChild>
              <button type="button" onClick={() => { telegramService.haptic('light'); tryStatus.current = true; }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-zine-terracotta px-4 font-bold text-white transition-transform active:scale-[0.97] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zine-terracotta">
                Поставить статус <ArrowRight size={18} aria-hidden />
              </button>
            </Drawer.Close>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
