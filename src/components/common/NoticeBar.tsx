import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { NOTICE_TEXTS as T } from '../../texts/notices';
import { AnalyticsNotice } from '../../analytics/contract';
import { track, whenAnalyticsEnabled } from '../../analytics/runtime';
import { dismissNotice, pickNotice, readNoticeState } from '../../utils/notices';

export interface Notice {
  id: string; // UI/storage only, never sent to analytics
  kind: AnalyticsNotice;
  text: string;
  headline?: string;
  detail?: string;
  action?: string;
  onClick?: (fromBottom?: boolean) => void;
  hideDays: number;
  onDismiss?: () => void;
  group?: string;
}

/** Count an actually visible, uncovered card, only after analytics consent. */
function useNoticeExposure(notice: Notice | undefined, placement: 'bottom' | 'help') {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef<string>();
  useEffect(() => {
    if (!notice) return;
    const check = () => {
      const el = ref.current;
      if (!el || document.visibilityState !== 'visible' || seen.current === notice.id) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top < 0 || r.bottom > window.innerHeight) return;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || !el.contains(top)) return;
      if (track('gulyai_notice_seen', { notice_kind: notice.kind, notice_placement: placement })) seen.current = notice.id;
    };
    const off = whenAnalyticsEnabled(check);
    const observer = new IntersectionObserver(check, { threshold: 1 });
    if (ref.current) observer.observe(ref.current);
    // Also catches uncovering after a sheet closes without moving the card.
    const timer = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => { off(); observer.disconnect(); window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [notice?.id, notice?.kind, placement]);
  return ref;
}

/** One contextual suggestion. Closing frees the whole slot until tomorrow. */
export const NoticeBar: React.FC<{ notices: Notice[] }> = ({ notices }) => {
  const [state, setState] = useState(readNoticeState);
  const notice = pickNotice(notices, state);
  const ref = useNoticeExposure(notice, 'bottom');
  useEffect(() => {
    if (state.snoozedUntil <= Date.now()) return;
    const timer = window.setTimeout(() => setState(readNoticeState()), state.snoozedUntil - Date.now() + 50);
    return () => window.clearTimeout(timer);
  }, [state.snoozedUntil]);
  if (!notice) return null;
  const hide = () => setState(dismissNotice(notice.id, notice.hideDays));
  return (
    <div ref={ref} className="shrink-0 px-3 pt-1.5 pb-1 bg-zine-paper" aria-label="Подсказка">
      <div className="flex items-center rounded-zine-sm bg-zine-card border border-zine-border">
        <button type="button" aria-label={`${notice.text}${notice.action ? ` ${notice.action}` : ''}`} onClick={() => {
          if (!notice.onClick) return;
          track('gulyai_notice_clicked', { notice_kind: notice.kind, notice_placement: 'bottom' });
          telegramService.haptic('selection'); hide(); notice.onClick(true);
        }} disabled={!notice.onClick}
          className="flex-1 min-w-0 min-h-11 pl-3.5 py-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-sm2 font-semibold text-zine-ink disabled:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
          {notice.headline ? <span className="flex-1 min-w-0">
            <span className="block truncate">{notice.headline}</span>
            <span className="block truncate text-cap font-normal text-zine-inkMuted">{notice.detail}</span>
          </span> : <span className="flex-1 min-w-[150px] line-clamp-2">{notice.text}</span>}
          {notice.action && <span aria-hidden="true" className="shrink-0 text-zine-terracotta whitespace-nowrap">{notice.headline ? '→' : notice.action}</span>}
        </button>
        <button type="button" onClick={() => {
          track('gulyai_notice_dismissed', { notice_kind: notice.kind, notice_placement: 'bottom' });
          telegramService.haptic('light'); hide(); notice.onDismiss?.();
        }} aria-label={T.closeUntilTomorrow} className="w-11 h-11 shrink-0 flex items-center justify-center text-zine-inkMuted rounded-zine-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

const HelpNotice: React.FC<{ notice: Notice; onClose: () => void }> = ({ notice, onClose }) => {
  const ref = useNoticeExposure(notice, 'help');
  return <div ref={ref} className="rounded-zine-sm border border-zine-border bg-zine-card">
    {notice.onClick ? <button type="button" className="w-full min-h-11 p-3 text-left text-body text-zine-ink rounded-zine-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta" onClick={() => {
      track('gulyai_notice_clicked', { notice_kind: notice.kind, notice_placement: 'help' });
      telegramService.haptic('selection'); onClose(); notice.onClick?.();
    }}>
      {notice.text}{notice.action && <span className="block mt-1 font-semibold text-zine-terracotta">{notice.action}</span>}
    </button> : <p className="p-3 text-body text-zine-ink">{notice.text}</p>}
  </div>;
};

export const NoticeHelpList: React.FC<{ notices: Notice[]; onClose: () => void }> = ({ notices, onClose }) => (
  <div className="space-y-3">
    <p className="text-sm2 text-zine-inkMuted">{T.helpIntro}</p>
    {notices.map(notice => <HelpNotice key={notice.id} notice={notice} onClose={onClose} />)}
  </div>
);
