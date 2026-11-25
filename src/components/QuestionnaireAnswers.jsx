import { getQuestionnaireDisplaySections } from '../utils/questionnaireDisplay.js';

export const QuestionnaireAnswers = ({ questionnaire = {}, defaultOpen = false }) => {
  const sections = getQuestionnaireDisplaySections(questionnaire);
  const answerCount = sections.reduce((total, section) => total + section.answers.length, 0);

  return (
    <details open={defaultOpen || undefined} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.22em] text-zinc-300">
        Ver cuestionario completo · {answerCount} respuestas
      </summary>
      <div className="mt-4 space-y-4">
        {questionnaire.privacyConsentAt && (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[10px] text-emerald-200">
            Consentimiento informado registrado: {new Date(questionnaire.privacyConsentAt).toLocaleString('es-ES')}
          </p>
        )}
        {sections.length === 0 && <p className="text-xs text-zinc-400">No hay respuestas disponibles.</p>}
        {sections.map(section => (
          <section key={section.title} aria-label={section.title}>
            <h5 className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">{section.title}</h5>
            <div className="grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-2">
              {section.answers.map(answer => (
                <div key={answer.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="font-black uppercase text-zinc-500">{answer.label}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-zinc-200">{answer.value}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
};
