// Chat Messages Module
// Gestisce i messaggi e l'input della chat
// Refactored: Agentic Loop pattern

// Array per salvare la cronologia dei messaggi
let chatMessages = [];

/**
 * Aggiunge un messaggio alla chat
 * @param {string} text - Il testo del messaggio
 * @param {string} sender - 'user' o 'bot'
 */
function addMessage(text, sender = 'user') {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin-bottom: 12px;
        display: flex;
        justify-content: ${sender === 'user' ? 'flex-end' : 'flex-start'};
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
        max-width: 70%;
        padding: 10px 15px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.4;
        ${sender === 'user'
            ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;'
            : 'background: white; color: #333; border: 1px solid #e0e0e0;'
        }
    `;
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    chatMessages.push({ text, sender, timestamp: new Date() });

    return messageDiv;
}

/**
 * Rimuove un messaggio dalla chat
 * @param {HTMLElement} messageElement - Elemento del messaggio da rimuovere
 */
function removeMessage(messageElement) {
    if (messageElement && messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
    }
}

/**
 * Invia un messaggio
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Previeni invio durante esecuzione
    if (isAgentRunning()) {
        addMessage('⏳ Attendere, sto ancora elaborando...', 'bot');
        return;
    }

    // Aggiungi messaggio utente
    addMessage(text, 'user');
    input.value = '';

    // Gestione comando di debug
    if (text.startsWith('/debug')) {
        const query = text.replace('/debug', '').trim().toLowerCase();

        const domData = collectDOMData();
        const buttons = domData.buttons;

        let msg = `📊 **Debug Scan**\nTotale bottoni: ${buttons.length}\n\n`;

        let filtered = buttons;
        if (query) {
            filtered = buttons.filter(b => b.text.toLowerCase().includes(query));
            msg += `Filtrati per "${query}": ${filtered.length}\n\n`;
        }

        // Mostra i primi 20 risultati
        filtered.slice(0, 20).forEach(b => {
            msg += `[${b.index}] ${b.tagName} "${b.text}"\n`;
        });

        if (filtered.length > 20) msg += `...e altri ${filtered.length - 20}`;

        addMessage(msg, 'bot');
        return;
    }

    // Verifica se API key è configurata
    const hasAPIKey = await isAPIKeyConfigured();
    if (!hasAPIKey) {
        addMessage('⚠️ API key non configurata. Clicca sull\'icona ⚙️ per configurarla.', 'bot');
        return;
    }

    // Reset dei bottoni già cliccati per permettere nuovi click
    if (typeof resetClickedButtons === 'function') {
        resetClickedButtons();
    }

    // Avvia il loop agentico
    await runAgenticLoop(text);
}

/**
 * Loop principale dell'agente
 * Esegue UNA AZIONE alla volta fino al completamento
 * @param {string} goal - Obiettivo dell'utente
 */
async function runAgenticLoop(goal) {
    // Inizializza l'agente
    initAgent(goal);

    addMessage('🚀 Avvio analisi...', 'bot');

    let lastApiCallTime = 0;

    while (true) {
        // Verifica se possiamo continuare
        const check = shouldContinue();
        if (!check.canContinue) {
            addMessage(`⚠️ ${check.reason}`, 'bot');
            break;
        }

        try {
            // 1. Raccogli DOM attuale
            const domData = collectDOMData();
            updateAgentDOM(domData);

            if (domData.buttons.length === 0) {
                addMessage('Non ho trovato elementi interattivi in questa pagina.', 'bot');
                break;
            }

            // 2. Ottieni contesto agente
            const context = getAgentContext();

            // 3. Rate limiting: attendi se necessario prima della chiamata API
            const minDelay = getMinApiDelay();
            const timeSinceLastCall = Date.now() - lastApiCallTime;
            if (timeSinceLastCall < minDelay && lastApiCallTime > 0) {
                const waitTime = minDelay - timeSinceLastCall;
                AgentLogger.log('RATE', `⏳ Attendo ${waitTime}ms prima della prossima chiamata API`);
                await sleep(waitTime);
            }

            // 4. Chiedi all'LLM la prossima azione
            AgentLogger.log('API', `📡 Chiamata API per step ${context.currentStep + 1}`);
            AgentLogger.apiCall();
            lastApiCallTime = Date.now();

            const decision = await callOpenAI(goal, domData, context);

            // 5. Se obiettivo completato, esci
            if (decision.isComplete) {
                // IMPORTANTE: Cancella stato persistente SUBITO per evitare loop
                await clearPersistedState();
                agentState.isRunning = false;

                if (decision.action?.type === 'error') {
                    addMessage(`❌ ${decision.action.reasoning}`, 'bot');
                } else {
                    addMessage('✅ Obiettivo raggiunto!', 'bot');
                }
                break;
            }

            // 6. Mostra il pensiero dell'agente
            if (decision.thought) {
                AgentLogger.log('LLM', `💭 ${decision.thought}`);
            }

            // 7. Mostra azione all'utente
            addMessage(`💡 ${decision.action.reasoning}`, 'bot');

            // 8. Esegui SINGOLA azione (usa allButtons per avere tutti gli elementi)
            setPendingAction(decision.action); // Registra come pendente prima di eseguire

            // DEBUG TARGET: Mostriamo all'utente su COSA stiamo agendo
            const targetPool = domData.buttons;
            const targetIdx = decision.action.buttonIndex;
            if (targetPool && targetPool[targetIdx]) {
                const t = targetPool[targetIdx];
                const cleanText = t.text ? t.text.substring(0, 15).replace(/\n/g, ' ') : '';
                const debugMsg = `🎯 Target [${targetIdx}]: <${t.tagName}> ${cleanText ? '"' + cleanText + '"' : ''} ${t.id ? '#' + t.id : ''}`;
                addMessage(debugMsg, 'bot');
            }

            const result = await executeSingleAction(decision.action, domData.allButtons || domData.buttons);

            // 9. Registra risultato
            recordAction(decision.action, result);

            if (!result.success) {
                recordError(result.error || 'Azione fallita');
                addMessage(`⚠️ Riprovo...`, 'bot');
            }

            // 10. Attendi che il DOM si stabilizzi
            await waitForDOMStabilization(500, 3000, 300);

        } catch (error) {
            console.error('❌ Errore nel loop:', error);
            recordError(error.message);

            // Gestisci errori specifici
            if (error.message === 'API_KEY_MISSING') {
                addMessage('⚠️ API key non configurata.', 'bot');
                break;
            } else if (error.message === 'API_KEY_INVALID') {
                addMessage('❌ API key non valida.', 'bot');
                break;
            } else if (error.message === 'RATE_LIMIT') {
                addMessage('⚠️ Limite richieste. Attendo...', 'bot');
                await sleep(5000); // Attendi 5 secondi
            } else if (error.message === 'NETWORK_ERROR') {
                addMessage('❌ Errore di connessione.', 'bot');
                break;
            } else {
                addMessage(`⚠️ Errore: ${error.message}`, 'bot');
            }
        }
    }

    // Cleanup
    resetAgent();
    console.log('🏁 Loop agentico terminato');
}

/**
 * Riprende un loop agentico dopo navigazione di pagina
 * NON reinizializza lo stato, usa quello persistente
 * @param {string} goal - Obiettivo dell'utente (già ripristinato)
 */
async function resumeAgenticLoop(goal) {
    AgentLogger.log('RESUME', `🔄 Riprendo task: "${goal}"`);

    let lastApiCallTime = 0;

    while (true) {
        // Verifica se possiamo continuare
        const check = shouldContinue();
        if (!check.canContinue) {
            addMessage(`⚠️ ${check.reason}`, 'bot');
            break;
        }

        try {
            // 1. Raccogli DOM attuale (nuova pagina)
            const domData = collectDOMData();
            updateAgentDOM(domData);

            if (domData.buttons.length === 0) {
                addMessage('Non ho trovato elementi interattivi in questa pagina.', 'bot');
                break;
            }

            // 2. Ottieni contesto agente (include storia azioni precedenti)
            const context = getAgentContext();

            // 3. Rate limiting
            const minDelay = getMinApiDelay();
            const timeSinceLastCall = Date.now() - lastApiCallTime;
            if (timeSinceLastCall < minDelay && lastApiCallTime > 0) {
                const waitTime = minDelay - timeSinceLastCall;
                AgentLogger.log('RATE', `⏳ Attendo ${waitTime}ms`);
                await sleep(waitTime);
            }

            // 4. Chiedi all'LLM la prossima azione
            AgentLogger.log('API', `📡 Chiamata API (resumed) step ${context.currentStep + 1}`);
            AgentLogger.apiCall();
            lastApiCallTime = Date.now();

            const decision = await callOpenAI(goal, domData, context);

            // 5. Se obiettivo completato, esci
            if (decision.isComplete) {
                // IMPORTANTE: Cancella stato persistente SUBITO per evitare loop
                await clearPersistedState();
                agentState.isRunning = false;

                if (decision.action?.type === 'error') {
                    addMessage(`❌ ${decision.action.reasoning}`, 'bot');
                } else {
                    addMessage('✅ Obiettivo raggiunto!', 'bot');
                }
                break;
            }

            // 6. Mostra il pensiero dell'agente
            if (decision.thought) {
                AgentLogger.log('LLM', `💭 ${decision.thought}`);
            }

            // 7. Mostra azione all'utente
            addMessage(`💡 ${decision.action.reasoning}`, 'bot');

            // 8. Esegui SINGOLA azione
            setPendingAction(decision.action); // Registra come pendente prima di eseguire

            // DEBUG TARGET (Resume)
            const targetPool = domData.buttons;
            const targetIdx = decision.action.buttonIndex;
            if (targetPool && targetPool[targetIdx]) {
                const t = targetPool[targetIdx];
                const cleanText = t.text ? t.text.substring(0, 15).replace(/\n/g, ' ') : '';
                const debugMsg = `🎯 Target [${targetIdx}]: <${t.tagName}> ${cleanText ? '"' + cleanText + '"' : ''} ${t.id ? '#' + t.id : ''}`;
                addMessage(debugMsg, 'bot');
            }

            const result = await executeSingleAction(decision.action, domData.allButtons || domData.buttons);

            // 9. Registra risultato (questo salva anche lo stato)
            recordAction(decision.action, result);

            if (!result.success) {
                recordError(result.error || 'Azione fallita');
                addMessage(`⚠️ Riprovo...`, 'bot');
            }

            // 10. Attendi che il DOM si stabilizzi
            await waitForDOMStabilization(500, 3000, 300);

        } catch (error) {
            console.error('❌ Errore nel loop resumed:', error);
            recordError(error.message);

            if (error.message === 'API_KEY_MISSING' ||
                error.message === 'API_KEY_INVALID' ||
                error.message === 'NETWORK_ERROR') {
                addMessage(`❌ ${error.message}`, 'bot');
                break;
            } else if (error.message === 'RATE_LIMIT') {
                addMessage('⚠️ Limite richieste. Attendo...', 'bot');
                await sleep(5000);
            } else {
                addMessage(`⚠️ Errore: ${error.message}`, 'bot');
            }
        }
    }

    // Cleanup
    resetAgent();
    console.log('🏁 Loop agentico resumed terminato');
}

// Funzione executeSingleAction rimossa per evitare duplicati con actionExecutor.js.
// Ripristino sleep() necessaria per questo modulo.

/**
 * Utility per sleep
 * @param {number} ms - Millisecondi da attendere
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
