import React from 'react';

interface QuestionCardProps {
  index: number;
  total: number;
  options: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ index, total, options, selectedIndex, onSelect }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Pergunta {index + 1} de {total}</p>
        <h2 className="text-xl font-semibold text-gray-800 mt-1">Escolha a palavra que mais combina com você</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, optionIndex) => {
          const selected = selectedIndex === optionIndex;
          return (
            <button
              key={`${option}-${optionIndex}`}
              type="button"
              onClick={() => onSelect(optionIndex)}
              className={`text-left px-4 py-3 rounded-xl border transition-all ${
                selected
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <span className="font-medium">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionCard;
