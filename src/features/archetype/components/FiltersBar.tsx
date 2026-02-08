import React from 'react';
import type { AudienceType } from '../types';

export interface ArchetypeFilters {
  dateFrom: string;
  dateTo: string;
  topProfile: string;
  audienceType: AudienceType | '';
  search: string;
  token: string;
}

interface FiltersBarProps {
  filters: ArchetypeFilters;
  tokens: string[];
  onChange: (next: ArchetypeFilters) => void;
}

const FiltersBar: React.FC<FiltersBarProps> = ({ filters, tokens, onChange }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">De</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Até</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Perfil</label>
        <select
          value={filters.topProfile}
          onChange={(e) => onChange({ ...filters, topProfile: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Todos</option>
          <option value="FACILITADOR">Facilitador</option>
          <option value="ANALISTA">Analista</option>
          <option value="REALIZADOR">Realizador</option>
          <option value="VISIONÁRIO">Visionário</option>
          <option value="EMPATE">Empate</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Audiência</label>
        <select
          value={filters.audienceType}
          onChange={(e) => onChange({ ...filters, audienceType: e.target.value as AudienceType | '' })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Todas</option>
          <option value="INTERNAL">Interna</option>
          <option value="EXTERNAL">Externa</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Campanha</label>
        <select
          value={filters.token}
          onChange={(e) => onChange({ ...filters, token: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Todas</option>
          {tokens.map((token) => (
            <option key={token} value={token}>
              {token}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Busca</label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Nome ou email"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>
    </div>
  );
};

export default FiltersBar;
