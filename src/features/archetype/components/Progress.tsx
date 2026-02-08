import React from 'react';

interface ProgressProps {
  current: number;
  total: number;
  label?: string;
}

const Progress: React.FC<ProgressProps> = ({ current, total, label }) => {
  const safeTotal = total > 0 ? total : 1;
  const percent = Math.min(100, Math.max(0, (current / safeTotal) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{label || 'Progresso'}</span>
        <span>{current}/{total}</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default Progress;
