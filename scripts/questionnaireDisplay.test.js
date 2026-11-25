import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuestionnaireDisplaySections } from '../src/utils/questionnaireDisplay.js';

test('groups client answers under readable section and field labels', () => {
  const sections = getQuestionnaireDisplaySections({
    name: 'Ana Pérez',
    age: 28,
    mainObjective: 'Fuerza',
    injuries: 'Molestia lumbar\nAl agacharme',
    trainingDays: 3,
    submittedAt: '2026-11-25T10:00:00.000Z',
  });

  assert.deepEqual(sections.map(section => section.title), [
    'Datos personales',
    'Objetivos y motivación',
    'Salud y seguridad',
    'Entrenamiento',
  ]);
  assert.deepEqual(sections[0].answers.map(answer => [answer.label, answer.value]), [
    ['Nombre y apellidos', 'Ana Pérez'],
    ['Edad', '28'],
  ]);
  assert.equal(sections[2].answers[0].value, 'Molestia lumbar\nAl agacharme');
  assert.equal(sections[3].answers[0].value, '3');
  assert.equal(sections.some(section => section.answers.some(answer => answer.key === 'submittedAt')), false);
});

test('keeps zero values and omits unanswered or unknown metadata', () => {
  const sections = getQuestionnaireDisplaySections({
    stepsDaily: 0,
    additionalNotes: '  ',
    privacyConsentAt: '2026-11-25T10:00:00.000Z',
  });

  assert.deepEqual(sections, [{
    title: 'Recuperación y estilo de vida',
    answers: [{ key: 'stepsDaily', label: 'Pasos diarios aproximados', value: '0' }],
  }]);
});

test('returns no sections when no answers have been submitted', () => {
  assert.deepEqual(getQuestionnaireDisplaySections({}), []);
});
