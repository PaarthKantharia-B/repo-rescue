import React from 'react';
import { ExternalLink, Github } from 'lucide-react';

interface GitHubLinkProps {
  href: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const GitHubLink: React.FC<GitHubLinkProps> = ({
  href,
  label = 'View on GitHub',
  size = 'md',
  className = '',
}) => {
  const padding = size === 'sm' ? 'px-2 py-1 text-xs gap-1' : 'px-3 py-1.5 text-xs font-semibold gap-1.5';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700 transition-all duration-200 group font-mono ${padding} ${className}`}
    >
      <Github className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-white" />
      <span>{label}</span>
      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
    </a>
  );
};
