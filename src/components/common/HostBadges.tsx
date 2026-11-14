import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppEvent, HostInfo, MonthHost } from '../../types';
import { thumb, NO_PHOTO } from '../../utils/thumb';
import { telegramService } from '../../services/telegram';
import { MEETUP_TEXTS as M } from '../../texts/meetups';
import { BottomSheet } from '../ui/BottomSheet';
import { DonateSheet } from './DonateSheet';
import { api } from '../../services/api';
import { useOpenUser } from '../../context/openUser';

// Шторки рисуются порталом, но нажатия в React всплывают к карточке, из которой их открыли: гасим, чтобы карточка не открывалась и не свайпалась
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Значки организатора рядом с именем: «🌱 Организатор» (дальше её сменяет «🔥 Активный организатор») и «🍩 Кормит ГУЛЯЙ-Печку».
 * Нажатие на любой — шторка с объяснением, что они значат и как такой получить
 */
export const HostBadges: React.FC<{ host?: Partial<HostInfo> | null; className?: string; hostsLink?: boolean }> = ({ host, className = '', hostsLink = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  // «Организаторы месяца» — строка в шторке значков (кроме самого списка организаторов); пусто — строки нет
  const [isHostsOpen, setIsHostsOpen] = useState(false);
  const [hasHosts, setHasHosts] = useState(false);
  useEffect(() => {
    if (isOpen && hostsLink) loadMonthHosts().then((h) => setHasHosts(h.length > 0));
  }, [isOpen, hostsLink]);
  const starter = Boolean(host?.held) && !host?.active;
  if (!host || (!starter && !host.active && !host.supporter)) return null;
  const label = [starter ? M.badgeStarter : '', host.active ? M.badgeActive : '', host.supporter ? M.badgeSupporter : ''].filter(Boolean).join(', ');
  return (
    <>
      <button
        type="button"
        aria-label={`${label}. Что значат значки`}
        onClick={(e) => {
          e.stopPropagation();
          telegramService.haptic('selection');
          setIsOpen(true);
        }}
        className={`shrink-0 h-7 px-2 rounded-full bg-zine-card border border-zine-border text-sm2 leading-none flex items-center gap-1 cursor-pointer active:scale-95 transition-transform ${className}`}
      >
        {starter && <span aria-hidden>🌱</span>}
        {host.active && <span aria-hidden>🔥</span>}
        {host.supporter && <span aria-hidden>🍩</span>}
      </button>
      {(isOpen || isDonateOpen || isHostsOpen) && (
        <span onClick={stop} onPointerDown={stop} onPointerMove={stop} onPointerUp={stop}>
          {isOpen && (
            <BottomSheet title={M.badgesTitle} onClose={() => setIsOpen(false)}>
              <div className="space-y-3">
                <div className={`p-4 rounded-zine-sm bg-zine-card ${starter || host.active ? '' : 'opacity-70'}`}>
                  <p className="text-body font-bold text-zine-ink">{M.badgeStarter}</p>
                  <p className="mt-1 text-sm2 text-zine-ink">{M.badgeStarterText}</p>
                </div>
                <div className={`p-4 rounded-zine-sm bg-zine-card ${host.active ? '' : 'opacity-70'}`}>
                  <p className="text-body font-bold text-zine-ink">{M.badgeActive}</p>
                  <p className="mt-1 text-sm2 text-zine-ink">{M.badgeActiveText}</p>
                </div>
                <div className={`p-4 rounded-zine-sm bg-zine-card ${host.supporter ? '' : 'opacity-70'}`}>
                  <p className="text-body font-bold text-zine-ink">{M.badgeSupporter}</p>
                  <p className="mt-1 text-sm2 text-zine-ink">{M.badgeSupporterText}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  telegramService.haptic('selection');
                  setIsOpen(false);
                  setIsDonateOpen(true);
                }}
                className="mt-4 w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform"
              >
                🍩 {M.badgeDonate}
              </button>
              {hasHosts && (
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setIsOpen(false);
                    setIsHostsOpen(true);
                  }}
                  className="mt-2 w-full h-12 rounded-full bg-zine-card text-zine-ink text-body font-semibold cursor-pointer active:scale-[0.98] transition-transform"
                >
                  🏆 {M.hostsTitle}
                </button>
              )}
            </BottomSheet>
          )}
          {isHostsOpen && <HostsSheet onClose={() => setIsHostsOpen(false)} />}
          {isDonateOpen && <DonateSheet onClose={() => setIsDonateOpen(false)} />}
        </span>
      )}
    </>
  );
};

/**
 * «Прошедшие» — карточка в конце «⭐ Мои»: свои сходки за три месяца, каждую можно собрать ещё раз
 */
export const PastReel: React.FC<{ events: AppEvent[]; emojiOf: (ev: AppEvent) => string; dateOf: (iso: string) => string; onRepeat: (ev: AppEvent) => void }> = ({ events, emojiOf, dateOf, onRepeat }) => (
  <section className="h-full w-full snap-start snap-always p-3">
    <div className="h-full rounded-zine bg-zine-card border border-zine-border flex flex-col px-4 pt-5 pb-2 text-zine-ink">
      <p className="shrink-0 font-serif font-bold text-title">{M.pastTitle}</p>
      <p className="shrink-0 mt-1 text-sm2 text-zine-inkMuted">{M.pastText}</p>
      <ul className="mt-3 flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-zine-border">
        {events.map((ev) => {
          const came = (ev.participants || []).filter((p) => !p.noShow).length;
          return (
            <li key={ev.id} className="py-2.5 flex items-center gap-3">
              <span className="w-11 h-11 shrink-0 rounded-full bg-zine-paper flex items-center justify-center text-[22px] leading-none" aria-hidden>
                {emojiOf(ev)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold leading-snug line-clamp-2">{ev.title}</span>
                <span className="block text-cap text-zine-inkMuted truncate">
                  {dateOf(ev.dateTime)}
                  {came > 1 ? ` · ${M.pastCame(came)}` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRepeat(ev)}
                className="shrink-0 h-9 px-3.5 rounded-full bg-zine-ink text-zine-paper text-sm2 font-bold cursor-pointer active:scale-95 transition-transform"
              >
                {M.repeat}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);

// «Организаторы месяца» нужны в нескольких местах (лента, шапка, шторка значков): грузим один раз за запуск
let hostsOnce: Promise<MonthHost[]> | null = null;
export const loadMonthHosts = () => (hostsOnce ||= api.getMonthHosts().catch(() => ((hostsOnce = null), [])));

/**
 * Список организаторов месяца: без мест и гонки — имена, значки и сколько сходок проведено.
 * Нажать на человека — анкета, «Сходка» — его ближайшая (если знаем, какие сходки мне видны)
 */
const HostsList: React.FC<{
  hosts: MonthHost[];
  nextEventOf?: (telegramId: number) => AppEvent | undefined;
  onOpenUser: (telegramId: number) => void;
  onOpenEvent?: (ev: AppEvent) => void;
  className?: string;
}> = ({ hosts, nextEventOf, onOpenUser, onOpenEvent, className = '' }) => (
  <ul className={`divide-y divide-zine-border ${className}`}>
    {hosts.map((h) => {
      const next = onOpenEvent && nextEventOf?.(h.telegramId);
      return (
        <li key={h.telegramId} className="py-2 flex items-center gap-2">
          <button type="button" onClick={() => onOpenUser(h.telegramId)} className="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer">
            <img src={thumb(h.avatarUrl) || NO_PHOTO} alt="" loading="lazy" className="w-11 h-11 shrink-0 rounded-full object-cover bg-zine-paper" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold truncate">{h.name}</span>
              <span className="block text-cap text-zine-inkMuted truncate">{M.hostedShort(h.held)}</span>
            </span>
          </button>
          <HostBadges host={h} hostsLink={false} className="bg-zine-paper" />
          {next && (
            <button
              type="button"
              onClick={() => {
                telegramService.haptic('selection');
                onOpenEvent!(next);
              }}
              className="shrink-0 h-9 pl-3 pr-1.5 rounded-full bg-zine-terracotta/10 text-zine-terracotta text-sm2 font-bold flex items-center cursor-pointer active:scale-95 transition-transform"
            >
              {M.hostsNext}
              <ChevronRight size={16} />
            </button>
          )}
        </li>
      );
    })}
  </ul>
);

const REEL_HOSTS = 6;

/**
 * «Организаторы месяца» — карточка в ленте сходок: кто чаще всех собирал сходки за последние 30 дней
 */
export const HostsReel: React.FC<{
  hosts: MonthHost[];
  nextEventOf: (telegramId: number) => AppEvent | undefined;
  onOpenUser: (telegramId: number) => void;
  onOpenEvent: (ev: AppEvent) => void;
  onCreate: () => void;
  onOpenAll: () => void; // в карточке первые шестеро, остальные — в шторке 🏆
}> = ({ hosts, nextEventOf, onOpenUser, onOpenEvent, onCreate, onOpenAll }) => (
  <section className="h-full w-full snap-start snap-always p-3">
    <div className="h-full rounded-zine bg-zine-card border border-zine-border flex flex-col px-4 pt-5 pb-4 text-zine-ink">
      <p className="shrink-0 font-serif font-bold text-title">{M.hostsTitle}</p>
      <p className="shrink-0 mt-1 text-sm2 text-zine-inkMuted">{M.hostsText}</p>
      <HostsList hosts={hosts.slice(0, REEL_HOSTS)} nextEventOf={nextEventOf} onOpenUser={onOpenUser} onOpenEvent={onOpenEvent} className="mt-3 flex-1 min-h-0 overflow-y-auto no-scrollbar" />
      {hosts.length > REEL_HOSTS && (
        <button type="button" onClick={onOpenAll} className="shrink-0 mt-1 h-10 text-sm2 font-bold text-zine-terracotta cursor-pointer">
          {M.hostsAll(hosts.length)}
        </button>
      )}
      <button type="button" onClick={onCreate} className="shrink-0 mt-2 h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
        {M.hostsCreate}
      </button>
    </div>
  </section>
);

/**
 * «Организаторы месяца» шторкой: из 🏆 в шапке «Сходок» и из шторки значков.
 * Список не передали — загрузит сам. Нажали на человека или сходку — шторка закрывается, чтобы не перекрывать анкету
 */
export const HostsSheet: React.FC<{
  hosts?: MonthHost[];
  nextEventOf?: (telegramId: number) => AppEvent | undefined;
  onOpenEvent?: (ev: AppEvent) => void;
  onClose: () => void;
}> = ({ hosts, nextEventOf, onOpenEvent, onClose }) => {
  const openUser = useOpenUser();
  const [loaded, setLoaded] = useState<MonthHost[] | null>(hosts || null);
  useEffect(() => {
    if (!hosts) loadMonthHosts().then(setLoaded);
  }, [hosts]);
  return (
    <BottomSheet title={`🏆 ${M.hostsTitle}`} onClose={onClose}>
      <p className="text-sm2 text-zine-inkMuted">{M.hostsAllText}</p>
      {loaded && (
        <HostsList
          hosts={loaded}
          nextEventOf={nextEventOf}
          className="mt-2"
          onOpenUser={(id) => {
            onClose();
            openUser(id);
          }}
          onOpenEvent={
            onOpenEvent &&
            ((ev) => {
              onClose();
              onOpenEvent(ev);
            })
          }
        />
      )}
    </BottomSheet>
  );
};
