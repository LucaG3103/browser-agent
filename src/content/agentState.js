// Agent State Manager Module
// Gestisce lo stato persistente dell'agente durante l'esecuzione di task complessi
// Supporta persistenza cross-page tramite browser.storage

/**
 * Logger centralizzato per debug
 */
const AgentLogger = {
    enabled: true,
    apiCallCount: 0,

    log(category, message, data = null) {
        if (!this.enabled) return;
        const timestamp = new Date().toISOString().substr(11, 12);
        const prefix = `[${timestamp}] [${category}]`;
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    },

    apiCall() {
        this.apiCallCount++;
        this.log('API', `📡 Chiamata API #${this.apiCallCount}`);
        return this.apiCallCount;
    },

    reset() {
        this.apiCallCount = 0;
        this.log('SYSTEM', '🔄 Logger resettato');
    },

    summary() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 SOMMARIO ESECUZIONE`);
        console.log(`   Chiamate API totali: ${this.apiCallCount}`);
        console.log(`   Step completati: ${agentState.currentStep}`);
        console.log(`   Errori: ${agentState.errors.length}`);
        console.log(`   Durata: ${agentState.startTime ? Math.round((Date.now() - agentState.startTime) / 1000) : 0}s`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
};

/**
 * Stato globale dell'agente
 */
const agentState = {
    isRunning: false,
    goal: "",                    // Obiettivo dell'utente
    currentStep: 0,              // Step corrente
    completedActions: [],        // Azioni completate con risultato
    lastDOM: null,               // Ultimo snapshot DOM
    lastActionResult: null,      // Risultato ultima azione
    attempts: 0,                 // Tentativi per l'azione corrente
    maxAttempts: 3,              // Max retry per singola azione
    maxTotalSteps: 25,           // Circuit breaker globale (Aumentato per task complessi)
    startTime: null,             // Timestamp inizio task
    maxDuration: 300000,         // Timeout globale (5 min)
    errors: [],                  // Errori accumulati
    minDelayBetweenCalls: 1000,  // Minimo delay tra chiamate API (Ridotto per velocità)
    isPersisted: false,          // Flag per indicare se lo stato è stato ripristinato
    pendingAction: null          // Azione in corso di esecuzione (per gestire crash/navigazione)
};

// Chiave per storage
const STORAGE_KEY = 'agent_persistent_state';

/**
 * Salva lo stato corrente nel browser storage
 * @returns {Promise<void>}
 */
async function persistState() {
    if (!agentState.isRunning) return;

    const stateToSave = {
        isRunning: agentState.isRunning,
        goal: agentState.goal,
        currentStep: agentState.currentStep,
        completedActions: agentState.completedActions,
        attempts: agentState.attempts,
        startTime: agentState.startTime,
        errors: agentState.errors,
        savedAt: Date.now(),
        pendingAction: agentState.pendingAction // Salviamo anche l'azione pendente
    };

    try {
        await browser.storage.local.set({ [STORAGE_KEY]: stateToSave });
        AgentLogger.log('PERSIST', `💾 Stato salvato (step ${agentState.currentStep})`);
    } catch (error) {
        console.error('❌ Errore salvataggio stato:', error);
    }
}

/**
 * Carica lo stato dal browser storage
 * @returns {Promise<Object|null>} Stato salvato o null
 */
async function loadPersistedState() {
    try {
        const result = await browser.storage.local.get(STORAGE_KEY);
        const savedState = result[STORAGE_KEY];

        if (!savedState) {
            AgentLogger.log('PERSIST', '📭 Nessuno stato salvato trovato');
            return null;
        }

        // Verifica che lo stato non sia troppo vecchio (max 5 minuti)
        const age = Date.now() - savedState.savedAt;
        if (age > 5 * 60 * 1000) {
            AgentLogger.log('PERSIST', `⏰ Stato troppo vecchio (${Math.round(age / 1000)}s), ignorato`);
            await clearPersistedState();
            return null;
        }

        // Verifica che il task non sia già completato
        if (!savedState.isRunning) {
            AgentLogger.log('PERSIST', '✅ Task già completato');
            await clearPersistedState();
            return null;
        }

        return savedState;

    } catch (error) {
        console.error('❌ Errore caricamento stato:', error);
        return null;
    }
}

/**
 * Cancella lo stato persistente
 * @returns {Promise<void>}
 */
async function clearPersistedState() {
    try {
        await browser.storage.local.remove(STORAGE_KEY);
        AgentLogger.log('PERSIST', '🗑️ Stato persistente cancellato');
    } catch (error) {
        console.error('❌ Errore cancellazione stato:', error);
    }
}

/**
 * Ripristina lo stato dall'oggetto salvato
 * @param {Object} savedState - Stato salvato
 */
function restoreState(savedState) {
    agentState.isRunning = true;
    agentState.goal = savedState.goal;
    agentState.currentStep = savedState.currentStep;
    agentState.completedActions = savedState.completedActions || [];
    agentState.attempts = savedState.attempts || 0;
    agentState.startTime = savedState.startTime;
    agentState.errors = savedState.errors || [];
    agentState.isPersisted = true;
    agentState.pendingAction = null; // Resettiamo inizialmente

    // Se c'era un'azione pendente quando si è interrotto (es. causa navigazione)
    // la promuoviamo ad azione completata con stato incerto
    if (savedState.pendingAction) {
        AgentLogger.log('PERSIST', `⚠️ Rilevata azione pendente interrotta: ${savedState.pendingAction.type}`);

        agentState.completedActions.push({
            step: agentState.currentStep,
            action: savedState.pendingAction,
            result: {
                success: true,
                note: "Azione completata (ha causato navigazione/reload). Successo assunto."
            },
            timestamp: savedState.savedAt
        });

        agentState.currentStep++;
        agentState.lastActionResult = { success: true };
    }

    AgentLogger.log('PERSIST', `🔄 Stato ripristinato: "${agentState.goal}" (step ${agentState.currentStep})`);
}

/**
 * Imposta un'azione come pendente (prima dell'esecuzione)
 * @param {Object} action - Azione che sta per essere eseguita
 */
function setPendingAction(action) {
    agentState.pendingAction = action;
    persistState();
    AgentLogger.log('ACTION', `⏳ Azione pendente impostata: ${action.type}`);
}

/**
 * Inizializza l'agente per un nuovo task
 * @param {string} goal - Obiettivo dell'utente
 */
function initAgent(goal) {
    agentState.isRunning = true;
    agentState.goal = goal;
    agentState.currentStep = 0;
    agentState.completedActions = [];
    agentState.lastDOM = null;
    agentState.lastActionResult = null;
    agentState.attempts = 0;
    agentState.startTime = Date.now();
    agentState.errors = [];
    agentState.isPersisted = false;
    agentState.pendingAction = null;

    AgentLogger.reset();
    AgentLogger.log('INIT', `🚀 Agente inizializzato per goal: "${goal}"`);
    AgentLogger.log('INIT', `⚡ Limiti: max ${agentState.maxTotalSteps} step, timeout ${agentState.maxDuration / 1000}s`);

    // Salva stato iniziale
    persistState();
}

/**
 * Registra un'azione completata
 * @param {Object} action - Azione eseguita
 * @param {Object} result - Risultato dell'azione
 */
function recordAction(action, result) {
    // Rimuovi pending action poiché abbiamo finito
    agentState.pendingAction = null;

    agentState.completedActions.push({
        step: agentState.currentStep,
        action: action,
        result: result,
        timestamp: Date.now()
    });

    agentState.lastActionResult = result;
    agentState.currentStep++;
    agentState.attempts = 0; // Reset tentativi dopo successo

    AgentLogger.log('ACTION', `✅ Step ${agentState.currentStep}/${agentState.maxTotalSteps}: ${action.type}`, {
        target: action.buttonIndex ?? action.searchText ?? 'N/A',
        success: result?.success
    });

    // Salva stato dopo ogni azione
    persistState();
}

/**
 * Registra un errore
 * @param {string} error - Messaggio di errore
 */
function recordError(error) {
    agentState.pendingAction = null; // Rimuovi pending action

    agentState.errors.push({
        step: agentState.currentStep,
        error: error,
        timestamp: Date.now()
    });
    agentState.attempts++;

    AgentLogger.log('ERROR', `❌ Tentativo ${agentState.attempts}/${agentState.maxAttempts}: ${error}`);

    // Salva stato anche in caso di errore
    persistState();
}

/**
 * Aggiorna lo snapshot DOM
 * @param {Object} domData - Dati DOM raccolti
 */
function updateAgentDOM(domData) {
    agentState.lastDOM = domData;
    AgentLogger.log('DOM', `📄 DOM aggiornato: ${domData.buttons?.length || 0} bottoni trovati`);
}

/**
 * Verifica se l'agente può continuare
 * @returns {Object} { canContinue: boolean, reason: string }
 */
function shouldContinue() {
    // Controllo running
    if (!agentState.isRunning) {
        AgentLogger.log('CHECK', '🛑 Agent non running');
        return { canContinue: false, reason: "Agent stopped" };
    }

    // Circuit breaker: max step totali
    if (agentState.currentStep >= agentState.maxTotalSteps) {
        AgentLogger.log('CHECK', `🚫 Max step raggiunto: ${agentState.currentStep}/${agentState.maxTotalSteps}`);
        AgentLogger.summary();
        return {
            canContinue: false,
            reason: `Raggiunto limite massimo di ${agentState.maxTotalSteps} step`
        };
    }

    // Circuit breaker: timeout globale
    const elapsed = Date.now() - agentState.startTime;
    if (elapsed > agentState.maxDuration) {
        AgentLogger.log('CHECK', `⏰ Timeout: ${Math.round(elapsed / 1000)}s > ${agentState.maxDuration / 1000}s`);
        AgentLogger.summary();
        return {
            canContinue: false,
            reason: `Timeout: superati ${agentState.maxDuration / 1000} secondi`
        };
    }

    // Circuit breaker: troppi tentativi per la stessa azione
    if (agentState.attempts >= agentState.maxAttempts) {
        AgentLogger.log('CHECK', `🔄 Troppi retry: ${agentState.attempts}/${agentState.maxAttempts}`);
        AgentLogger.summary();
        return {
            canContinue: false,
            reason: `Troppi tentativi falliti (${agentState.maxAttempts})`
        };
    }

    AgentLogger.log('CHECK', `✅ Può continuare (step ${agentState.currentStep + 1}/${agentState.maxTotalSteps})`);
    return { canContinue: true, reason: "" };
}

/**
 * Genera il contesto per l'LLM
 * Include storia azioni, ultimo DOM, goal
 * @returns {Object} Contesto formattato
 */
function getAgentContext() {
    return {
        goal: agentState.goal,
        currentStep: agentState.currentStep,
        completedActions: agentState.completedActions.map(a => ({
            step: a.step,
            type: a.action.type,
            target: a.action.buttonIndex ?? a.action.searchText ?? null,
            reasoning: a.action.reasoning,
            success: a.result?.success ?? true,
            note: a.result?.note // Aggiunge note (es. navigazione interrotta)
        })),
        lastActionResult: agentState.lastActionResult,
        attempts: agentState.attempts,
        elapsedTime: Date.now() - agentState.startTime,
        isResumed: agentState.isPersisted  // Indica all'LLM che stiamo riprendendo
    };
}

/**
 * Ferma l'agente
 */
function stopAgent() {
    agentState.isRunning = false;
    AgentLogger.log('SYSTEM', '🛑 Agente fermato manualmente');
    AgentLogger.summary();
    clearPersistedState();
}

/**
 * Reset completo dell'agente
 */
function resetAgent() {
    AgentLogger.summary();

    agentState.isRunning = false;
    agentState.goal = "";
    agentState.currentStep = 0;
    agentState.completedActions = [];
    agentState.lastDOM = null;
    agentState.lastActionResult = null;
    agentState.attempts = 0;
    agentState.startTime = null;
    agentState.errors = [];
    agentState.isPersisted = false;
    agentState.pendingAction = null;

    AgentLogger.log('SYSTEM', '🔄 Agente resettato');
    clearPersistedState();
}

/**
 * Ritorna lo stato corrente (per debug)
 * @returns {Object} Stato agente
 */
function getAgentState() {
    return { ...agentState };
}

/**
 * Verifica se l'agente è in esecuzione
 * @returns {boolean}
 */
function isAgentRunning() {
    return agentState.isRunning;
}

/**
 * Ritorna il delay minimo tra chiamate API
 * @returns {number}
 */
function getMinApiDelay() {
    return agentState.minDelayBetweenCalls;
}

/**
 * Verifica se c'è un task pendente da riprendere
 * @returns {Promise<boolean>}
 */
async function hasPendingTask() {
    const savedState = await loadPersistedState();
    return savedState !== null;
}

/**
 * Riprende un task pendente
 * @returns {Promise<string|null>} Goal del task o null
 */
async function resumePendingTask() {
    const savedState = await loadPersistedState();
    if (!savedState) return null;

    restoreState(savedState);
    return savedState.goal;
}
