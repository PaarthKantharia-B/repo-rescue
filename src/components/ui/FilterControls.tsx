import React from 'react';
import { FilterOptions } from '@/types';
import { Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';

interface FilterControlsProps {
  filters: FilterOptions;
  onChange: (updatedFilters: FilterOptions) => void;
  className?: string;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onChange,
  className = '',
}) => {
  const languages = ['All Languages', 'TypeScript', 'Python', 'Rust', 'Go', 'C++', 'Java'];
  const ecosystems = ['All Ecosystems', 'Node.js', 'Python/PyTorch', 'Rust/Cargo', 'Go/Cloud', 'Infra/K8s'];
  const sortOptions = [
    { value: 'recent', label: 'Newest & Freshest' },
    { value: 'difficulty_desc', label: 'Highest RR Difficulty' },
    { value: 'difficulty_asc', label: 'Lowest RR Difficulty' },
    { value: 'points_desc', label: 'Highest RR Points' },
    { value: 'activity_desc', label: 'Active Maintainers' },
  ];

  const handleReset = () => {
    onChange({
      search: '',
      language: '',
      ecosystem: '',
      minDifficulty: 0,
      maxDifficulty: 10,
      minMaintainerActivity: 0,
      repoType: '',
      sortBy: 'recent',
    });
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/90 p-4 backdrop-blur-md ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Search Bar */}
        <div className="relative md:col-span-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search issues, repos, topics..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Language Filter */}
        <div className="md:col-span-2">
          <select
            value={filters.language || 'All Languages'}
            onChange={(e) => onChange({ ...filters, language: e.target.value === 'All Languages' ? '' : e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Ecosystem Filter */}
        <div className="md:col-span-2">
          <select
            value={filters.ecosystem || 'All Ecosystems'}
            onChange={(e) => onChange({ ...filters, ecosystem: e.target.value === 'All Ecosystems' ? '' : e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            {ecosystems.map((eco) => (
              <option key={eco} value={eco}>
                {eco}
              </option>
            ))}
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="md:col-span-3">
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] })}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-blue-400 font-semibold focus:outline-none focus:border-blue-500 font-mono"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary Controls (Difficulty range pills) */}
      <div className="mt-3 pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-500">RR Difficulty Range:</span>
          {[
            { label: 'All', min: 0, max: 10 },
            { label: 'Easy (0–3.4)', min: 0, max: 3.4 },
            { label: 'Medium (3.5–6.4)', min: 3.5, max: 6.4 },
            { label: 'Hard (6.5–8.4)', min: 6.5, max: 8.4 },
            { label: 'Expert+ (8.5–10)', min: 8.5, max: 10 },
          ].map((preset) => {
            const isActive = filters.minDifficulty === preset.min && filters.maxDifficulty === preset.max;
            return (
              <button
                key={preset.label}
                onClick={() => onChange({ ...filters, minDifficulty: preset.min, maxDifficulty: preset.max })}
                className={`px-2.5 py-1 rounded-md border font-mono transition-all ${
                  isActive
                    ? 'bg-blue-950 border-blue-600 text-blue-300 font-semibold'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {(filters.search || filters.language || filters.ecosystem || filters.minDifficulty > 0 || filters.maxDifficulty < 10) && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-mono"
          >
            <X className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
