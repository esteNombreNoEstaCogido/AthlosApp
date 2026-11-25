const DISPLAY_SECTIONS = [
  {
    title: 'Datos personales',
    fields: [
      ['name', 'Nombre y apellidos'],
      ['age', 'Edad'],
      ['weightKg', 'Peso actual (kg)'],
      ['heightCm', 'Altura (cm)'],
      ['occupation', 'Ocupación'],
      ['dailyActivityLevel', 'Actividad diaria'],
    ],
  },
  {
    title: 'Objetivos y motivación',
    fields: [
      ['mainObjective', 'Objetivo principal'],
      ['deadline', 'Fecha límite / evento'],
      ['commitmentLevel', 'Compromiso actual (1-10)'],
      ['priorityMuscles', 'Grupo muscular a priorizar'],
    ],
  },
  {
    title: 'Salud y seguridad',
    fields: [
      ['injuries', 'Lesiones o dolor recurrente'],
      ['surgeries', 'Cirugías o fracturas previas'],
      ['medicalConditions', 'Condiciones médicas'],
      ['medication', 'Medicación relevante'],
    ],
  },
  {
    title: 'Entrenamiento',
    fields: [
      ['trainingDays', 'Días por semana'],
      ['sessionMinutes', 'Minutos por sesión'],
      ['trainingPlace', 'Dónde entrena'],
      ['equipment', 'Material disponible'],
      ['trainingExperience', 'Experiencia entrenando con cargas'],
      ['basicTechnique', 'Técnica en ejercicios básicos'],
      ['mobilityLimits', 'Limitaciones de movilidad'],
      ['favoriteExercises', 'Ejercicios que disfruta o evita'],
      ['forbiddenExercises', 'Ejercicios que no quiere repetir'],
    ],
  },
  {
    title: 'Recuperación y estilo de vida',
    fields: [
      ['sleepHours', 'Horas de sueño medias'],
      ['sleepQuality', 'Calidad del sueño'],
      ['stressLevel', 'Estrés diario (1-10)'],
      ['extraActivity', 'Actividad adicional'],
      ['nutritionState', 'Situación nutricional'],
      ['stepsDaily', 'Pasos diarios aproximados'],
      ['additionalNotes', 'Notas adicionales'],
    ],
  },
];

export const getQuestionnaireDisplaySections = (questionnaire = {}) => DISPLAY_SECTIONS
  .map(section => ({
    title: section.title,
    answers: section.fields
      .filter(([key]) => questionnaire[key] !== undefined
        && questionnaire[key] !== null
        && String(questionnaire[key]).trim() !== '')
      .map(([key, label]) => ({ key, label, value: String(questionnaire[key]) })),
  }))
  .filter(section => section.answers.length > 0);
