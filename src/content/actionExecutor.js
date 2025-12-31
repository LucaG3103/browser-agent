// Action Executor Module
// Esegue singole azioni pianificate dall'LLM
// Refactored: Semplificato per eseguire UNA azione alla volta

/**
 * Esegue un'azione di click su un bottone specifico
 * @param {Object} action - Azione da eseguire
 * @param {Array} buttons - Array dei bottoni disponibili
 * @returns {Promise<Object>} Risultato dell'azione
 */
async function executeClickAction(action, buttons) {
    // Se non abbiamo bottoni, scansiona
    if (!buttons || buttons.length === 0) {
        buttons = scanButtons();
    }

    const index = action.buttonIndex;

    if (index < 0 || index >= buttons.length) {
        return {
            success: false,
            error: `Bottone index ${index} non valido (disponibili: ${buttons.length})`
        };
    }

    const button = buttons[index];
    console.log(`🎯 Click su bottone [${index}]: "${button.text}"`);

    try {
        // Evidenzia e clicca
        highlightButton(index, buttons, true);

        // Attendi che il click venga eseguito
        await sleepAction(650);

        return { success: true, clicked: button.text };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Esegue un'azione di hover su un bottone specifico
 * @param {Object} action - Azione da eseguire
 * @param {Array} buttons - Array dei bottoni disponibili
 * @returns {Promise<Object>} Risultato dell'azione
 */
async function executeHoverAction(action, buttons) {
    // Se non abbiamo bottoni, scansiona
    if (!buttons || buttons.length === 0) {
        buttons = scanButtons();
    }

    const index = action.buttonIndex;

    if (index < 0 || index >= buttons.length) {
        return {
            success: false,
            error: `Bottone index ${index} non valido (disponibili: ${buttons.length})`
        };
    }

    const button = buttons[index];
    console.log(`🖱️ Hover su bottone [${index}]: "${button.text}"`);

    try {
        // Evidenzia e simula hover (senza click)
        highlightButton(index, buttons, false);

        // Attendi che l'hover abbia effetto (menu si aprano)
        await sleepAction(1000);

        return { success: true, hovered: button.text };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Esegue un'azione di forzatura apertura menu
 * @param {Object} action - Azione da eseguire
 * @param {Array} buttons - Array dei bottoni disponibili
 * @returns {Promise<Object>} Risultato dell'azione
 */
async function executeForceOpenAction(action, buttons) {
    // Se non abbiamo bottoni, scansiona
    if (!buttons || buttons.length === 0) {
        buttons = scanButtons();
    }

    const index = action.buttonIndex;

    if (index < 0 || index >= buttons.length) {
        return {
            success: false,
            error: `Bottone index ${index} non valido (disponibili: ${buttons.length})`
        };
    }

    const button = buttons[index];
    console.log(`💪 Force Open su bottone [${index}]: "${button.text}"`);

    try {
        // Esegui forzatura
        forceElementShow(index, buttons);

        // Attendi per permettere al DOM di aggiornarsi
        await sleepAction(500);

        return { success: true, forced: button.text };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Cerca un bottone per testo e ci clicca
 * @param {Object} action - Azione da eseguire
 * @param {Array} buttons - Array dei bottoni disponibili
 * @returns {Promise<Object>} Risultato dell'azione
 */
async function executeClickByTextAction(action, buttons) {
    // Se non abbiamo bottoni, scansiona
    if (!buttons || buttons.length === 0) {
        buttons = scanButtons();
    }

    const searchText = action.searchText.toLowerCase();
    console.log(`🔍 Cerco bottone con testo: "${searchText}"`);

    // Cerca bottone che contiene il testo
    let matchingButton = buttons.find(btn =>
        btn.text.toLowerCase().includes(searchText)
    );

    // Fallback: ri-scansiona e riprova
    if (!matchingButton) {
        console.log('⚠️ Non trovato nella cache, scansiono di nuovo...');
        buttons = scanButtons();

        matchingButton = buttons.find(btn =>
            btn.text.toLowerCase().includes(searchText)
        );
    }

    // Prova ricerca più flessibile (tutte le parole devono essere presenti)
    if (!matchingButton) {
        const flexibleMatch = buttons.find(btn => {
            const btnText = btn.text.toLowerCase();
            const words = searchText.split(' ');
            return words.every(word => btnText.includes(word));
        });

        if (flexibleMatch) {
            matchingButton = flexibleMatch;
            console.log(`✅ Trovato match flessibile: "${matchingButton.text}"`);
        }
    }

    if (!matchingButton) {
        return {
            success: false,
            error: `Bottone con testo "${action.searchText}" non trovato`
        };
    }

    console.log(`✅ Trovato: "${matchingButton.text}" [${matchingButton.index}]`);

    try {
        highlightButton(matchingButton.index, buttons, true);
        await sleepAction(650);

        return { success: true, clicked: matchingButton.text };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Esegue un'azione di scrittura (type) su un input
 * @param {Object} action - Azione da eseguire
 * @param {Array} buttons - Array dei bottoni disponibili
 * @returns {Promise<Object>} Risultato dell'azione
 */
async function executeTypeAction(action, buttons) {
    // Se non abbiamo bottoni, scansiona
    if (!buttons || buttons.length === 0) {
        buttons = scanButtons();
    }

    const index = action.buttonIndex;

    if (index < 0 || index >= buttons.length) {
        return {
            success: false,
            error: `Elemento index ${index} non valido (disponibili: ${buttons.length})`
        };
    }

    const button = buttons[index];
    console.log(`⌨️ Type su elemento [${index}]: "${action.text}"`);

    try {
        // Evidenzia elemento
        highlightButton(index, buttons, false); // false = non cliccare, solo focus

        // Passiamo direttamente l'elemento DOM
        await typeOnElement(button.element, action.text, true);

        return { success: true, typed: action.text };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


/**
 * Esegue UNA singola azione in base al tipo
 * @param {Object} action - L'azione da eseguire
 * @param {Array} buttons - Lista di tutti i bottoni/elementi interattivi
 * @returns {Promise<Object>} Risultato { success, ... }
 */
async function executeSingleAction(action, buttons) {
    console.log('🎬 Esecuzione azione singola:', action.type);

    try {
        switch (action.type) {
            case 'click':
                return await executeClickAction(action, buttons);

            case 'hover':
                return await executeHoverAction(action, buttons);

            case 'forceOpen':
                return await executeForceOpenAction(action, buttons);

            case 'clickByText':
                return await executeClickByTextAction(action, buttons);

            case 'type': // NUOVA AZIONE
                return await executeTypeAction(action, buttons);

            case 'wait':
                const duration = action.duration || 2000;
                console.log(`⏳ Attesa esplicita di ${duration}ms`);
                await sleepAction(duration);
                return { success: true, waited: duration };

            case 'error':
                return { success: false, error: action.reasoning };

            default:
                return { success: false, error: `Tipo azione sconosciuto: ${action.type}` };
        }
    } catch (error) {
        console.error('❌ Errore esecuzione azione:', error);
        return { success: false, error: error.message };
    }
}

function sleepAction(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attende che il DOM si stabilizzi (smetta di cambiare)
 * Ottimizzato per pagine dinamiche (SPA, caricamenti asincroni)
 * @param {number} minWaitTime - Tempo minimo di attesa (ms)
 * @param {number} maxWaitTime - Tempo massimo di attesa (ms)
 * @param {number} debounceTime - Tempo di stabilità richiesto (ms)
 */
function waitForDOMStabilization(minWaitTime = 500, maxWaitTime = 10000, debounceTime = 500) {
    return new Promise(resolve => {
        const startTime = Date.now();
        let timer;
        let observer;

        // Funzione per ripulire e risolvere
        const finish = () => {
            if (observer) observer.disconnect();
            if (timer) clearTimeout(timer);
            resolve();
        };

        // Se passiamo 0 come maxTime, esce subito (ma rispetta minTime)
        if (maxWaitTime <= 0) {
            setTimeout(resolve, minWaitTime);
            return;
        }

        // Observer per rilevare mutazioni
        observer = new MutationObserver(() => {
            // Se c'è una mutazione, resetta il timer di stabilità
            if (timer) clearTimeout(timer);

            // Imposta nuovo timer: se non succede nulla per 'debounceTime', consideriamo stabile
            timer = setTimeout(() => {
                // Ma dobbiamo aver aspettato almeno minWaitTime
                if (Date.now() - startTime >= minWaitTime) {
                    console.log(`✅ DOM stabile dopo ${Date.now() - startTime}ms`);
                    finish();
                }
            }, debounceTime);
        });

        // Configurazione observer (monitora tutto il body)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled', 'value']
        });

        // Timer iniziale (se il DOM è già fermo)
        timer = setTimeout(() => {
            if (Date.now() - startTime >= minWaitTime) {
                console.log('✅ DOM stabile (nessuna mutazione iniziale)');
                finish();
            }
        }, Math.max(minWaitTime, debounceTime));

        // Timeout di sicurezza (force quit)
        setTimeout(() => {
            if (Date.now() - startTime < maxWaitTime) return; // Se già finito, ignora
            console.log(`⚠️ Timeout DOM stabilization (${maxWaitTime}ms)`);
            finish();
        }, maxWaitTime);
    });
}
