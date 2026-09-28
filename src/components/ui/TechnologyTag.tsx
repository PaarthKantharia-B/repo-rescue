import React from 'react';
import { Cpu, Layers, Box, Code2 } from 'lucide-react';

interface TechnologyTagProps {
  technology: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const TechnologyTag: React.FC<TechnologyTagProps> = ({
  technology,
  size = 'md',
  className = '',
}) => {
  const techLower = technology.toLowerCase();

  let tagStyle = 'bg-slate-900 border-slate-800 text-slate-300';
  let Icon = Box;

  if (techLower.includes('node') || techLower.includes('react') || techLower.includes('typescript') || techLower.includes('next')) {
    tagStyle = 'bg-blue-950/40 border-blue-800/50 text-blue-300';
    Icon = Code2;
  } else if (techLower.includes('python') || techLower.includes('pytorch') || techLower.includes('ai') || techLower.includes('ml')) {
    tagStyle = 'bg-amber-950/40 border-amber-800/50 text-amber-300';
    Icon = Cpu;
  } else if (techLower.includes('rust') || techLower.includes('go') || techLower.includes('c++')) {
    tagStyle = 'bg-orange-950/40 border-orange-800/50 text-orange-300';
    Icon = Layers;
  } else if (techLower.includes('k8s') || techLower.includes('kubernetes') || techLower.includes('docker') || techLower.includes('infra')) {
    tagStyle = 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300';
    Icon = Box;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border backdrop-blur-sm transition-colors ${tagStyle} ${padding} ${className}`}
    >
      <Icon className="w-3 h-3 shrink-0 opacity-70" />
      <span>{technology}</span>
    </span>
  );
};
