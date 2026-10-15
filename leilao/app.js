import { classifyLead, ROUTES } from "./scoring.js";

const CONFIG = Object.freeze({
  api: {
    lead: "/api/lead",
  },
  privacyUrl: "https://hopecapital.com.br/privacidade",
  timezone: "America/Sao_Paulo",
  totalFunnelScreens: 7, // 7 main screens + education + capture
  storageKey: "hope_qualification_v1",
  pendingKey: "hope_qualification_pending_v1",
});

const questions = [
  {
    id: "hope_historia",
    number: 1,
    stage: "reconhecimento",
    type: "single",
    title: "Qual dessas frases é mais parecida com a sua história?",
    options: [
      "Já pensei em comprar imóvel em leilão, mas nunca fui adiante",
      "Já acompanhei editais, cheguei perto, mas nunca dei o lance",
      "Já arrematei um imóvel e quero fazer de novo, melhor",
      "Nunca olhei leilão, mas sempre quis ganhar dinheiro com imóvel",
    ],
  },
  {
    id: "hope_freio",
    number: 2,
    stage: "freio",
    type: "single",
    title: "E o que te fez parar da última vez?",
    description: "Pode ser sincero. Todo mundo trava em uma dessas.",
    options: [
      "Medo de comprar um problema — dívida, ocupação, processo",
      "Não sei avaliar se o desconto é real",
      "Achei que precisava de muito dinheiro",
      "Não tenho tempo de acompanhar edital",
      "Não conheço ninguém que já tenha feito de verdade",
    ],
  },
  {
    id: "education",
    stage: "virada",
    type: "education",
  },
  {
    id: "hope_capital",
    number: 3,
    stage: "capital",
    type: "single",
    title: "Quanto você teria hoje para arrematar o primeiro imóvel?",
    description: "Leilão não é só para quem tem milhão. Só precisamos saber a faixa certa pra você.",
    options: [
      "Até R$ 50 mil",
      "R$ 50 mil a R$ 150 mil",
      "R$ 150 mil a R$ 300 mil",
      "Acima de R$ 300 mil",
      "Pretendo usar financiamento ou consórcio",
    ],
  },
  {
    id: "hope_objetivo",
    number: 4,
    stage: "objetivo",
    type: "single",
    title: "E o que você quer fazer com esse imóvel?",
    options: [
      "Comprar barato e revender com lucro",
      "Montar renda de aluguel",
      "Comprar o meu, pagando bem menos que o mercado",
      "Construir um patrimônio, comprando mais de um por ano",
    ],
  },
  {
    id: "hope_objecao_final",
    number: 5,
    stage: "provocacao",
    type: "textarea",
    title: "Se eu te mostrasse um imóvel avaliado em R$ 500 mil saindo por R$ 300 mil, com toda a parte jurídica conferida e alguém conduzindo cada etapa com você — o que ainda te faria hesitar?",
    description: "Escreve sem filtro. É essa resposta que eu preparo antes da nossa conversa.",
    placeholder: "Digite sua mensagem...",
    maxLength: 200,
  },
  {
    id: "hope_prazo",
    number: 6,
    stage: "prazo",
    type: "single",
    title: "Se aparecesse o imóvel certo no mês que vem, você estaria pronto?",
    options: [
      "Sim, tenho o dinheiro separado",
      "Sim, mas precisaria de 60 a 90 dias para organizar",
      "Só no ano que vem",
      "Não sei, ainda estou entendendo como funciona",
    ],
  },
  {
    id: "hope_momento",
    number: 7,
    stage: "momento",
    type: "single",
    title: "Qual opção descreve o seu momento hoje?",
    description: "Selecione a alternativa que mais combina com a sua realidade.",
    options: [
      "Só quero entender como funciona. Não pretendo arrematar nada nos próximos meses.",
      "Quero ser avisado quando aparecer a oportunidade certa para o meu perfil e decidir na hora.",
      "Quero uma assessoria conduzindo comigo do edital à posse do imóvel, no meu primeiro arremate.",
      "Quero volume. Comprar mais de um imóvel por ano, como operação, com time cuidando de tudo.",
    ],
  }
];

const phaseEndScreens = Object.freeze({
  hope_freio: "freio",
  hope_objetivo: "objetivo",
  hope_prazo: "prazo",
});

const app = document.querySelector("#app");
const progressWrap = document.querySelector("#progress-wrap");
const progressBar = document.querySelector("#progress-bar");
const progressTrack = document.querySelector(".progress-track");
const progressValue = document.querySelector("#progress-value");
const progressLabel = document.querySelector("#progress-label");
const toast = document.querySelector("#toast");

const state = loadState();
let isSubmitting = false;

function createLeadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `hope-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initialState() {
  return {
    version: "1.0",
    leadId: createLeadId(),
    currentScreen: -1,
    startedAt: new Date().toISOString(),
    contact: { nome: "", whatsapp: "" },
    answers: {},
    completed: false,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
    if (saved?.version === "1.0" && saved?.leadId) {
      return { ...initialState(), ...saved };
    }
  } catch {
    localStorage.removeItem(CONFIG.storageKey);
  }
  return initialState();
}

function saveState() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateProgress(screenIndex = state.currentScreen, complete = false) {
  if (screenIndex < 0 && !complete) {
    progressWrap.hidden = true;
    return;
  }

  progressWrap.hidden = false;
  const percent = complete
    ? 100
    : Math.round(((screenIndex + 1) / CONFIG.totalFunnelScreens) * 100);
  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  progressValue.textContent = `${percent}%`;
  progressLabel.textContent = complete ? "Qualificação concluída" : "Seu diagnóstico";
}

function focusScreen() {
  requestAnimationFrame(() => {
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function render() {
  if (state.completed) {
    renderResult(classifyLead(state.answers, { isComplete: true }));
    return;
  }

  if (state.currentScreen < 0) {
    renderCapture();
    return;
  }

  renderQuestion(questions[state.currentScreen]);
}

function renderCapture() {
  updateProgress(-1);
  app.innerHTML = `
    <section class="screen screen-card capture-card" aria-labelledby="capture-title">
      <div class="capture-copy">
        <h1 id="capture-title">Você já olhou um leilão de imóvel e não foi adiante.</h1>
        <p class="lead">Não foi falta de vontade. Foi falta de alguém do seu lado para dizer o que fazer em cada etapa.</p>
        <div class="asset-placeholder" role="img" aria-label="Foto de imóvel arrematado">
          <div>
            <strong>[ foto de imóvel arrematado pela Hope ]</strong>
            <span>Valor de avaliação x valor de arremate</span>
          </div>
        </div>
      </div>
      <form class="capture-form" id="capture-form" novalidate>
        <p class="lead">Responda 7 perguntas rápidas. Em <strong>90 segundos</strong> eu te digo se leilão faz sentido pra você agora — e, se fizer, a gente marca uma conversa.</p>
        ${captureField("nome", "Seu nome", "text", "Nome e sobrenome", "name", state.contact.nome)}
        ${captureField("whatsapp", "WhatsApp com DDD", "tel", "(11) 99999-9999", "tel", state.contact.whatsapp)}
        <button class="button button-full" type="submit">Quero saber se faz sentido pra mim</button>
        <p class="privacy-note" style="margin-top: 16px; font-size: 12px; text-align: center; color: var(--ink-soft)">
          Ao continuar você concorda com a
          <a href="${CONFIG.privacyUrl}" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
        </p>
      </form>
    </section>
  `;

  const form = document.querySelector("#capture-form");
  form.addEventListener("submit", submitCapture);
  focusScreen();
}

function captureField(id, label, type, placeholder, autocomplete, value) {
  return `
    <div class="field-group">
      <label class="sr-only" for="${id}">${label}</label>
      <input
        class="text-input"
        id="${id}"
        name="${id}"
        type="${type}"
        value="${escapeHtml(value)}"
        placeholder="${placeholder}"
        autocomplete="${autocomplete}"
        required
      />
    </div>
  `;
}

function submitCapture(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const nome = form.elements.nome.value.trim();
  const whatsapp = form.elements.whatsapp.value.trim();

  if (!nome || !whatsapp) {
    alert("Preencha todos os campos.");
    return;
  }

  state.contact = { nome, whatsapp };
  state.currentScreen = 0;
  saveState();
  render();
}

function renderQuestion(question) {
  updateProgress();
  if (question.type === "education") {
    renderEducation();
    return;
  }

  app.innerHTML = `
    <section class="screen screen-card" aria-labelledby="question-title">
      <h2 id="question-title">${question.title}</h2>
      ${question.description ? `<p class="lead">${question.description}</p>` : ""}
      ${renderControl(question)}
      ${question.type === "single" ? "" : renderActions("Continuar")}
    </section>
  `;

  bindQuestionEvents(question);
  focusScreen();
}

function renderControl(question) {
  const currentValue = state.answers[question.id];
  if (question.type === "textarea") {
    const value = currentValue || "";
    return `
      <label class="sr-only" for="${question.id}">${question.title}</label>
      <textarea
        class="textarea"
        id="${question.id}"
        maxlength="${question.maxLength}"
        placeholder="${question.placeholder}"
      >${escapeHtml(value)}</textarea>
      <span class="counter" id="counter">${String(value).length}/${question.maxLength}</span>
    `;
  }

  return `
    <div class="choices" role="radiogroup" aria-label="${escapeHtml(question.title)}">
      ${question.options
        .map((option) => {
          const selected = currentValue === option;
          return `
            <button
              class="choice${selected ? " is-selected" : ""}"
              type="button"
              data-value="${escapeHtml(option)}"
              role="radio"
              aria-checked="${selected}"
            >
              <span class="choice-marker" aria-hidden="true">✓</span>
              <span class="choice-label">${option}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderActions(label) {
  return `
    <div class="actions">
      <button class="button actions-right button-full" type="button" data-action="continue">${label}</button>
    </div>
  `;
}

function bindQuestionEvents(question) {
  document.querySelector("[data-action='continue']")?.addEventListener("click", () => submitCurrent(question));

  if (question.type === "textarea") {
    const textarea = document.querySelector(`#${question.id}`);
    textarea.addEventListener("input", () => {
      state.answers[question.id] = textarea.value;
      document.querySelector("#counter").textContent = `${textarea.value.length}/${question.maxLength}`;
      saveState();
    });
    return;
  }

  document.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.value;
      state.answers[question.id] = value;
      saveState();
      document.querySelectorAll(".choice").forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-checked", String(selected));
      });
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      submitCurrent(question);
    });
  });
}

function submitCurrent(question) {
  const value = state.answers[question.id];
  if (!value) {
    alert("Selecione ou preencha uma resposta para continuar.");
    return;
  }

  const isFinal = question.id === "hope_momento";
  if (isFinal) {
    state.completed = true;
    saveState();
    renderResult(classifyLead(state.answers, { isComplete: true }));
    return;
  }

  state.currentScreen += 1;
  saveState();
  render();
}

function renderEducation() {
  updateProgress();
  app.innerHTML = `
    <section class="screen screen-card education-card" aria-labelledby="education-title">
      <p class="eyebrow">Quase todo mundo para no mesmo ponto: não é o imóvel que assusta, é fazer sozinho.</p>
      <p>Edital, matrícula, dívida de condomínio, IPTU, ocupação, prazo de pagamento, imissão na posse. São sete etapas onde dá pra errar — e é exatamente por isso que existe assessoria. <strong>E se você não precisasse fazer nada disso sozinho?</strong></p>
      <div style="display: flex; justify-content: space-between; margin: 24px 0; text-align: center;">
        <div style="flex: 1; border: 1px solid var(--line); padding: 16px; border-radius: var(--radius); margin-right: 8px;">
          <strong style="font-size: 24px; color: #1d704d;">7</strong><br>
          <span style="font-size: 12px;">etapas entre o edital e a chave</span>
        </div>
        <div style="flex: 1; border: 1px solid var(--line); padding: 16px; border-radius: var(--radius); margin-left: 8px;">
          <strong style="font-size: 24px; color: #1d704d;">0</strong><br>
          <span style="font-size: 12px;">delas você precisa fazer sozinho</span>
        </div>
      </div>
      <button class="button button-full" data-action="continue">Continuar</button>
    </section>
  `;
  document.querySelector("[data-action='continue']").addEventListener("click", () => {
    state.currentScreen += 1;
    saveState();
    render();
  });
  focusScreen();
}

function renderResult(classification) {
  updateProgress(-1, true);
  if (classification.route === ROUTES.EDUCATION) {
    app.innerHTML = `
      <section class="screen screen-card">
        <h2>Você ainda está na fase de entender. Tudo bem — é assim que começa.</h2>
        <p>Vou te mandar no WhatsApp o passo a passo de um arremate real: o edital, quanto o imóvel valia, por quanto saiu, o que tinha de dívida e como resolvemos cada etapa. Quando você olhar isso e pensar "eu conseguiria fazer", a gente conversa.</p>
        <button class="button button-full">Quero acompanhar um arremate real</button>
      </section>
    `;
  } else {
    app.innerHTML = `
      <section class="screen screen-card">
        <p class="eyebrow" style="color: #1d704d;">PRONTO. AGORA É SÓ ESCOLHER O HORÁRIO.</p>
        <p>Na conversa eu te mostro <strong>imóveis reais em leilão hoje na sua faixa</strong> — com avaliação, valor de arremate, dívidas e o retorno estimado. E respondo exatamente o que você escreveu que te faria hesitar.</p>
        <div class="asset-placeholder" role="img" aria-label="Calendário">
          <div>
            <strong>[ Calendário ]</strong>
            <span>Selecione um dia e horário</span>
          </div>
        </div>
      </section>
    `;
  }
}

// Inicializa a aplicação
render();
