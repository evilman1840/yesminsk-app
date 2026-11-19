import { track } from '../analytics/runtime';
import { useAnalyticsView } from '../analytics/hooks';
import './profile.css';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, VolumeX, Play } from 'lucide-react';
import { useBackButton, useMainButton } from '../hooks/useTelegram';
import { telegramService } from '../services/telegram';
import { PROFILE_SUBTITLES } from './subtitles';

/** The file is already encoded at 1.5×; playbackRate must stay at 1. */
export function ProfileInviteBanner({ onSeen, onClose, onContinue }: { onSeen: () => void; onClose: () => void; onContinue: () => void }) {
  useAnalyticsView('gulyai_profile_invite_shown', undefined);
  const video = useRef<HTMLVideoElement>(null);
  const logged = useRef(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const close = () => { track('gulyai_profile_invite_later'); video.current?.pause(); telegramService.haptic('light'); onClose(); };
  const next = () => { track('gulyai_profile_invite_continue'); video.current?.pause(); telegramService.haptic('medium'); onContinue(); };
  useBackButton(close);
  const nativeSecondary = telegramService.hasSecondaryButton();
  useEffect(() => telegramService.bindSecondaryButton('Позже', close), []);
  const native = useMainButton({ text: 'Дополнить анкету', onClick: next, analyticsElement: 'invite_continue' });
  useEffect(() => {
    if (!logged.current) { logged.current = true; onSeen(); }
    const v = video.current;
    if (v) { v.muted = true; v.playbackRate = 1; v.preservesPitch = true; if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => setPaused(true)); }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { v?.pause(); document.removeEventListener('keydown', escape); };
  }, []);
  const play = () => { const v = video.current; if (!v || failed) return; telegramService.haptic('light'); if (v.paused) { if (v.ended) v.currentTime = 0; v.play().catch(() => setPaused(true)); } else v.pause(); };
  const sound = () => { const v = video.current; if (!v || failed) return; telegramService.haptic('light'); v.muted = !v.muted; setMuted(v.muted); if (!v.muted) { v.currentTime = 0; v.play().catch(() => setPaused(true)); } };
  const subtitle = PROFILE_SUBTITLES.find(c => time >= c.start && time < c.end)?.text || (time > 0 ? PROFILE_SUBTITLES[PROFILE_SUBTITLES.length - 1].text : PROFILE_SUBTITLES[0].text);
  return createPortal(<div className="fixed inset-0 z-[70] bg-zine-paper text-zine-ink flex flex-col overflow-hidden overscroll-none" role="dialog" aria-modal="true" aria-label="Дополни анкету">
    <div className="mx-auto w-full max-w-md h-full min-h-0 px-5 flex flex-col" style={{ paddingTop: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + var(--tg-content-safe-area-inset-top, 0px) + 8px)', paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))' }}>
      <div className="flex justify-end shrink-0"><button type="button" onClick={close} autoFocus aria-label="Закрыть" className="w-11 h-11 rounded-full bg-zine-card text-zine-inkMuted flex items-center justify-center"><X size={22} /></button></div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col text-center py-2"><div className="my-auto">
        <p className="profile-invite-hand font-hand text-[26px] text-zine-terracotta -rotate-2 mb-3">давай найдём твою компанию</p>
        <div className="profile-invite-circle relative w-[156px] h-[156px] mx-auto shrink-0">
          <button type="button" onClick={play} disabled={failed} aria-label={paused ? 'Продолжить видео' : 'Пауза'} className="absolute inset-0 rounded-full border-4 border-zine-border p-1">
            {failed ? <img src="/misha-questionnaire-v1.jpg" alt="Миша с Лёвой" className="w-full h-full rounded-full object-cover" /> : <video ref={video} src="/misha-questionnaire-v1.mp4" poster="/misha-questionnaire-v1.jpg" muted playsInline preload="auto" onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onError={() => setFailed(true)} onTimeUpdate={e => { const v = e.currentTarget; setTime(v.currentTime); setProgress(v.duration > 0 ? v.currentTime / v.duration : 0); }} className="w-full h-full rounded-full object-cover" />}
            {paused && !failed && <span className="absolute inset-2 rounded-full bg-black/20 flex items-center justify-center text-white"><Play size={32} fill="currentColor" /></span>}
          </button>
          <svg viewBox="0 0 156 156" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" aria-hidden><circle cx="78" cy="78" r="75" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray="471.24" strokeDashoffset={471.24 * (1-progress)} className="stroke-zine-terracotta" /></svg>
          <button type="button" onClick={sound} disabled={failed} aria-label={muted ? 'Включить звук' : 'Выключить звук'} className="absolute bottom-0 right-0 w-11 h-11 rounded-full bg-zine-ink text-zine-paper flex items-center justify-center">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
        </div>
        <p className="profile-invite-caption min-h-[64px] mt-2 flex items-center justify-center text-sm2 text-zine-inkMuted whitespace-pre-line">{failed ? 'Видео не открылось. Всё главное есть ниже.' : subtitle}</p>
        <h2 className="profile-invite-title font-serif text-display font-bold mt-2 text-balance">Чтобы было проще найти свою компанию</h2>
        <p className="text-body mt-3 text-balance">Расскажи, куда тебя позвать, когда удобно встречаться и чем хочется поделиться.</p>
        <p className="profile-invite-secondary text-sm2 text-zine-inkMuted mt-2 text-balance">Так другим будет проще познакомиться с тобой и предложить что-то интересное.</p>
        <p className="font-hand text-[24px] mt-3">🤗 Миша Спасатель</p>
      </div>
      </div><div className="pt-3 shrink-0">{!native && <button data-analytics="invite_continue" type="button" onClick={next} className="w-full min-h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold">Дополнить анкету</button>}{!nativeSecondary && <button data-analytics="invite_later" type="button" onClick={close} className="mt-2 w-full min-h-12 rounded-zine-sm bg-zine-card text-body font-semibold">Позже</button>}<p className="mt-2 text-center text-cap text-zine-inkMuted">Прежние ответы уже на месте.<br />Новые вопросы можно пропускать.</p></div>
    </div>
  </div>, document.body);
}
