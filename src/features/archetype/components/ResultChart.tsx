import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ArchetypeScores } from '../types';

interface ResultChartProps {
  scores: ArchetypeScores;
}

const ResultChart: React.FC<ResultChartProps> = ({ scores }) => {
  const data = [
    { name: 'Facilitador', value: scores.FACILITADOR, color: '#22c55e' },
    { name: 'Analista', value: scores.ANALISTA, color: '#0ea5e9' },
    { name: 'Realizador', value: scores.REALIZADOR, color: '#f97316' },
    { name: 'Visionário', value: scores.VISIONÁRIO, color: '#a855f7' },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value: number) => [`${value} pontos`, 'Pontuação']} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResultChart;
