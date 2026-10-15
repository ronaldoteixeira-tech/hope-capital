export const ROUTES = Object.freeze({
  CALENDAR: "S1", // Fila padrão / agendamento
  EDUCATION: "S2", // Nutrição / Clube (sem agenda)
});

export const TAGS = Object.freeze({
  RECORRENCIA: "recorrencia", // Quero volume
  ASSESSORIA: "assessoria", // Quero uma assessoria conduzindo comigo
  OPORTUNIDADE: "oportunidade", // Quero ser avisado quando aparecer
  NUTRICAO: "nutricao", // Só quero entender como funciona
});

export function classifyLead(answers, options = { isComplete: false }) {
  if (!options.isComplete) {
    return { score: 0, route: ROUTES.CALENDAR, tag: TAGS.OPORTUNIDADE };
  }

  const momento = answers.hope_momento || "";
  const prazo = answers.hope_prazo || "";
  const capital = answers.hope_capital || "";
  const historia = answers.hope_historia || "";

  // Regra de Roteamento de Saída (Seção 4)
  if (
    momento === "Só quero entender como funciona. Não pretendo arrematar nada nos próximos meses." ||
    prazo === "Só no ano que vem"
  ) {
    return {
      score: 0,
      route: ROUTES.EDUCATION,
      tag: TAGS.NUTRICAO,
      calendarDuration: 0,
    };
  }

  // Definição da Tag Principal com base em T7
  let tag = TAGS.OPORTUNIDADE;
  let duration = 30;

  if (momento.includes("Quero volume")) {
    tag = TAGS.RECORRENCIA;
    duration = 45;
  } else if (momento.includes("Quero uma assessoria")) {
    tag = TAGS.ASSESSORIA;
    duration = 45;
  }

  // Score de priorização (Seção 4.2)
  let score = 0;

  if (momento.includes("Quero volume")) score += 40;
  if (momento.includes("Quero uma assessoria")) score += 35;

  if (capital.includes("Acima de R$ 300 mil")) score += 25;
  if (capital.includes("R$ 150 mil a R$ 300 mil")) score += 20;

  if (prazo.includes("Tenho o dinheiro separado")) score += 25;

  if (historia.includes("Já arrematei")) score += 10;

  return {
    score,
    route: ROUTES.CALENDAR,
    tag,
    calendarDuration: duration,
  };
}
