/**
 * CLESSIDRA — script.js
 * ---------------------------------------------------------------
 * Il file è diviso in "moduli" (semplici oggetti JS), ognuno con
 * una responsabilità precisa. Non servono framework: sono solo
 * oggetti che raggruppano funzioni collegate tra loro, per tenere
 * il codice ordinato e facile da modificare pezzo per pezzo.
 *
 *  - Storage   -> legge/scrive punti e streak nel browser (localStorage)
 *  - Converter -> trasforma "minuti" in attività alternative
 *  - Timer     -> gestisce l'avvio/pausa/reset del cronometro
 *  - UI        -> collega tutto alla pagina (bottoni, testi, animazioni)
 * ---------------------------------------------------------------
 */

/* =========================================================
   MODULO: STORAGE
   Salva i dati dell'utente nel browser, così restano anche
   se chiude la pagina e la riapre (nessun server necessario).
   ========================================================= */
const Storage = {
  KEY: "clessidra-data",

  // Legge i dati salvati, oppure restituisce i valori di partenza
  load() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) {
      return { totalMinutes: 0, streak: 0, lastUsedDate: null };
    }
    return JSON.parse(raw);
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  // Aggiunge minuti al totale e aggiorna la streak giornaliera.
  // La streak sale di 1 solo se l'utente non aveva già usato l'app oggi;
  // si azzera se è passato più di un giorno dall'ultimo utilizzo.
  registerUsage(minutes) {
    const data = this.load();
    const today = new Date().toDateString();

    if (data.lastUsedDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterday = data.lastUsedDate === yesterday.toDateString();

      data.streak = wasYesterday ? data.streak + 1 : 1;
      data.lastUsedDate = today;
    }

    data.totalMinutes += minutes;
    this.save(data);
    return data;
  },
};

/* =========================================================
   MODULO: I18N
   Gestisce il cambio lingua (IT/EN). I testi statici sono letti
   direttamente dagli attributi data-i18n-it / data-i18n-en messi
   nell'HTML; i testi dinamici (generati da JS) usano invece le
   funzioni sotto, in base alla lingua corrente.
   ========================================================= */
const I18n = {
  KEY: "clessidra-lang",
  current: "it",

  init() {
    const saved = localStorage.getItem(this.KEY);
    if (saved) {
      // L'utente ha già scelto una lingua in passato: rispettiamo quella
      this.current = saved;
    } else {
      // Prima visita: rileviamo la lingua del browser/dispositivo.
      // Se inizia con "en" (en-US, en-GB...) usiamo l'inglese, altrimenti italiano di default.
      const browserLang = (navigator.language || "it").toLowerCase();
      this.current = browserLang.startsWith("en") ? "en" : "it";
    }
    this.apply(this.current);
  },

  setLanguage(lang) {
    this.current = lang;
    localStorage.setItem(this.KEY, lang);
    this.apply(lang);
  },

  // Applica la lingua a tutti gli elementi statici con attributi data-i18n-*
  apply(lang) {
    document.querySelectorAll("[data-i18n-it]").forEach((el) => {
      el.textContent = el.dataset[lang === "en" ? "i18nEn" : "i18nIt"];
    });

    document.getElementById("btn-lang-it").classList.toggle("is-active", lang === "it");
    document.getElementById("btn-lang-en").classList.toggle("is-active", lang === "en");

    document.documentElement.lang = lang;
  },
};

/* =========================================================
   MODULO: CONVERTER
   Traduce un numero di minuti in attività alternative concrete,
   usando tassi realistici "al minuto". Funziona bene anche per
   intervalli brevi (es. 1 minuto) perché ogni tasso è proporzionale.
   ========================================================= */
const Converter = {
  // Ogni attività ha un tasso "quantità per minuto" e un modo
  // di formattare il risultato in una frase leggibile.
  activities: [
    {
      icon: "📖",
      rate: 0.45, // pagine al minuto (lettura media)
      format: (qty, lang) =>
        lang === "en"
          ? `read ${Converter.round(qty, "pages", lang)} of a book`
          : `leggere ${Converter.round(qty, "pagine", lang)} di un libro`,
    },
    {
      icon: "🚶",
      rate: 80, // metri al minuto camminando
      format: (qty, lang) => {
        const km = qty >= 1000;
        if (lang === "en") {
          return km ? `walk ${(qty / 1000).toFixed(1)} km` : `walk ${Math.round(qty)} meters`;
        }
        return km ? `camminare ${(qty / 1000).toFixed(1)} km` : `camminare ${Math.round(qty)} metri`;
      },
    },
    {
      icon: "💪",
      rate: 8, // flessioni al minuto (ritmo sostenibile)
      format: (qty, lang) =>
        lang === "en"
          ? `do ${Math.max(1, Math.round(qty))} push-ups`
          : `fare ${Math.max(1, Math.round(qty))} flessioni`,
    },
    {
      icon: "🧘",
      rate: 1, // 1:1 — il tempo stesso diventa minuti di respiro consapevole
      format: (qty, lang) =>
        lang === "en"
          ? `do ${Math.max(1, Math.round(qty))} minutes of mindful breathing`
          : `fare ${Math.max(1, Math.round(qty))} minuti di respirazione consapevole`,
    },
    {
      icon: "📞",
      rate: 1,
      format: (qty, lang) =>
        lang === "en"
          ? `call someone you love and talk for ${Math.max(1, Math.round(qty))} minutes`
          : `chiamare una persona cara e parlare per ${Math.max(1, Math.round(qty))} minuti`,
    },
    {
      icon: "✍️",
      rate: 18, // parole scritte al minuto (scrittura riflessiva, non a macchina)
      format: (qty, lang) =>
        lang === "en"
          ? `write ${Math.round(qty)} words in your journal`
          : `scrivere ${Math.round(qty)} parole nel tuo diario`,
    },
  ],

  // Arrotonda in modo "umano": sotto 1 usa le frazioni comuni
  round(qty, unit, lang) {
    if (qty < 1) {
      if (lang === "en") {
        if (qty >= 0.66) return `2/3 of a page`;
        if (qty >= 0.4) return `half a page`;
        return `a few lines`;
      }
      if (qty >= 0.66) return `2/3 di pagina`;
      if (qty >= 0.4) return `mezza pagina`;
      return `qualche riga`;
    }
    return `${Math.round(qty)} ${unit}`;
  },

  // Restituisce un sottoinsieme (4) di attività calcolate per i minuti dati,
  // nella lingua corrente, mescolate ad ogni chiamata per tenere l'esperienza fresca.
  getAlternatives(minutes, lang, count = 4) {
    const shuffled = [...this.activities].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((activity) => ({
      icon: activity.icon,
      text: activity.format(activity.rate * minutes, lang),
    }));
  },
};

/* =========================================================
   MODULO: TIMER
   Gestisce il cronometro live (avvio, pausa, reset) ed espone
   un callback "onTick" per aggiornare la UI ogni secondo.
   ========================================================= */
const Timer = {
  seconds: 0,
  intervalId: null,
  onTick: null, // funzione impostata dalla UI

  start() {
    if (this.intervalId) return; // già in esecuzione, non duplicare
    this.intervalId = setInterval(() => {
      this.seconds += 1;
      if (this.onTick) this.onTick(this.seconds);
    }, 1000);
  },

  pause() {
    clearInterval(this.intervalId);
    this.intervalId = null;
  },

  reset() {
    this.pause();
    this.seconds = 0;
    if (this.onTick) this.onTick(this.seconds);
  },

  isRunning() {
    return this.intervalId !== null;
  },
};

/* =========================================================
   MODULO: UI
   Collega i moduli sopra agli elementi della pagina HTML.
   ========================================================= */
const UI = {
  // Un ciclo completo dell'anello corrisponde a 20 minuti:
  // dà un feedback visivo di progresso anche su sessioni lunghe.
  RING_CYCLE_SECONDS: 20 * 60,
  RING_CIRCUMFERENCE: 553,

  els: {}, // riferimenti agli elementi DOM, popolati in init()

  init() {
    this.cacheElements();
    this.bindEvents();
    this.refreshStats();
  },

  cacheElements() {
    this.els = {
      modeTimerBtn: document.getElementById("btn-mode-timer"),
      modeManualBtn: document.getElementById("btn-mode-manual"),
      viewTimer: document.getElementById("view-timer"),
      viewManual: document.getElementById("view-manual"),

      startBtn: document.getElementById("btn-start"),
      pauseBtn: document.getElementById("btn-pause"),
      resetBtn: document.getElementById("btn-reset"),

      manualInput: document.getElementById("manual-input"),
      manualSubmitBtn: document.getElementById("btn-manual-submit"),

      ring: document.getElementById("hourglass-ring"),
      ringFill: document.getElementById("ring-fill"),
      displayTime: document.getElementById("display-time"),

      results: document.getElementById("results"),
      resultsList: document.getElementById("results-list"),
      dismissBtn: document.getElementById("btn-dismiss"),

      statPoints: document.getElementById("stat-points"),
      statStreak: document.getElementById("stat-streak"),

      resultsTitle: document.getElementById("results-title"),
      langItBtn: document.getElementById("btn-lang-it"),
      langEnBtn: document.getElementById("btn-lang-en"),
    };
  },

  bindEvents() {
    this.els.modeTimerBtn.addEventListener("click", () => this.switchMode("timer"));
    this.els.modeManualBtn.addEventListener("click", () => this.switchMode("manual"));

    this.els.startBtn.addEventListener("click", () => this.handleStart());
    this.els.pauseBtn.addEventListener("click", () => this.handlePause());
    this.els.resetBtn.addEventListener("click", () => this.handleReset());

    this.els.manualSubmitBtn.addEventListener("click", () => this.handleManualSubmit());
    this.els.manualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleManualSubmit();
    });

    this.els.dismissBtn.addEventListener("click", () => this.hideResults());

    this.els.langItBtn.addEventListener("click", () => I18n.setLanguage("it"));
    this.els.langEnBtn.addEventListener("click", () => I18n.setLanguage("en"));

    // Collega il tick del timer all'aggiornamento del display e dell'anello
    Timer.onTick = (seconds) => this.updateTimeDisplay(seconds);
  },

  /* ---------- Cambio modalità (timer / manuale) ---------- */
  switchMode(mode) {
    const isTimer = mode === "timer";
    this.els.modeTimerBtn.classList.toggle("is-active", isTimer);
    this.els.modeManualBtn.classList.toggle("is-active", !isTimer);
    this.els.modeTimerBtn.setAttribute("aria-selected", String(isTimer));
    this.els.modeManualBtn.setAttribute("aria-selected", String(!isTimer));
    this.els.viewTimer.classList.toggle("is-active", isTimer);
    this.els.viewManual.classList.toggle("is-active", !isTimer);
  },

  /* ---------- Controlli del timer ---------- */
  handleStart() {
    Timer.start();
    this.els.ring.classList.add("is-running");
    this.els.startBtn.disabled = true;
    this.els.pauseBtn.disabled = false;
    this.els.resetBtn.disabled = false;
  },

  handlePause() {
    Timer.pause();
    this.els.ring.classList.remove("is-running");
    this.els.startBtn.disabled = false;
    this.els.pauseBtn.disabled = true;

    // In pausa, se è passato almeno 1 minuto, mostriamo già i risultati
    const minutes = Timer.seconds / 60;
    if (minutes >= 1) this.showResultsFor(minutes);
  },

  handleReset() {
    Timer.reset();
    this.els.ring.classList.remove("is-running");
    this.els.ringFill.style.strokeDashoffset = this.RING_CIRCUMFERENCE;
    this.els.startBtn.disabled = false;
    this.els.pauseBtn.disabled = true;
    this.els.resetBtn.disabled = true;
    this.hideResults();
  },

  updateTimeDisplay(totalSeconds) {
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    this.els.displayTime.textContent = `${mm}:${ss}`;
    this.updateRing(totalSeconds);
  },

  /* ---------- Input manuale ---------- */
  handleManualSubmit() {
    const minutes = parseFloat(this.els.manualInput.value);
    if (!minutes || minutes <= 0) {
      this.els.manualInput.focus();
      return;
    }

    // Mostra il valore inserito anche nel display circolare, per coerenza visiva
    this.els.displayTime.textContent = `${Math.round(minutes)}:00`;
    this.updateRing(minutes * 60);

    this.showResultsFor(minutes);
    this.els.manualInput.value = "";
  },

  /* ---------- Anello di progresso ---------- */
  updateRing(totalSeconds) {
    const progress = (totalSeconds % this.RING_CYCLE_SECONDS) / this.RING_CYCLE_SECONDS;
    const offset = this.RING_CIRCUMFERENCE * (1 - progress);
    this.els.ringFill.style.strokeDashoffset = offset;
  },

  /* ---------- Risultati + gamification ---------- */
  showResultsFor(minutes) {
    const rounded = Math.round(minutes);
    const lang = I18n.current;

    this.els.resultsTitle.textContent =
      lang === "en" ? `In ${rounded} minutes, you could have:` : `In ${rounded} minuti, avresti potuto:`;

    const alternatives = Converter.getAlternatives(minutes, lang);
    this.els.resultsList.innerHTML = alternatives
      .map((a) => `<li><span class="icon">${a.icon}</span><span>${a.text}</span></li>`)
      .join("");

    this.els.results.hidden = false;
    this.els.results.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Registra l'uso: aggiorna punti totali e streak, poi ridisegna le statistiche
    const updated = Storage.registerUsage(rounded);
    this.refreshStats(updated);
  },

  hideResults() {
    this.els.results.hidden = true;
  },

  refreshStats(data = Storage.load()) {
    this.els.statPoints.textContent = data.totalMinutes;
    this.els.statStreak.textContent = data.streak;
  },
};

/* =========================================================
   AVVIO APP
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  I18n.init();
  UI.init();
});
