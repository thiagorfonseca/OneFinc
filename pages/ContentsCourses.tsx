import React from 'react';
import ContentsList from '../components/contents/ContentsList';

const ContentsCourses: React.FC = () => {
  return (
    <ContentsList
      type="course"
      title="Cursos"
      subtitle="Explore cursos gravados disponíveis para sua clínica."
      basePath="/contents/courses"
    />
  );
};

export default ContentsCourses;
