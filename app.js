const CONFIG = Object.freeze({
  webhookUrl: "https://n8n.v4lisboatech.com.br/webhook/hope-capital-lp",
  attributionKey: "hope_capital_attribution_v1",
});

const questions = [
  {
    id: "investment_amount",
    title: "Quanto você pretende investir para começar? (entrada + custos)",
    options: [
      "Ainda não tenho recurso separado",
      "Até R$ 30 mil",
      "De R$ 30 mil a R$ 100 mil",
      "De R$ 100 mil a R$ 300 mil",
      "Acima de R$ 300 mil",
    ],
  },
  {
    id: "purchase_timing",
    title: "Quando você pretende comprar seu primeiro imóvel em leilão?",
    options: [
      "Nos próximos 3 meses",
      "Entre 3 e 6 meses",
      "Mais de 6 meses",
      "Só estou pesquisando",
    ],
  },
  {
    id: "property_goal",
    title: "Qual é o seu objetivo com o imóvel?",
    options: ["Investimento (revenda ou aluguel)", "Moradia", "Outro"],
  },
  {
    id: "purchase_guidance",
    title: "Como você prefere conduzir a compra?",
    options: [
      "Quero acompanhamento de especialistas do início ao fim",
      "Quero orientação pontual",
      "Prefiro fazer sozinho",
    ],
  },
];

const form = document.querySelector("#lead-form");
const stepContainer = document.querySelector("#lead-step");
const stepLabel = document.querySelector("#lead-step-label");
const stepValue = document.querySelector("#lead-step-value");
const progressBar = document.querySelector("#lead-progress-bar");
const formIntro = document.querySelector("#lead-form-intro");
const nextButton = document.querySelector("#lead-next");
const backButton = document.querySelector("#lead-back");
const submitButton = document.querySelector("#lead-submit");
const statusElement = document.querySelector("#lead-form-status");

const state = {
  currentStep: 0,
  answers: {},
  contact: { nome: "", telefone: "", email: "" },
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readStoredAttribution() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG.attributionKey) || "null");
    if (!stored || typeof stored !== "object") return {};

    const age = Date.now() - Number(stored.captured_at || 0);
    return age <= 90 * 24 * 60 * 60 * 1000 ? stored.parameters || {} : {};
  } catch {
    return {};
  }
}

function captureAttribution() {
  const stored = readStoredAttribution();
  const current = {};

  for (const [key, value] of new URLSearchParams(window.location.search)) {
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      current[key] = Array.isArray(current[key])
        ? [...current[key], value]
        : [current[key], value];
    } else {
      current[key] = value;
    }
  }

  const parameters = { ...stored, ...current };
  if (Object.keys(current).length > 0) {
    localStorage.setItem(
      CONFIG.attributionKey,
      JSON.stringify({ captured_at: Date.now(), parameters }),
    );
  }

  return parameters;
}

const attribution = captureAttribution();

function createLeadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `hope-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-visible", Boolean(message));
  statusElement.classList.toggle("is-error", type === "error");
  statusElement.classList.toggle("is-success", type === "success");
}

function updateProgress() {
  const totalSteps = questions.length + 1;
  const percent = Math.round(((state.currentStep + 1) / totalSteps) * 100);
  stepLabel.textContent = state.currentStep < questions.length
    ? `Pergunta ${state.currentStep + 1} de ${questions.length}`
    : "Contato · última etapa";
  stepValue.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function renderQuestion() {
  const question = questions[state.currentStep];
  const selected = state.answers[question.id] || "";

  formIntro.textContent = "Responda uma pergunta por vez para receber um direcionamento alinhado ao seu momento.";
  stepContainer.innerHTML = `
    <div class="lead-step">
      <fieldset class="form-fieldset">
        <legend>${state.currentStep + 1}. ${question.title}</legend>
        <select id="current-answer" name="${question.id}" required>
          <option value="" ${selected ? "" : "selected"} disabled>Selecione uma opção</option>
          ${question.options
            .map(
              (option) => `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${option}</option>`,
            )
            .join("")}
        </select>
      </fieldset>
    </div>
  `;

  nextButton.hidden = false;
  submitButton.hidden = true;
  backButton.hidden = state.currentStep === 0;
  nextButton.textContent = "Avançar →";
  updateProgress();
  setStatus("");
}

function renderContact() {
  formIntro.textContent = "Agora deixe seus dados para que nossa equipe possa analisar suas respostas e entrar em contato.";
  stepContainer.innerHTML = `
    <div class="lead-step">
      <div class="form-field">
        <label for="nome">Nome</label>
        <input id="nome" name="nome" type="text" autocomplete="name" placeholder="Seu nome e sobrenome" value="${escapeHtml(state.contact.nome)}" required>
      </div>
      <div class="form-field">
        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" value="${escapeHtml(state.contact.email)}" required>
      </div>
      <div class="form-field">
        <label for="telefone">Telefone (WhatsApp)</label>
        <input id="telefone" name="telefone" type="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${escapeHtml(state.contact.telefone)}" required>
      </div>
    </div>
  `;

  stepContainer.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      state.contact[input.name] = input.value;
    });
  });

  nextButton.hidden = true;
  submitButton.hidden = false;
  backButton.hidden = true;
  updateProgress();
  setStatus("");
}

function renderStep() {
  if (state.currentStep < questions.length) {
    renderQuestion();
  } else {
    renderContact();
  }
}

function goNext() {
  const select = stepContainer.querySelector("select");
  if (!select?.checkValidity()) {
    select?.reportValidity();
    return;
  }

  state.answers[questions[state.currentStep].id] = select.value;
  state.currentStep += 1;
  renderStep();
}

function goBack() {
  if (state.currentStep === 0) return;
  state.currentStep -= 1;
  renderStep();
}

function buildPayload() {
  return {
    event: "generate_lead",
    event_name: "generate_lead",
    form_id: "hope-capital-lp",
    lead_id: createLeadId(),
    created_at: new Date().toISOString(),
    contact: { ...state.contact },
    answers: { ...state.answers },
    tracking_parameters: attribution,
    page: {
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || "",
      title: document.title,
    },
    technical: {
      language: navigator.language || "",
      user_agent: navigator.userAgent || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    },
  };
}

function trackGenerateLead(payload) {
  const eventData = {
    event: "generate_lead",
    event_name: "generate_lead",
    form_id: payload.form_id,
    lead_id: payload.lead_id,
    answers: payload.answers,
    tracking_parameters: payload.tracking_parameters,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventData);
  window.dispatchEvent(new CustomEvent("generate_lead", { detail: eventData }));

  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", eventData);
  }

  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", "generate_lead", {
      form_id: payload.form_id,
      lead_id: payload.lead_id,
    });
  }
}

async function submitLead(event) {
  event.preventDefault();

  // Proteção contra submit acidental por Enter durante as perguntas.
  if (state.currentStep !== questions.length || submitButton.hidden) {
    return;
  }

  const contactInputs = stepContainer.querySelectorAll("input");
  contactInputs.forEach((input) => {
    state.contact[input.name] = input.value.trim();
  });

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = buildPayload();
  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  setStatus("");

  try {
    const response = await fetch(CONFIG.webhookUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`Webhook respondeu com HTTP ${response.status}`);
    }

    trackGenerateLead(payload);
    submitButton.textContent = "Dados enviados ✓";
    setStatus("Recebemos suas respostas. Nossa equipe entrará em contato com um direcionamento para o seu momento.", "success");
  } catch (error) {
    console.error("Falha ao enviar lead:", error);
    submitButton.disabled = false;
    submitButton.textContent = "Quero receber meu direcionamento →";
    setStatus("Não foi possível enviar seus dados agora. Tente novamente em instantes.", "error");
  }
}

nextButton.addEventListener("click", goNext);
backButton.addEventListener("click", goBack);
form.addEventListener("submit", submitLead);
renderStep();
