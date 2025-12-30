// DOM Collector Module
// Raccoglie e serializza il DOM della pagina per invio all'LLM

// Limite massimo di bottoni da inviare all'LLM
const MAX_BUTTONS_FOR_LLM = 100;

/**
 * Raccoglie informazioni sul DOM della pagina corrente
 * @returns {Object} Oggetto con informazioni sulla pagina e sui bottoni
 */
function collectDOMData() {
    // Scansiona i bottoni usando la funzione esistente
    const allButtons = scanButtons();

    // Filtra e limita i bottoni per l'LLM
    // Priorità: bottoni con testo significativo, menu, link navigazione
    const filteredButtons = filterRelevantButtons(allButtons);

    // Serializza i bottoni per l'LLM (senza riferimenti agli elementi)
    const serializedButtons = filteredButtons.map(btn => ({
        index: btn.index,
        text: btn.text,
        id: btn.id,
        className: btn.className,
        tagName: btn.tagName,
        element: btn.element // Mantieni riferimento per azioni successive
    }));

    // Raccogli contesto della pagina
    const pageContext = {
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || ''
    };

    console.log(`📊 DOM Data: ${allButtons.length} totali → ${serializedButtons.length} filtrati per LLM`);

    return {
        pageContext,
        buttons: serializedButtons,
        allButtons: allButtons, // Mantieni tutti per le azioni
        timestamp: new Date().toISOString()
    };
}

/**
 * Filtra i bottoni più rilevanti per l'LLM
 * @param {Array} buttons - Tutti i bottoni trovati
 * @returns {Array} Bottoni filtrati e ordinati per rilevanza
 */
function filterRelevantButtons(buttons) {
    // Parole chiave prioritarie (navigazione, account, lingua, carrello, ecc.)
    const priorityKeywords = [
        'carrello', 'cart', 'login', 'accedi', 'account', 'profilo',
        'lingua', 'language', 'english', 'italiano', 'menu', 'categoria',
        'cerca', 'search', 'home', 'ordini', 'orders', 'wishlist', 'lista',
        'impostazioni', 'settings', 'preferenze', 'paese', 'country',
        'iscriviti', 'registra', 'sign', 'indirizzo', 'spedizione'
    ];

    // Parole chiave da escludere (pubblicità, tracciamento)
    const excludeKeywords = [
        'sponsored', 'pubblicità', 'cookie', 'privacy', 'track',
        'analytics', 'advertisement'
    ];

    // Classifica i bottoni
    const scored = buttons.map(btn => {
        let score = 0;
        const text = (btn.text || '').toLowerCase();
        const id = (btn.id || '').toLowerCase();
        const className = (btn.className || '').toLowerCase();

        // Escludi bottoni senza testo significativo
        if (!text || text.length < 2) {
            score -= 10;
        }

        // Escludi testi troppo lunghi (probabilmente contenuto, non pulsanti)
        if (text.length > 100) {
            score -= 5;
        }

        // Priorità per parole chiave
        for (const kw of priorityKeywords) {
            if (text.includes(kw) || id.includes(kw) || className.includes(kw)) {
                score += 10;
                break;
            }
        }

        // Penalizza parole chiave da escludere
        for (const kw of excludeKeywords) {
            if (text.includes(kw) || id.includes(kw) || className.includes(kw)) {
                score -= 20;
                break;
            }
        }

        // Priorità per tag navigazione
        if (['A', 'BUTTON', 'INPUT'].includes(btn.tagName)) {
            score += 3;
        }

        // Priorità per bottoni con ID (solitamente più importanti)
        if (btn.id) {
            score += 2;
        }

        // Priorità per elementi nel header/nav (primi 200 elementi di solito)
        if (btn.index < 200) {
            score += 1;
        }

        return { ...btn, score };
    });

    // Ordina per score e prendi i migliori
    scored.sort((a, b) => b.score - a.score);

    // Prendi i migliori, ma mantieni l'ordine originale per l'indice
    const topButtons = scored
        .slice(0, MAX_BUTTONS_FOR_LLM)
        .sort((a, b) => a.index - b.index);

    return topButtons;
}

/**
 * Trova un bottone per indice (cerca in tutti i bottoni, non solo filtrati)
 * @param {number} index - Indice del bottone
 * @param {Array} allButtons - Tutti i bottoni
 * @returns {Object|null} Bottone trovato o null
 */
function findButtonByIndex(index, allButtons) {
    return allButtons.find(btn => btn.index === index) || null;
}
