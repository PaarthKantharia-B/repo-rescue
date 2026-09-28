import React from 'react';

interface LanguageTagProps {
  language: string;
  className?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Shell: '#89e051',
};

export const LanguageTag: React.FC<LanguageTagProps> = ({
  language,
  className = '',
}) => {
  const dotColor = LANGUAGE_COLORS[language] || '#94a3b8';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 ${className}`}>
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      <span>{language}</span>
    </span>
  );
};
