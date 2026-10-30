import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { EventTemplate, CUSTOM_TEMPLATE, PlaceItem, WishItem, WishSummaryItem, WishWindow } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { loadTemplates, cachedTemplates } from '../../utils/templatesStore';
import { BottomSheet } from '../ui/BottomSheet';
import { WISH_TEXTS as T, wishLine } from '../../texts/wishes';
import { SUGGEST_TEXTS as SG } from '../../texts/suggest';
import { SuggestPlaceSheet } from './SuggestPlaceSheet';
import { askBotAccess } from '../../services/botAccess';

const WINDOWS: WishWindow[] = ['today', 'tomorrow', 'weekend', 'week'];
// Счётчики этих желаний не показываем на карточках мест
export const DELICATE_KINDS = ['support'];

// Обязательный выбор в шаблоне (вид спорта): без «Другое», желания совпадают по конкретному виду
const subFieldOf = (tpl?: EventTemplate | null) => {
  const f = tpl?.fields.find((x) => x.type === 'select' && x.required);
  return f ? { ...f, options: (f.options || []).filter((o) => o.value !== 'other') } : null;
};

/**
 * «Хочу сходить»: что, когда, где (необязательно) → «Хочу!». Тут же свои желания и чужие счётчики
 */
export const WishSheet: React.FC<{
  places?: PlaceItem[];
  presetPlace?: PlaceItem | null;
  onClose: () => void;
  onChanged?: () => void;
  onCreated?: (sameCount: number) => void; // отметили — шторку закрывает родитель и показывает, что дальше
  onOpenPeople?: (item: WishSummaryItem) => void; // «76 человек хотят…» — кто это
}> = ({ places = [], presetPlace, onClose, onChanged, onCreated, onOpenPeople }) => {
  const [templates, setTemplates] = useState<EventTemplate[] | null>(cachedTemplates());
  const [mine, setMine] = useState<WishItem[]>([]);
  const [summary, setSummary] = useState<WishSummaryItem[]>([]);
  const [maxActive, setMaxActive] = useState(3);

  const [kind, setKind] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<WishWindow | null>(null);
  const [place, setPlace] = useState<PlaceItem | null>(presetPlace || null);
  const [isPlacePicker, setIsPlacePicker] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ sameCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null); // предложенное место (на проверке)
  const [customText, setCustomText] = useState(''); // «Своё»: чего хочется, своими словами

  const kinds = (templates || []).filter((t) => t.key !== CUSTOM_TEMPLATE && t.wishPhrase);
  const tpl = kinds.find((t) => t.key === kind) || null;
  const subField = subFieldOf(tpl);
  const isCustom = kind === CUSTOM_TEMPLATE;
  const ready = Boolean(kind && timeWindow && (!subField || sport) && (!isCustom || customText.trim().replace(/[^a-zа-яё]/gi, '').length >= 2));

  const refresh = () =>
    api
      .getWishes()
      .then((r) => {
        setMine(r.mine || []);
        setSummary(r.summary || []);
        setMaxActive(r.maxActive || 3);
      })
      .catch(() => {});

  useEffect(() => {
    if (!templates) loadTemplates().then(setTemplates);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeName = (id: string | null) => (id ? places.find((p) => p.id === id)?.name : null);

  const create = async (data: { kind: string; sport?: string | null; timeWindow: WishWindow; placeId?: string | null }) => {
    setBusy(true);
    setError(null);
    // Желание — бот должен суметь написать о совпадении
    askBotAccess();
    try {
      const res = await api.createWish(data);
      telegramService.haptic('success');
      if (onCreated) {
        onChanged?.();
        onCreated(res.sameCount);
        return;
      }
      setDone({ sameCount: res.sameCount });
      setKind(null);
      setSport(null);
      setCustomText('');
      setTimeWindow(null);
      await refresh();
      onChanged?.();
    } catch (err: any) {
      telegramService.haptic('error');
      setError(err?.message || T.failed);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (w: WishItem) => {
    telegramService.haptic('light');
    setMine((list) => list.filter((x) => x.id !== w.id));
    await api.cancelWish(w.id).catch(() => {});
    refresh();
    onChanged?.();
  };

  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? places.filter((p) => p.name.toLowerCase().includes(q)) : places).slice(0, 30);
  }, [places, query]);

  // Чужие желания: только если хочет кто-то кроме меня; в карточке места — без «поныть» (деликатная тема)
  const others = summary
    .filter((s) => !(s.includesMe && s.count === 1))
    .filter((s) => !presetPlace || (s.placeId === presetPlace.id && !DELICATE_KINDS.includes(s.kind)))
    .sort((a, b) => b.count - a.count);
  const chip = (on: boolean) =>
    `h-10 px-3.5 rounded-full border-2 text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
      on ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
    }`;
  const atLimit = mine.length >= maxActive;

  return (
    <BottomSheet
      title={T.sheetTitle}
      onClose={onClose}
      footer={
        !isPlacePicker && (
          <button
            type="button"
            disabled={!ready || busy || atLimit}
            onClick={() => kind && timeWindow && create({ kind, sport: isCustom ? customText.trim() : sport, timeWindow, placeId: place?.id || null })}
            className={`w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              ready && !atLimit ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted cursor-default'
            }`}
          >
            {busy ? <Loader2 size={22} className="animate-spin" /> : atLimit ? T.limit(maxActive) : T.submit}
          </button>
        )
      }
    >
      {isPlacePicker ? (
        <div>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.placeSearch} className="field" autoFocus />
          <div className="mt-3 space-y-1">
            {filteredPlaces.length === 0 && <p className="text-sm2 text-zine-inkMuted">{T.noPlaces}</p>}
            {filteredPlaces.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  telegramService.haptic('selection');
                  setPlace(p);
                  setIsPlacePicker(false);
                }}
                className="w-full p-3 rounded-zine-sm bg-zine-card text-left text-body font-semibold text-zine-ink cursor-pointer"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-body text-zine-inkMuted">{T.sheetHint}</p>

          {done && (
            <div className="p-3 rounded-zine-sm bg-zine-sage/15 text-body text-zine-ink">
              <p className="font-semibold">{T.created}</p>
              {done.sameCount > 0 && <p className="mt-1">{T.sameCount(done.sameCount)}</p>}
            </div>
          )}
          {error && <p className="p-3 rounded-zine-sm bg-zine-danger/10 text-sm2 font-semibold text-zine-danger">{error}</p>}

          <section>
            <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{T.whatLabel}</h4>
            {!templates ? (
              <Loader2 size={20} className="animate-spin text-zine-inkMuted" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {kinds.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setKind(t.key);
                      setSport(null);
                      setDone(null);
                    }}
                    className={chip(kind === t.key)}
                  >
                    <span>{t.emoji}</span>
                    {t.name}
                  </button>
                ))}
                {/* Своё: вписать, чего хочется */}
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setKind(CUSTOM_TEMPLATE);
                    setSport(null);
                    setDone(null);
                  }}
                  className={chip(isCustom)}
                >
                  <span>✍️</span>
                  {T.customChip}
                </button>
              </div>
            )}
          </section>

          {isCustom && (
            <section>
              <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{T.customLabel}</h4>
              <input type="text" value={customText} onChange={(e) => setCustomText(e.target.value.slice(0, 40))} placeholder={T.customPlaceholder} className="field" autoFocus />
              <p className="mt-1.5 text-cap text-zine-inkMuted">{T.customHint}</p>
            </section>
          )}

          {subField && (
            <section>
              <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{subField.label || T.sportLabel}</h4>
              <div className="flex flex-wrap gap-2">
                {subField.options.map((o) => (
                  <button type="button" key={o.value} onClick={() => setSport(o.value)} className={chip(sport === o.value)}>
                    {o.emoji && <span>{o.emoji}</span>}
                    {o.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{T.whenLabel}</h4>
            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((w) => (
                <button
                  type="button"
                  key={w}
                  onClick={() => {
                    telegramService.haptic('selection');
                    setTimeWindow(w);
                    setDone(null);
                  }}
                  className={chip(timeWindow === w)}
                >
                  {T.windows[w]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{T.whereLabel}</h4>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPlace(null)} className={chip(!place)}>
                {T.anywhere}
              </button>
              {place ? (
                <button type="button" onClick={() => setIsPlacePicker(true)} className={chip(true)}>
                  📍 <span className="max-w-[200px] truncate">{place.name}</span>
                </button>
              ) : (
                places.length > 0 && (
                  <button type="button" onClick={() => setIsPlacePicker(true)} className={chip(false)}>
                    {T.pickPlace}
                  </button>
                )
              )}
              {/* Нужного места нет в базе — можно предложить своё */}
              <button type="button" onClick={() => setIsSuggestOpen(true)} className={chip(false)}>
                {SG.wishButton}
              </button>
            </div>
            {suggested && <p className="mt-2 text-sm2 text-zine-ink">{SG.doneText(suggested)}</p>}
          </section>
          {isSuggestOpen && (
            <SuggestPlaceSheet
              category={tpl?.placeTypes?.[0]}
              context={tpl ? `«Хочу сходить»: ${tpl.wishPhrase}` : undefined}
              onClose={() => setIsSuggestOpen(false)}
              onDone={(name) => {
                setIsSuggestOpen(false);
                setSuggested(name);
              }}
            />
          )}

          {/* Чужие желания: нажать — хотеть того же */}
          {others.length > 0 && (
            <section>
              <h4 className="text-sm2 font-bold text-zine-ink">{T.othersTitle}</h4>
              <p className="mb-2 text-cap text-zine-inkMuted">{T.othersHint}</p>
              <div className="space-y-2">
                {others.slice(0, 6).map((s) => (
                  <button
                    type="button"
                    key={`${s.kind}-${s.sport}-${s.timeWindow}-${s.placeId}`}
                    disabled={!onOpenPeople && (s.includesMe || busy || atLimit)}
                    onClick={() => (onOpenPeople ? onOpenPeople(s) : create({ kind: s.kind, sport: s.sport, timeWindow: s.timeWindow, placeId: s.placeId }))}
                    className="w-full p-3 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1 text-body text-zine-ink">
                      <b>🙋 {T.barCounter(s.count, s.what, s.when)}</b>
                      {placeName(s.placeId) && <span className="text-zine-inkMuted"> · {placeName(s.placeId)}</span>}
                    </span>
                    {s.includesMe && <span className="shrink-0 text-sm2 font-bold text-zine-sage">{T.meToo}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {mine.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm2 font-bold text-zine-ink">{T.mineTitle}</h4>
              <div className="space-y-2">
                {mine.map((w) => (
                  <div key={w.id} className="p-3 rounded-zine-sm border border-zine-border flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold text-zine-ink">
                        {wishLine(w)}
                        {placeName(w.placeId) ? ` · ${placeName(w.placeId)}` : ''}
                      </span>
                      {w.status === 'matched' && (
                        <span className="text-cap font-semibold text-zine-sage flex items-center gap-1">
                          <Check size={14} strokeWidth={3} /> {T.matched(w.groupSize)}
                        </span>
                      )}
                    </span>
                    <button type="button" aria-label={T.cancel} onClick={() => cancel(w)} className="w-10 h-10 shrink-0 rounded-full bg-zine-card text-zine-inkMuted flex items-center justify-center cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
