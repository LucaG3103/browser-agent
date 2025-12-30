// Background Script - Business Logic
// Riceve dati dai content scripts e decide quali bottoni evidenziare

console.log('🚀 Background script caricato');

// Listener per messaggi dai content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📥 Messaggio ricevuto:', message.action);

    if (message.action === 'scanComplete') {
        handleButtonScan(message, sender);
        sendResponse({ received: true });
    }

    return true; // Mantiene il canale aperto per risposte asincrone
});

/**
 * Processa i dati della scansione bottoni e decide quale evidenziare
 */
function handleButtonScan(data, sender) {
    const { url, buttons, totalCount } = data;

    console.log(`📊 Scansione ricevuta da: ${url}`);
    console.log(`   Bottoni totali: ${totalCount}`);

    // Log dei bottoni trovati
    buttons.forEach((btn, idx) => {
        console.log(`   [${idx}] ${btn.text} (${btn.tagName}${btn.id ? '#' + btn.id : ''})`);
    });

    // LOGICA: Seleziona il terzo bottone (index 2)
    const targetIndex = 3;

    if (buttons.length > targetIndex) {
        const selectedButton = buttons[targetIndex];

        console.log(`✅ Bottone selezionato: [${targetIndex}] "${selectedButton.text}"`);

        // Invia comando al content script per evidenziare
        browser.tabs.sendMessage(sender.tab.id, {
            action: 'highlightButton',
            index: targetIndex,
            reason: 'Third button selected by background logic'
        }).then(() => {
            console.log('📤 Comando di evidenziazione inviato');
        }).catch(err => {
            console.error('❌ Errore nell\'invio del comando:', err);
        });

        // (Opzionale) Salva i dati in storage
        browser.storage.local.set({
            lastScan: {
                url: url,
                timestamp: data.timestamp,
                selectedButton: selectedButton,
                selectedIndex: targetIndex
            }
        });

    } else {
        console.warn(`⚠️ Pagina ha solo ${buttons.length} bottoni, impossibile selezionare il terzo`);
    }
}

// Event listener per nuove installazioni/aggiornamenti
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🎉 Estensione installata per la prima volta');
    } else if (details.reason === 'update') {
        console.log('🔄 Estensione aggiornata');
    }
});

console.log('✅ Background script pronto');
