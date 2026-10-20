import React from 'react';

/**
 * Текстовый логотип «ДА! МИНСК»
 */
export const Logo: React.FC<{ size?: 'md' | 'lg'; className?: string }> = ({ size = 'md', className = '' }) => (
  <span
    className={`font-serif font-bold tracking-tight leading-none text-zine-ink ${
      size === 'lg' ? 'text-[34px]' : 'text-[22px]'
    } ${className}`}
  >
    <span className="text-zine-terracotta">ДА!</span> МИНСК
  </span>
);
