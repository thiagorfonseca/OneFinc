import React from 'react';
import ContentsList from '../components/contents/ContentsList';

const ContentsTrainings: React.FC = () => {
  return (
    <ContentsList
      type="training"
      title="Treinamentos"
      subtitle="Treinamentos rápidos para o time da clínica."
      basePath="/contents/trainings"
    />
  );
};

export default ContentsTrainings;
