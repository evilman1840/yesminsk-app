import React from 'react';

/**
 * Значок доната: сердце со знаком белорусского рубля «Б» внутри.
 * Сердце — цветом текста (currentColor), знак вырезан цветом фона кнопки (cutout)
 */
export const DonateIcon: React.FC<{ size?: number; cutout: string; className?: string }> = ({ size = 24, cutout, className = '' }) => (
  <svg width={size} height={(size * 22) / 24} viewBox="0 0 24 22" className={className} aria-hidden>
    <path fill="currentColor" d="M12 21.3 10.5 20C5.2 15.2 1.7 12 1.7 8.1 1.7 4.9 4.2 2.4 7.4 2.4c1.8 0 3.5.8 4.6 2.2 1.1-1.4 2.8-2.2 4.6-2.2 3.2 0 5.7 2.5 5.7 5.7 0 3.9-3.5 7.1-8.8 11.9L12 21.3z" />
    {/* «Б» со штрихом: стойка, верхняя перекладина, чаша снизу и черта через стойку */}
    <path
      fill={cutout}
      fillRule="evenodd"
      transform="translate(7.3 4) scale(0.15)"
      d="M14 4h40v9H23v19h17a22 22 0 0 1 0 44H14V58H2v-8h12V4zm9 37v26h17a13 13 0 0 0 0-26H23zm0 9v8h17v-8H23z"
    />
  </svg>
);
