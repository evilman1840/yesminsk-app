import React from 'react';

// Название и город: «ГУЛЯЙ!», а под ним рукописно — город. Появятся другие города — меняется только CITY_TAGLINE
export const BRAND = 'ГУЛЯЙ!';
export const CITY_TAGLINE = 'ДА! МИНСК';
// Старое имя константы: подпись под логотипом
export const TAGLINE = CITY_TAGLINE;

/**
 * Текстовый логотип «ГУЛЯЙ!», по желанию — с рукописной подписью города («ДА! МИНСК») под ним
 */
export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg'; withTagline?: boolean; className?: string }> = ({
  size = 'md',
  withTagline = false,
  className = ''
}) => (
  <span className={`inline-flex flex-col shrink-0 whitespace-nowrap ${className}`}>
    <span
      className={`font-serif font-bold tracking-tight leading-none text-zine-ink ${
        size === 'lg' ? 'text-[34px]' : size === 'sm' ? 'text-[19px]' : 'text-[24px]'
      }`}
    >
      ГУЛЯЙ<span className="text-zine-terracotta">!</span>
    </span>
    {withTagline && (
      <span
        className={`font-hand font-semibold leading-none text-zine-terracotta -rotate-2 origin-left ${
          size === 'lg' ? 'mt-1 text-[26px]' : size === 'sm' ? 'mt-0.5 text-[16px]' : 'mt-1 text-[20px]'
        }`}
      >
        {CITY_TAGLINE}
      </span>
    )}
  </span>
);
