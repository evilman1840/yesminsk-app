import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';

const REASONS = [
  { id: 'flirt', label: '💋 Флирт, намёки на свидания' },
  { id: 'rude', label: '😠 Грубость, оскорбления' },
  { id: 'spam', label: '📢 Спам или реклама' },
  { id: 'fake', label: '🎭 Фейк, чужие фото' },
  { id: 'danger', label: '⚠️ Опасное поведение' },
  { id: 'other', label: '❓ Другое' }
];

/**
 * Жалоба на анкету или сходку. Уходит модератору в Telegram
 */
export const ReportSheet: React.FC<{
  targetType: 'user' | 'event';
  targetId: string | number;
  targetName: string;
  onClose: () => void;
  onReported: () => void;
}> = ({ targetType, targetId, targetName, onClose, onReported }) => {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason) {
      setError('Выбери причину');
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await api.report(targetType, targetId, reason, comment.trim());
      telegramService.haptic('success');
      setIsSent(true);
    } catch (err: any) {
      setError(err.message || 'Не получилось отправить жалобу');
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <BottomSheet
        title="Спасибо за сигнал 🙏"
        onClose={() => {
          onReported();
          onClose();
        }}
      >
        <p className="text-body text-zine-ink">
          {targetType === 'user'
            ? 'Мы проверим анкету. Этот человек больше не будет тебе показываться.'
            : 'Мы проверим сходку и примем меры, если нужно.'}
        </p>
        <p className="mt-3 text-sm2 text-zine-inkMuted">Если тебе угрожает опасность — звони 102 (милиция).</p>
        <button
          onClick={() => {
            onReported();
            onClose();
          }}
          className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
        >
          Понятно
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={targetType === 'user' ? `Жалоба: ${targetName}` : 'Жалоба на сходку'} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">Что случилось? Жалоба анонимна — человек не узнает, кто её отправил.</p>

      <div className="mt-4 space-y-2">
        {REASONS.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              telegramService.haptic('selection');
              setReason(r.id);
              setError(null);
            }}
            className={`w-full h-12 px-4 rounded-zine-sm border-2 text-left text-body font-semibold transition-colors cursor-pointer ${
              reason === r.id ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-ink' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <textarea
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Подробности — по желанию"
        className="field mt-3"
      />

      {error && <p className="mt-3 text-sm2 font-semibold text-zine-danger">{error}</p>}

      <button
        onClick={send}
        disabled={isSending}
        className="mt-4 w-full h-12 rounded-zine-sm bg-zine-danger text-white text-body font-bold flex items-center justify-center cursor-pointer"
      >
        {isSending ? <Loader2 size={20} className="animate-spin" /> : 'Отправить жалобу'}
      </button>
    </BottomSheet>
  );
};

/**
 * Памятка для безопасной первой встречи
 */
export const SafetyTipsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BottomSheet title="Безопасная встреча 🛡" onClose={onClose}>
    <div className="space-y-4">
      {[
        { emoji: '☕️', title: 'Встречайтесь в людных местах', text: 'Кафе, парк днём, центр города. Не в квартире и не в безлюдном месте.' },
        { emoji: '📱', title: 'Скажи близким', text: 'Напиши другу, куда и с кем идёшь, и когда примерно вернёшься.' },
        { emoji: '🚕', title: 'Добирайся самостоятельно', text: 'Не садись в машину к малознакомому человеку и не называй свой адрес.' },
        { emoji: '💳', title: 'Никаких денег', text: 'Не переводи деньги и не давай в долг. Просьбы о деньгах — повод для жалобы.' },
        { emoji: '🚪', title: 'Можно уйти', text: 'Если что-то не так — уходи без объяснений. Это нормально.' },
        { emoji: '⚠️', title: 'Сообщи нам', text: 'Нарушение правил — нажми «Пожаловаться». В опасной ситуации звони 102.' }
      ].map((tip) => (
        <div key={tip.title} className="flex gap-3.5">
          <span className="w-12 h-12 shrink-0 rounded-zine-sm bg-zine-card flex items-center justify-center text-[24px]">{tip.emoji}</span>
          <div>
            <p className="text-body font-bold text-zine-ink">{tip.title}</p>
            <p className="text-sm2 text-zine-inkMuted mt-0.5">{tip.text}</p>
          </div>
        </div>
      ))}
    </div>
    <button onClick={onClose} className="mt-6 w-full h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer">
      Понятно
    </button>
  </BottomSheet>
);
