import React from 'react';

export const TAGLINE = 'выходи гулять!';

/**
 * Текстовый логотип «ДА! МИНСК», по желанию — с рукописной подписью «выходи гулять!» под ним
 */
export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg'; withTagline?: boolean; className?: string }> = ({
  size = 'md',
  withTagline = false,
  className = ''
}) => (
  <span className={`inline-flex flex-col shrink-0 whitespace-nowrap ${className}`}>
    <span
      className={`font-serif font-bold tracking-tight leading-none text-zine-ink ${
        size === 'lg' ? 'text-[34px]' : size === 'sm' ? 'text-[17px]' : 'text-[22px]'
      }`}
    >
      <span className="text-zine-terracotta">ДА!</span> МИНСК
    </span>
    {withTagline && (
      <span
        className={`font-hand font-semibold leading-none text-zine-terracotta -rotate-2 origin-left ${
          size === 'lg' ? 'mt-1 text-[28px]' : size === 'sm' ? 'mt-0.5 text-[17px]' : 'mt-1 text-[21px]'
        }`}
      >
        {TAGLINE}
      </span>
    )}
  </span>
);
