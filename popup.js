const DEFAULTS = {
  enabled: true,
  target: "English",
  model: "mistral-small-latest",
  apiKey: "q1qxQR4DRt9tJsuJuxwolCjplKr3WxCc",
  answerMode: true,
  answerContext:
    "I am a software engineer in a job interview / meeting. Answer concisely and confidently in first person.",
  additionalInfo: "",
  historyTurns: 12,
  selfName: "You",
  finalizeMs: 1600,
};

const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  $("enabled").checked = cfg.enabled;
  $("target").value = cfg.target;
  $("model").value = cfg.model;
  $("apikey").value = cfg.apiKey;
  $("answerMode").checked = cfg.answerMode;
  $("answerContext").value = cfg.answerContext;
  $("additionalInfo").value = cfg.additionalInfo;
  $("historyTurns").value = cfg.historyTurns;
  $("selfName").value = cfg.selfName;
  $("finalizeMs").value = cfg.finalizeMs;
});

$("save").addEventListener("click", () => {
  const data = {
    enabled: $("enabled").checked,
    target: $("target").value,
    model: $("model").value,
    apiKey: $("apikey").value.trim(),
    answerMode: $("answerMode").checked,
    answerContext: $("answerContext").value.trim() || DEFAULTS.answerContext,
    additionalInfo: $("additionalInfo").value,
    historyTurns: Math.max(1, Math.min(50, parseInt($("historyTurns").value, 10) || DEFAULTS.historyTurns)),
    selfName: $("selfName").value.trim() || DEFAULTS.selfName,
    finalizeMs: Math.max(400, Math.min(6000, parseInt($("finalizeMs").value, 10) || DEFAULTS.finalizeMs)),
  };
  chrome.storage.sync.set(data, () => {
    $("status").textContent = "Saved. Refresh your Meet tab if it's open.";
    setTimeout(() => ($("status").textContent = ""), 3000);
  });
});
