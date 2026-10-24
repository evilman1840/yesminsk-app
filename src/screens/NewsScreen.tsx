import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useBackButton } from '../hooks/useTelegram';
import { NewsItem, serverUrl } from '../services/api';
import { telegramService } from '../services/telegram';
import { BottomSheet } from '../components/ui/BottomSheet';

/**
 * «Новости проекта»: посты автора (пишет боту командой /news), в том числе отчёты о донатах
 */
export const NewsScreen: React.FC<{ news: NewsItem[]; isLoading: boolean; onOpenDonate: () => void; onBack: () => void }> = ({
  news,
  isLoading,
  onOpenDonate,
  onBack
}) => {
  const [openedPhoto, setOpenedPhoto] = useState<string | null>(null);
  useBackButton(onBack); // в Telegram — нативная «Назад», своя стрелка только в браузере

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden">
      <header className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center gap-1">
          {!telegramService.isInsideTelegram() && (
            <button onClick={onBack} aria-label="Назад к карте" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer">
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="font-serif font-bold text-display text-zine-ink">Новости проекта</h1>
        </div>
        <p className="mt-1 text-body text-zine-inkMuted">Что нового в ДА! МИНСК и куда идут донаты</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        <button
          onClick={onOpenDonate}
          className="w-full p-4 rounded-zine bg-zine-terracotta/10 border border-zine-terracotta/25 flex items-center gap-3 text-left cursor-pointer"
        >
          <span className="text-[28px] leading-none">💛</span>
          <span>
            <span className="block text-body font-bold text-zine-ink">Поддержать проект</span>
            <span className="block text-sm2 text-zine-inkMuted">51% донатов идёт на подарки пользователям. Отчёт здесь раз в 2 недели</span>
          </span>
        </button>

        {news.length === 0 ? (
          <div className="mt-2 p-8 rounded-zine bg-zine-card text-center">
            <div className="text-[44px] mb-3">📰</div>
            <h3 className="font-serif font-bold text-title text-zine-ink mb-2">{isLoading ? 'Загружаем…' : 'Новостей пока нет'}</h3>
            {!isLoading && <p className="text-body text-zine-inkMuted">Скоро здесь появятся новости проекта и отчёты о донатах.</p>}
          </div>
        ) : (
          news.map((item) => (
            <article key={item.id} className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden">
              {item.photos.length > 0 && (
                <div className={`grid gap-0.5 ${item.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {item.photos.map((photo, i) => (
                    <button key={photo} onClick={() => setOpenedPhoto(serverUrl(photo))} className="cursor-zoom-in">
                      <img
                        src={serverUrl(photo)}
                        alt={`Фото ${i + 1}`}
                        loading="lazy"
                        className={`w-full object-cover bg-zine-card ${item.photos.length > 1 ? 'aspect-square' : 'max-h-[420px]'}`}
                      />
                    </button>
                  ))}
                </div>
              )}
              <div className="p-4">
                <p className="text-cap font-semibold text-zine-inkMuted">{formatNewsDate(item.createdAt)}</p>
                {item.text && <p className="mt-2 text-body text-zine-ink whitespace-pre-line break-words">{linkify(item.text)}</p>}
              </div>
            </article>
          ))
        )}
      </main>

      {/* Фото крупно */}
      {openedPhoto && (
        <BottomSheet title="Фото" onClose={() => setOpenedPhoto(null)}>
          <img src={openedPhoto} alt="Фото" className="w-full rounded-zine-sm" />
        </BottomSheet>
      )}
    </div>
  );
};

const formatNewsDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// Ссылки в тексте новости делаем нажимаемыми
const linkify = (text: string) =>
  text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        onClick={(e) => {
          e.preventDefault();
          telegramService.openLink(part);
        }}
        className="text-zine-terracotta underline"
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export default NewsScreen;
