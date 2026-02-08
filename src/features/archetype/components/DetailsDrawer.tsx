import React from 'react';
import { X } from 'lucide-react';
import ResultChart from './ResultChart';
import type { ArchetypeAnswerRow, ArchetypeRespondentRow } from '../types';
import { useModalControls } from '../../../../hooks/useModalControls';

interface DetailsDrawerProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  respondent: ArchetypeRespondentRow | null;
  answers: ArchetypeAnswerRow[];
}

const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ open, loading, onClose, respondent, answers }) => {
  useModalControls({ isOpen: open, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-xl p-6 overflow-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
        >
          <X size={18} />
        </button>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Detalhes do respondente</h3>
            <p className="text-sm text-gray-500">Resultados individuais e escolhas do teste.</p>
          </div>
          {loading && <p className="text-sm text-gray-500">Carregando detalhes...</p>}
          {!loading && respondent && (
            <>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-sm font-medium text-gray-800">{respondent.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm text-gray-700">{respondent.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">WhatsApp</p>
                  <p className="text-sm text-gray-700">{respondent.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Perfil vencedor</p>
                  <p className="text-sm font-semibold text-gray-800">{respondent.top_profile}</p>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <ResultChart scores={respondent.scores} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Respostas</h4>
                <div className="space-y-2">
                  {answers
                    .slice()
                    .sort((a, b) => a.question_id - b.question_id)
                    .map((answer) => (
                      <div
                        key={`${answer.respondent_id}-${answer.question_id}`}
                        className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="text-gray-600">Pergunta {answer.question_id}</span>
                        <span className="font-medium text-gray-800">{answer.selected_word}</span>
                        <span className="text-xs text-gray-500">{answer.scored_profile}</span>
                      </div>
                    ))}
                  {answers.length === 0 && <p className="text-sm text-gray-400">Nenhuma resposta encontrada.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailsDrawer;
