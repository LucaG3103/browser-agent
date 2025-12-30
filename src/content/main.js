// Main Content Script - Entry Point
// Coordina l'inizializzazione di tutti i moduli
// Supporta auto-resume di task cross-page

(function () {
    if (window.__scanner_injected) return;
    window.__scanner_injected = true;

    console.log('🔍 Estensione attiva');

    /**
     * Inizializzazione - Avvia tutti i moduli quando il DOM è pronto
     */
    async function initialize() {
        console.log('🚀 Inizializzo estensione...');

        // Crea UI della chat
        createChatButton();
        createChatWindow();

        console.log('✅ Estensione pronta. Usa la chat per interagire.');

        // Controlla se c'è un task pendente da riprendere
        await checkPendingTask();
    }

    /**
     * Controlla se c'è un task da riprendere dopo navigazione
     */
    async function checkPendingTask() {
        try {
            const hasPending = await hasPendingTask();

            if (hasPending) {
                console.log('📂 Trovato task pendente, ripristino...');

                // Riprendi il task
                const goal = await resumePendingTask();

                if (goal) {
                    // Apri la chat automaticamente
                    toggleChat();

                    // Mostra messaggio di ripresa
                    addMessage(`🔄 Riprendo task: "${goal}"`, 'bot');
                    addMessage(`📍 Pagina cambiata. Continuo da step ${getAgentState().currentStep + 1}...`, 'bot');

                    // Attendi che la pagina si stabilizzi (smart wait)
                    await waitForDOMStabilization(1000, 10000, 500);

                    // Riprendi il loop agentico
                    resumeAgenticLoop(goal);
                }
            }
        } catch (error) {
            console.error('❌ Errore controllo task pendente:', error);
        }
    }

    // Avvia l'inizializzazione quando il DOM è completamente caricato
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialize, 100); // Piccolo delay per assicurare che tutto sia renderizzato
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
    }

})();
