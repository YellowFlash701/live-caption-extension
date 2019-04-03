// Meet Live Translate — reads Meet/Zoom/Teams captions, shows Mistral
// translation and a Japanese answer with furigana. Answers are generated
// ONCE a speaker finishes their utterance, and the finalized transcript +
// the AI's answer are stored together in the meeting history.

(() => {
  const CFG_DEFAULTS = {
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
    finalizeMs: 1600, // silence gap before an utterance is considered "finished"
  };
  let cfg = { ...CFG_DEFAULTS };
  let overlayPos = null;

  const translateCache = new Map();
  const translateInflight = new Map();

  // ---------- meeting history ----------
  // Each entry: { id, t, speaker, text, translation, answerJp, answerTr, fromSelf, finalized }
  const history = [];
  let nextId = 1;

  function historyContext() {
    const n = Math.max(1, Math.min(50, cfg.historyTurns | 0 || 12));
    return history
      .slice(-n)
      .map((h) => {
        const base = `- ${h.speaker ? h.speaker + ": " : ""}${h.text}`;
        return h.answerJp ? `${base}\n  (my reply) ${h.answerJp}` : base;
      })
      .join("\n");
  }
  function fmtTime(t) {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function updateEntry(id, patch) {
    const i = history.findIndex((h) => h.id === id);
    if (i === -1) return;
    history[i] = { ...history[i], ...patch };
    renderHistory();
  }

  // ---------- overlay ----------
  let overlay, elLang, elText, elOrig, elAnsLabel, elAns, elAnsTr, dragBar, elHistory, toggleBtn;
  let historyVisible = true;
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "mlt-overlay";
    overlay.classList.add("mlt-hidden");

    dragBar = document.createElement("div");
    dragBar.className = "mlt-drag";
    const label = document.createElement("span");
    label.textContent = "☰ Meet Live Translate";
    const actions = document.createElement("div");
    actions.className = "mlt-drag-actions";

    toggleBtn = document.createElement("button");
    toggleBtn.className = "mlt-btn";
    toggleBtn.textContent = "Hide history";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      historyVisible = !historyVisible;
      elHistory.classList.toggle("mlt-hidden", !historyVisible);
      toggleBtn.textContent = historyVisible ? "Hide history" : "Show history";
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "mlt-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const txt = history
        .map((h) => {
          const head = `[${fmtTime(h.t)}] ${h.speaker ? h.speaker + ": " : ""}${h.text}`;
          const tr = h.translation && h.translation !== h.text ? `\n    → ${h.translation}` : "";
          const ans = h.answerJp ? `\n    ↳ answer: ${h.answerJp}${h.answerTr ? ` (${h.answerTr})` : ""}` : "";
          return head + tr + ans;
        })
        .join("\n");
      navigator.clipboard?.writeText(txt).then(() => {
        const prev = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = prev), 1200);
      });
    });

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "mlt-btn";
    downloadBtn.textContent = "Save";
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meeting-history-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const resetBtn = document.createElement("button");
    resetBtn.className = "mlt-btn";
    resetBtn.textContent = "Reset pos";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overlayPos = null;
      chrome.storage.local.remove("overlayPos");
      applyPos();
    });
    const clearBtn = document.createElement("button");
    clearBtn.className = "mlt-btn";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      history.length = 0;
      chrome.storage.local.remove("meetingHistory");
      renderHistory();
    });
    actions.append(toggleBtn, copyBtn, downloadBtn, clearBtn, resetBtn);
    dragBar.append(label, actions);

    const body = document.createElement("div");
    body.className = "mlt-body";
    elLang = document.createElement("span");
    elLang.className = "mlt-lang";
    elText = document.createElement("span");
    elText.className = "mlt-text";
    elOrig = document.createElement("span");
    elOrig.className = "mlt-original";
    elAnsLabel = document.createElement("span");
    elAnsLabel.className = "mlt-lang mlt-ans-label";
    elAnsLabel.textContent = "Suggested answer (JP + furigana)";
    elAns = document.createElement("span");
    elAns.className = "mlt-answer";
    elAnsTr = document.createElement("span");
    elAnsTr.className = "mlt-answer-tr";
    body.append(elLang, elText, elOrig, elAnsLabel, elAns, elAnsTr);

    elHistory = document.createElement("div");
    elHistory.className = "mlt-history";

    overlay.append(dragBar, body, elHistory);
    document.body.appendChild(overlay);

    renderHistory();
    enableDrag();
    applyPos();
  }

  function renderHistory() {
    if (!elHistory) return;
    if (!history.length) {
      elHistory.innerHTML = '<div class="mlt-history-empty">Transcript will appear here as speakers finish talking…</div>';
      persistHistory();
      return;
    }
    const wasAtBottom =
      elHistory.scrollHeight - elHistory.scrollTop - elHistory.clientHeight < 40;
    const frag = document.createDocumentFragment();
    for (const h of history) {
      const item = document.createElement("div");
      item.className = "mlt-history-item" + (h.finalized ? "" : " mlt-history-pending");
      const time = document.createElement("span");
      time.className = "mlt-history-time";
      time.textContent = fmtTime(h.t);
      item.appendChild(time);
      if (h.speaker) {
        const sp = document.createElement("span");
        sp.className = "mlt-history-speaker";
        sp.textContent = h.speaker + ":";
        item.appendChild(sp);
      }
      item.appendChild(document.createTextNode(" " + h.text));
      if (h.translation && h.translation !== h.text) {
        const tr = document.createElement("div");
        tr.className = "mlt-history-tr";
        tr.textContent = "→ " + h.translation;
        item.appendChild(tr);
      }
      if (h.answerJp) {
        const ans = document.createElement("div");
        ans.className = "mlt-history-answer";
        ans.textContent = "↳ " + h.answerJp;
        item.appendChild(ans);
        if (h.answerTr) {
          const ansTr = document.createElement("div");
          ansTr.className = "mlt-history-answer-tr";
          ansTr.textContent = "   " + h.answerTr;
          item.appendChild(ansTr);
        }
      }
      frag.appendChild(item);
    }
    elHistory.innerHTML = "";
    elHistory.appendChild(frag);
    if (wasAtBottom) elHistory.scrollTop = elHistory.scrollHeight;
    persistHistory();
  }

  let persistTimer = null;
  function persistHistory() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        chrome.storage.local.set({ meetingHistory: history.slice(-500) });
      } catch {}
    }, 300);
  }

  function applyPos() {
    if (!overlay) return;
    if (overlayPos && Number.isFinite(overlayPos.left) && Number.isFinite(overlayPos.top)) {
      overlay.classList.add("mlt-placed");
      overlay.style.left = overlayPos.left + "px";
      overlay.style.top = overlayPos.top + "px";
      overlay.style.bottom = "auto";
    } else {
      overlay.classList.remove("mlt-placed");
      overlay.style.left = "50%";
      overlay.style.top = "auto";
      overlay.style.bottom = "110px";
    }
  }

  function enableDrag() {
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    dragBar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".mlt-btn")) return;
      dragging = true;
      const r = overlay.getBoundingClientRect();
      ox = r.left; oy = r.top;
      sx = e.clientX; sy = e.clientY;
      dragBar.setPointerCapture(e.pointerId);
    });
    dragBar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const left = Math.max(0, Math.min(window.innerWidth - 40, ox + (e.clientX - sx)));
      const top = Math.max(0, Math.min(window.innerHeight - 40, oy + (e.clientY - sy)));
      overlayPos = { left, top };
      applyPos();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      try { dragBar.releasePointerCapture(e.pointerId); } catch {}
      if (overlayPos) chrome.storage.local.set({ overlayPos });
    };
    dragBar.addEventListener("pointerup", end);
    dragBar.addEventListener("pointercancel", end);
  }

  function showOverlay(translated, original) {
    ensureOverlay();
    elLang.textContent = cfg.target;
    elText.textContent = translated;
    elOrig.textContent = original && original !== translated ? original : "";
    overlay.classList.remove("mlt-hidden");
    const show = cfg.answerMode ? "" : "none";
    elAnsLabel.style.display = show;
    elAns.style.display = show;
    elAnsTr.style.display = show;
  }
  function setAnswer(text) { ensureOverlay(); elAns.textContent = text || ""; }
  function setAnswerTranslation(text) { ensureOverlay(); elAnsTr.textContent = text || ""; }
  function hideOverlay() { if (overlay) overlay.classList.add("mlt-hidden"); }

  // ---------- caption detection ----------
  const HOST = location.hostname;
  const IS_ZOOM = /(^|\.)zoom\.(us|com)$/i.test(HOST);
  const IS_TEAMS = /teams\.(microsoft|live)\.com$/i.test(HOST) || /teams\.cloud\.microsoft$/i.test(HOST);

  function findCaptionRoot() {
    if (IS_ZOOM) {
      return (
        document.querySelector(".live-transcription-subtitle") ||
        document.querySelector("#live-transcription-subtitle") ||
        document.querySelector(".multi-speaker-transcript") ||
        document.querySelector('[aria-label*="aption" i]') ||
        null
      );
    }
    if (IS_TEAMS) {
      return (
        document.querySelector('[data-tid="closed-caption-renderer-wrapper"]') ||
        document.querySelector('[data-tid="closed-captions-renderer"]') ||
        document.querySelector(".ts-captions-container") ||
        document.querySelector('[aria-label*="aption" i]') ||
        null
      );
    }
    return (
      document.querySelector(".a4cQT") ||
      document.querySelector('[jsname="tgaKEf"]') ||
      document.querySelector('div[aria-live="polite"][role="region"]') ||
      null
    );
  }

  function extractZoom(root) {
    const items = root.querySelectorAll(
      ".live-transcription-subtitle-item, [class*='subtitle-item'], [class*='transcript-item']"
    );
    const last = items[items.length - 1];
    if (last) {
      const nameEl = last.querySelector("[class*='__name'], [class*='-name'], [class*='author']");
      const textEl = last.querySelector("[class*='__text'], [class*='-text'], [class*='content']");
      return { speaker: (nameEl?.innerText || "").trim(), text: (textEl?.innerText || last.innerText || "").trim() };
    }
    return null;
  }
  function extractTeams(root) {
    const items = root.querySelectorAll(
      '[data-tid="closed-caption-v2-caption-info"], [data-tid*="caption"], .ts-captions-container .caption'
    );
    const last = items[items.length - 1];
    if (last) {
      const nameEl = last.querySelector('[data-tid*="author"], [class*="author"], [class*="Author"]');
      const textEl = last.querySelector('[data-tid*="text"], [class*="caption-text"], [class*="captionText"]');
      return { speaker: (nameEl?.innerText || "").trim(), text: (textEl?.innerText || last.innerText || "").trim() };
    }
    return null;
  }
  function extractCurrentCaption(root) {
    if (!root) return { speaker: "", text: "" };
    if (IS_ZOOM) { const z = extractZoom(root); if (z && z.text) return z; }
    else if (IS_TEAMS) { const t = extractTeams(root); if (t && t.text) return t; }
    const items = root.querySelectorAll("div[class]");
    let last = null;
    for (const el of items) {
      const t = (el.innerText || "").trim();
      if (!t) continue;
      const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
      if (lines.length >= 2 && lines.length <= 6) last = el;
    }
    if (!last) {
      const text = (root.innerText || "").trim();
      const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return { speaker: "", text: "" };
      if (lines.length === 1) return { speaker: "", text: lines[0] };
      return { speaker: lines[0], text: lines.slice(1).join(" ") };
    }
    const lines = (last.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
    return { speaker: lines[0] || "", text: lines.slice(1).join(" ") };
  }

  function isSelfSpeaker(speaker) {
    if (!speaker) return false;
    const self = (cfg.selfName || "").trim().toLowerCase();
    const s = speaker.trim().toLowerCase();
    if (!s) return false;
    if (s === "you") return true;
    if (self && (s === self || s.includes(self) || self.includes(s))) return true;
    return false;
  }

  // ---------- Mistral ----------
  async function mistral(messages) {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, temperature: 0.2, messages }),
    });
    if (!res.ok) throw new Error(`Mistral ${res.status}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content?.trim() || "";
  }

  async function translate(text) {
    if (!text) return "";
    if (translateCache.has(text)) return translateCache.get(text);
    if (translateInflight.has(text)) return translateInflight.get(text);
    if (!cfg.apiKey) return "";
    const p = mistral([
      { role: "system", content: `You are a real-time translator for a live video meeting. Translate the user's message into ${cfg.target}. Output ONLY the translation, no quotes, no explanations. If it is already in ${cfg.target}, return it unchanged.` },
      { role: "user", content: text },
    ])
      .then((out) => {
        translateCache.set(text, out);
        if (translateCache.size > 200) translateCache.delete(translateCache.keys().next().value);
        return out;
      })
      .finally(() => translateInflight.delete(text));
    translateInflight.set(text, p);
    return p;
  }

  async function answerFor(text) {
    if (!text || !cfg.apiKey) return { jp: "", translation: "" };
    const hist = historyContext();
    const info = (cfg.additionalInfo || "").trim();

    const sysAnswer =
      `${cfg.answerContext}\n\n` +
      (info ? `ADDITIONAL INFORMATION ABOUT ME (use it as ground truth when answering):\n${info}\n\n` : "") +
      (hist ? `RECENT MEETING TRANSCRIPT (most recent last, use it as conversation context):\n${hist}\n\n` : "") +
      `The LAST user message below is what was JUST said to me. Reply in NATURAL JAPANESE with a short, confident answer (1-2 sentences) that fits the meeting so far and the info above. Output ONLY the Japanese sentence, no explanations, no romaji, no translation, no quotes.`;

    const sysFurigana =
      `You add furigana readings to a Japanese sentence.\n` +
      `RULES — follow exactly:\n` +
      `1. After EVERY kanji word (one or more consecutive kanji), append its hiragana reading in half-width parentheses. Example: 日向森 -> 日向(ひゅうが)森(もり)。 経験 -> 経験(けいけん)。\n` +
      `2. After EVERY katakana word (one or more consecutive katakana), append its hiragana reading in half-width parentheses. Example: エンジニア -> エンジニア(えんじにあ)。\n` +
      `3. Do NOT annotate hiragana, punctuation, digits, or ASCII.\n` +
      `4. Keep the original sentence order and characters — only INSERT (reading) after kanji/katakana runs.\n` +
      `5. Output ONLY the annotated sentence. No prefixes, no explanations, no quotes.`;

    const jp = await mistral([
      { role: "system", content: sysAnswer },
      { role: "user", content: text },
    ]);
    let annotated = jp;
    try {
      annotated = await mistral([
        { role: "system", content: sysFurigana },
        { role: "user", content: jp },
      ]);
    } catch {}
    if (!annotated || (!/[(]/.test(annotated) && /[\u4e00-\u9faf\u30a0-\u30ff]/.test(annotated))) {
      try {
        annotated = await mistral([
          { role: "system", content: sysFurigana + "\n\nIMPORTANT: You MUST add (hiragana) after every kanji and katakana word." },
          { role: "user", content: jp },
        ]);
      } catch {}
    }
    let translation = "";
    try {
      translation = await mistral([
        { role: "system", content: `Translate the following Japanese sentence into ${cfg.target}. Output ONLY the translation, no quotes, no explanations. If the target is Japanese, return the sentence unchanged (without furigana).` },
        { role: "user", content: jp },
      ]);
    } catch {}
    return { jp: annotated || jp, translation };
  }

  // ---------- utterance finalization ----------
  // We buffer the "current" utterance per speaker. It's finalized when either
  // the speaker changes OR no new caption text arrives within finalizeMs.
  let current = null; // { id, speaker, text, fromSelf, lastUpdate, finalizeTimer }

  function startUtterance(speaker, text, fromSelf) {
    const id = nextId++;
    const entry = {
      id, t: Date.now(), speaker, text,
      translation: "", answerJp: "", answerTr: "",
      fromSelf, finalized: false,
    };
    history.push(entry);
    if (history.length > 500) history.shift();
    current = { id, speaker, text, fromSelf, lastUpdate: Date.now(), finalizeTimer: null };
    scheduleFinalize();
    renderHistory();

    // Live translate as text streams in (best-effort, updates the entry).
    translate(text).then((tr) => {
      if (!current || current.id !== id) return updateEntry(id, { translation: tr });
      updateEntry(id, { translation: tr });
    }).catch(() => {});
  }

  function extendUtterance(newText) {
    if (!current) return;
    current.text = newText;
    current.lastUpdate = Date.now();
    updateEntry(current.id, { text: newText });
    scheduleFinalize();
    // Refresh translation as the utterance grows.
    translate(newText).then((tr) => {
      if (current && current.id) updateEntry(current.id, { translation: tr });
    }).catch(() => {});
  }

  function scheduleFinalize() {
    if (!current) return;
    clearTimeout(current.finalizeTimer);
    current.finalizeTimer = setTimeout(finalizeCurrent, cfg.finalizeMs || 1600);
  }

  async function finalizeCurrent() {
    if (!current) return;
    const c = current;
    current = null;
    updateEntry(c.id, { finalized: true });

    // Ensure a final translation exists.
    try {
      const tr = await translate(c.text);
      updateEntry(c.id, { translation: tr });
    } catch {}

    // Only produce an answer for OTHERS, and only after they finished.
    if (cfg.answerMode && !c.fromSelf) {
      setAnswer("…");
      setAnswerTranslation("");
      try {
        const a = await answerFor(c.text);
        updateEntry(c.id, { answerJp: a.jp || "", answerTr: a.translation || "" });
        // Only show in the live panel if this is still the latest finalized entry.
        if (history[history.length - 1]?.id === c.id) {
          setAnswer(a.jp || "");
          setAnswerTranslation(a.translation || "");
        }
      } catch (e) {
        updateEntry(c.id, { answerJp: `[answer error: ${e.message}]` });
      }
    } else {
      setAnswer("");
      setAnswerTranslation("");
    }
  }

  // ---------- caption loop ----------
  let debounceTimer = null;
  function onCaptionChange() {
    if (!cfg.enabled) return hideOverlay();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const root = findCaptionRoot();
      const { speaker, text } = extractCurrentCaption(root);
      if (!text) return;

      const fromSelf = isSelfSpeaker(speaker);
      showOverlay("…", text);
      // Live translate for the overlay top line.
      translate(text).then((tr) => { if (tr) showOverlay(tr, text); }).catch(() => {});

      if (!current) {
        startUtterance(speaker, text, fromSelf);
        return;
      }
      const sameSpeaker = (current.speaker || "") === (speaker || "");
      const isExtension =
        sameSpeaker &&
        (text === current.text || text.startsWith(current.text) || current.text.startsWith(text) ||
         text.includes(current.text) || current.text.includes(text));

      if (isExtension) {
        // Prefer the longer version.
        const merged = text.length >= current.text.length ? text : current.text;
        extendUtterance(merged);
      } else {
        // Speaker changed OR completely new sentence — finalize old, start new.
        clearTimeout(current.finalizeTimer);
        finalizeCurrent();
        startUtterance(speaker, text, fromSelf);
      }
    }, 120);
  }

  const observer = new MutationObserver(onCaptionChange);
  function startObserving() {
    observer.disconnect();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  chrome.storage.sync.get(CFG_DEFAULTS, (stored) => {
    cfg = { ...CFG_DEFAULTS, ...stored };
    chrome.storage.local.get({ overlayPos: null, meetingHistory: [] }, ({ overlayPos: p, meetingHistory }) => {
      overlayPos = p;
      if (Array.isArray(meetingHistory) && meetingHistory.length) {
        for (const h of meetingHistory) {
          history.push({ ...h, id: nextId++ });
        }
      }
      ensureOverlay();
      if (overlay) applyPos();
      renderHistory();
    });
    startObserving();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.overlayPos) {
      overlayPos = changes.overlayPos.newValue;
      applyPos();
      return;
    }
    for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
    translateCache.clear();
    if (!cfg.enabled) hideOverlay();
  });
})();
