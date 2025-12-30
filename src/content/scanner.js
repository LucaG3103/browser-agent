// Button Scanner Module
// Scansiona e evidenzia bottoni nella pagina

// Stato scanner
let currentHighlightedElement = null;
let originalOutline = '';
let clickedButtons = new Set(); // Traccia bottoni già cliccati
let pendingClickTimeout = null; // Timeout pendente per il click

// ... (scanButtons remains the same) ...

/**
 * Verifica se un elemento è completamente visibile nel viewport
 * @param {HTMLElement} el - Elemento da controllare
 * @returns {boolean} True se visibile
 */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Evidenzia un singolo bottone
 * @param {number} index - Index del bottone da evidenziare
 * @param {Array} buttons - Array dei bottoni
 * @param {boolean} shouldClick - Se true, esegue il click alla fine
 */
function highlightButton(index, buttons, shouldClick = true) {
    // Cancella timeout pendente precedente
    if (pendingClickTimeout) {
        clearTimeout(pendingClickTimeout);
        pendingClickTimeout = null;
    }

    // Rimuovi evidenziazione precedente (ripristina outline)
    if (currentHighlightedElement) {
        try {
            currentHighlightedElement.style.outline = originalOutline;
            currentHighlightedElement.style.boxShadow = ''; // Ripristina anche box-shadow
        } catch (e) {
            // Elemento potrebbe essere stato rimosso dal DOM
        }
        currentHighlightedElement = null;
    }

    if (index < 0 || index >= buttons.length) {
        console.error(`❌ Index ${index} non valido (bottoni disponibili: ${buttons.length})`);
        return;
    }

    const button = buttons[index];
    const element = button?.element;

    // Verifica che l'elemento esista
    if (!element) {
        console.error(`❌ Elemento per index ${index} non trovato (button.element è undefined)`);
        return;
    }

    // Controlla se questo bottone è già stato cliccato (solo se dobbiamo cliccare)
    const elementId = generateElementId(element);
    if (shouldClick && clickedButtons.has(elementId)) {
        console.log(`⚠️ Bottone [${index}] già cliccato, salto il click automatico`);
        return;
    }

    console.log(`🎯 Evidenzio bottone [${index}]: "${button.text}" (Click: ${shouldClick})`);

    // Smart Scroll: scrolla solo se non è visibile
    if (!isElementInViewport(element)) {
        console.log('📜 Elemento fuori viewport, scrollo...');
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
    } else {
        console.log('👀 Elemento già visibile, salto scroll');
    }

    // Salva stato precedente e applica evidenziazione diretta
    currentHighlightedElement = element;
    originalOutline = element.style.outline;

    element.style.outline = '3px solid #00ff00';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
    element.style.transition = 'outline 0.2s, box-shadow 0.2s';

    // Interazione automatica con simulazione eventi COMPLETA dopo 300ms (ridotto da 500ms)
    pendingClickTimeout = setTimeout(() => {
        console.log(`🖱️ Interazione con bottone [${index}]: "${button.text}"`);

        // Ricalcola rect per coordinate precise
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;

        // Marca come cliccato se necessario
        if (shouldClick) {
            clickedButtons.add(elementId);
        }

        // Helper per dispatchare eventi Mouse e Pointer
        const dispatchDualEvent = (type, options = {}) => {
            const defaultOptions = {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX, clientY,
                pointerId: 1,
                width: 1,
                height: 1,
                pressure: 0.5,
                isPrimary: true
            };
            const mergedOptions = { ...defaultOptions, ...options };

            // 1. Mouse Event
            const mouseEvent = new MouseEvent(type, mergedOptions);
            element.dispatchEvent(mouseEvent);

            // 2. Pointer Event (per framework moderni)
            // Mappa 'mousemove' -> 'pointermove', etc.
            const pointerType = type.replace('mouse', 'pointer');
            if (pointerType !== type) {
                try {
                    const pointerEvent = new PointerEvent(pointerType, { ...mergedOptions, pointerType: 'mouse' });
                    element.dispatchEvent(pointerEvent);
                } catch (e) {
                    // Fallback per browser vecchi (non dovrebbe servire su moderni)
                }
            }
        };

        // --- SEQUENZA EVENTI ---

        // 1. Hover sul parent (importante per menu a cascata)
        const parent = element.parentElement;
        if (parent) {
            parent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
            parent.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, view: window }));
        }

        // 2. Avvicinamento
        dispatchDualEvent('mousemove');
        dispatchDualEvent('mouseenter');
        dispatchDualEvent('mouseover');
        dispatchDualEvent('mousemove'); // Secondo movimento interno

        // 3. Focus
        if (typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
        }

        // 4. Click (se richiesto)
        if (shouldClick) {
            setTimeout(() => {
                dispatchDualEvent('mousedown');
                dispatchDualEvent('mouseup');
                element.click();
                console.log(`✅ Click eseguito su bottone [${index}]`);
            }, 100);
        } else {
            console.log(`✅ Hover mantenuto su bottone [${index}]`);
        }
    }, 300);
}

/**
 * Forza la visibilità di un elemento e dei suoi menu associati
 * @param {number} index - Index del bottone
 * @param {Array} buttons - Array dei bottoni
 */
function forceElementShow(index, buttons) {
    if (index < 0 || index >= buttons.length) return;

    const button = buttons[index];
    const element = button?.element;

    if (!element) {
        console.error(`❌ Elemento per index ${index} non trovato in forceElementShow`);
        return;
    }

    console.log(`💪 Forzo apertura per: "${button.text}"`);

    // Lista di classi comuni per stati attivi
    const activeClasses = ['open', 'active', 'show', 'visible', 'expanded', 'selected', 'toggled'];

    // Funzione helper per applicare stili forzati
    const forceStyles = (el) => {
        if (!el) return;

        // 1. Classi CSS
        activeClasses.forEach(cls => el.classList.add(cls));

        // 2. Stili inline (solo se nascosto o se necessario)
        const style = window.getComputedStyle(el);
        if (style.display === 'none') el.style.display = 'block';
        if (style.visibility === 'hidden') el.style.visibility = 'visible';
        if (style.opacity === '0') el.style.opacity = '1';

        // 3. Attributi
        el.removeAttribute('hidden');
        if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', 'true');
    };

    // Applica all'elemento stesso
    forceStyles(element);

    // Applica al parent (spesso è il container li/div che ha la classe .open)
    if (element.parentElement) {
        forceStyles(element.parentElement);

        // Applica al parent del parent (per sicurezza)
        if (element.parentElement.parentElement) {
            forceStyles(element.parentElement.parentElement);
        }
    }

    // Cerca menu associati (fratelli o figli del parent)
    // Es: button + div.menu
    let sibling = element.nextElementSibling;
    while (sibling) {
        forceStyles(sibling);
        sibling = sibling.nextElementSibling;
    }

    // Cerca tramite aria-controls
    const controlsId = element.getAttribute('aria-controls');
    if (controlsId) {
        const controlled = document.getElementById(controlsId);
        if (controlled) forceStyles(controlled);
    }
}

/**
 * Scansiona tutti gli elementi interattivi nella pagina
 * @returns {Array} Array di oggetti con informazioni sugli elementi trovati
 */
function scanButtons() {
    // FASE 1: Selettore CSS completo per elementi comuni
    const commonInteractiveSelector = `
        button,
        input[type='button'],
        input[type='submit'],
        input[type='reset'],
        input[type='image'],
        input[type='radio'],
        input[type='checkbox'],
        label,
        a,
        [role='button'],
        [role='link'],
        [role='menuitem'],
        [role='option'],
        [role='tab'],
        [role='checkbox'],
        [role='radio'],
        [role='switch'],
        select,
        textarea,
        [onclick],
        [ng-click],
        [v-on\\:click],
        [x-on\\:click],
        [data-action],
        [data-click],
        div[class*='button'],
        div[class*='btn'],
        span[class*='button'],
        span[class*='btn'],
        div[class*='clickable'],
        span[class*='clickable'],
        div[class*='click'],
        span[class*='click'],
        span[class*='click'],
        [class*='item'],
        [class*='row'],
        li[role='menuitem'],
        li[role='option'],
        ul[class*='menu'] > li,
        ol[class*='menu'] > li,
        [tabindex='0'],
        [tabindex='1'],
        [tabindex='2'],
        [tabindex='3'],
        [tabindex='4'],
        [tabindex='5'],
        .menu > *,
        .dropdown > *,
        .list > *,
        .options > *,
        [class*='menu'] > *,
        [class*='dropdown'] > *,
        [class*='option'] > *,
        [id*='menu'] > *,
        [id*='dropdown'] > *
    `.replace(/\s+/g, ' ').trim();

    const commonElements = Array.from(document.querySelectorAll(commonInteractiveSelector));

    // FASE 2: Trova elementi con cursor: pointer
    const allElements = document.querySelectorAll('*');
    const cursorPointerElements = [];

    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.cursor === 'pointer' && !commonElements.includes(el)) {
            cursorPointerElements.push(el);
        }
    });

    // FASE 3: Combina tutti gli elementi unici
    const allInteractiveElements = new Set([...commonElements, ...cursorPointerElements]);

    console.log(`🔍 Elementi rilevati: ${commonElements.length} da selettore, ${cursorPointerElements.length} con cursor:pointer`);

    const buttons = [];
    const processedElements = new Set(); // Per evitare duplicati

    allInteractiveElements.forEach((el) => {
        // Evita duplicati
        if (processedElements.has(el)) return;
        processedElements.add(el);

        // Salta elementi nascosti o senza dimensioni
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Check visibility più permissivo
        const isVisible = rect.width > 0 && rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0.01; // Gestisce stringhe '0', '0.0', '0.00'

        if (!isVisible) return;

        // Salta elementi troppo grandi (probabilmente container)
        if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.5) {
            return;
        }

        // Determina il testo dell'elemento
        let text = '';

        // Prova diverse fonti per il testo
        if (el.getAttribute('aria-label')) {
            text = el.getAttribute('aria-label');
        } else if (el.getAttribute('title')) {
            text = el.getAttribute('title');
        } else if (el.getAttribute('alt')) {
            text = el.getAttribute('alt');
        } else if (el.getAttribute('placeholder')) {
            text = el.getAttribute('placeholder');
        } else if (el.value) {
            text = el.value;
        } else if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox') && el.id) {
            // Cerca label associata per ID
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) text = label.textContent.trim();
        } else {
            // Usa textContent ma solo il testo diretto, non dei figli
            const clone = el.cloneNode(false);
            clone.textContent = el.childNodes[0]?.textContent || '';
            text = clone.textContent.trim();

            // Se non c'è testo diretto, prendi il primo testo visibile
            if (!text && el.textContent) {
                text = el.textContent.trim();
            }
        }

        // Se ancora non c'è testo, usa informazioni dall'elemento
        if (!text) {
            if (el.id) {
                text = `#${el.id}`;
            } else if (el.className && typeof el.className === 'string') {
                const className = el.className.split(' ')[0];
                text = `.${className}`;
            } else {
                text = el.tagName.toLowerCase();
            }
        }

        // Limita la lunghezza del testo
        if (text.length > 100) {
            text = text.substring(0, 97) + '...';
        }

        // Genera un XPath semplificato
        const xpath = getElementXPath(el);

        // Determina il tipo di elemento
        let elementType = 'unknown';
        if (el.tagName === 'BUTTON') elementType = 'button';
        else if (el.tagName === 'A') elementType = 'link';
        else if (el.tagName === 'INPUT') elementType = 'input';
        else if (el.hasAttribute('onclick')) elementType = 'clickable';
        else if (style.cursor === 'pointer') elementType = 'pointer';
        else if (el.hasAttribute('role')) elementType = el.getAttribute('role');

        // Check stati attivi (checked, selected, active)
        const isActive = el.checked ||
            el.selected ||
            el.getAttribute('aria-checked') === 'true' ||
            el.getAttribute('aria-selected') === 'true' ||
            el.classList.contains('active') ||
            el.classList.contains('selected') ||
            el.classList.contains('checked') ||
            el.classList.contains('on');

        if (isActive) {
            text += ' [ACTIVE]';
            // Aumenta visibilità dello stato nel testo
            if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) {
                text = `(SELEZIONATO) ${text.replace(' [ACTIVE]', '')}`;
            }
        }

        buttons.push({
            index: buttons.length,
            text: text,
            id: el.id || null,
            className: el.className || null,
            tagName: el.tagName,
            xpath: xpath,
            elementType: elementType,
            element: el
        });
    });

    console.log(`📊 Trovati ${buttons.length} elementi interattivi visibili`);
    return buttons;
}

/**
 * Genera un XPath semplificato per un elemento
 * @param {HTMLElement} element - L'elemento per cui generare l'XPath
 * @returns {string} XPath dell'elemento
 */
function getElementXPath(element) {
    if (element.id) {
        return `//${element.tagName.toLowerCase()}[@id="${element.id}"]`;
    }

    let path = element.tagName.toLowerCase();
    let parent = element.parentElement;

    if (parent) {
        const siblings = Array.from(parent.children).filter(e => e.tagName === element.tagName);
        if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            path += `[${index}]`;
        }
    }

    return path;
}

/**
 * Genera un ID univoco per un elemento
 * @param {HTMLElement} element - L'elemento
 * @returns {string} ID univoco
 */
function generateElementId(element) {
    // Usa ID se presente, altrimenti usa XPath
    if (element.id) {
        return `id:${element.id}`;
    }

    // Genera un ID basato su posizione e attributi
    const rect = element.getBoundingClientRect();
    const signature = `${element.tagName}:${rect.left.toFixed(0)}:${rect.top.toFixed(0)}:${element.className}`;
    return signature;
}

/**
 * Resetta la lista dei bottoni cliccati
 * Chiamare questa funzione quando l'utente fa una nuova richiesta
 */
function resetClickedButtons() {
    clickedButtons.clear();
    console.log('🔄 Lista bottoni cliccati resettata');
}

/**
 * Invia i dati al background script
 * @param {Array} buttons - Array dei bottoni scansionati
 * @returns {Array} Array completo con riferimenti agli elementi
 */
function sendScanResults(buttons) {
    // Rimuovi il riferimento all'elemento prima di inviare (non serializzabile)
    const buttonsData = buttons.map(({ element, ...rest }) => rest);

    const message = {
        action: 'scanComplete',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        buttons: buttonsData,
        totalCount: buttonsData.length
    };

    browser.runtime.sendMessage(message)
        .then(response => {
            console.log('📤 Dati inviati al background script');
        })
        .catch(error => {
            console.error('❌ Errore nell\'invio:', error);
        });

    return buttons; // Ritorna l'array completo con i riferimenti agli elementi
}

/**
 * Listener per messaggi dal background script
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📥 Comando ricevuto:', message.action);

    if (message.action === 'highlightButton') {
        // Ri-scansiona i bottoni per avere i riferimenti aggiornati
        const buttons = scanButtons();
        highlightButton(message.index, buttons);

        console.log(`✅ Ragione: ${message.reason}`);
        sendResponse({ success: true });
    }

    return true;
});
