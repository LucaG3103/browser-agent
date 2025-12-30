// Configuration Module
// Gestisce la configurazione e lo storage dell'API key

let configPanel = null;
let isConfigOpen = false;

/**
 * Salva la API key nello storage
 * @param {string} apiKey - API key di OpenAI
 * @returns {Promise<void>}
 */
async function saveAPIKey(apiKey) {
    try {
        await browser.storage.local.set({ openai_api_key: apiKey });
        console.log('✅ API Key salvata');
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio API key:', error);
        throw error;
    }
}

/**
 * Verifica se l'API key è configurata
 * @returns {Promise<boolean>}
 */
async function isAPIKeyConfigured() {
    const apiKey = await getAPIKey();
    return apiKey !== null && apiKey.length > 0;
}

/**
 * Valida il formato dell'API key OpenAI
 * @param {string} apiKey - API key da validare
 * @returns {boolean}
 */
function validateAPIKeyFormat(apiKey) {
    // Le API key di OpenAI iniziano con "sk-" e hanno una lunghezza specifica
    return typeof apiKey === 'string' &&
        apiKey.startsWith('sk-') &&
        apiKey.length > 20;
}

/**
 * Crea il pannello di configurazione
 */
function createConfigPanel() {
    if (configPanel) return;

    configPanel = document.createElement('div');
    configPanel.id = 'llm-config-panel';
    configPanel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        z-index: 9999999999;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <span>⚙️ Configurazione</span>
        <button id="close-config" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
    `;

    // Body
    const body = document.createElement('div');
    body.style.cssText = `
        padding: 20px;
    `;

    body.innerHTML = `
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">
                OpenAI API Key
            </label>
            <div style="position: relative;">
                <input 
                    type="password" 
                    id="api-key-input" 
                    placeholder="sk-..."
                    style="width: 100%; padding: 10px 40px 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-family: monospace; box-sizing: border-box;"
                />
                <button 
                    id="toggle-visibility" 
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px;"
                    title="Mostra/Nascondi"
                >👁️</button>
            </div>
            <p style="margin-top: 8px; font-size: 12px; color: #666;">
                La chiave verrà salvata localmente nel browser.
            </p>
        </div>
        
        <div style="margin-bottom: 15px;">
            <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #667eea; font-size: 13px; text-decoration: none;">
                🔗 Ottieni la tua API key da OpenAI
            </a>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button id="save-api-key" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px;">
                Salva
            </button>
            <button id="cancel-config" style="flex: 1; padding: 10px; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px;">
                Annulla
            </button>
        </div>
        
        <div id="config-message" style="margin-top: 15px; padding: 10px; border-radius: 6px; font-size: 13px; display: none;"></div>
    `;

    configPanel.appendChild(header);
    configPanel.appendChild(body);
    document.body.appendChild(configPanel);

    // Event listeners
    header.querySelector('#close-config').addEventListener('click', closeConfigPanel);
    body.querySelector('#cancel-config').addEventListener('click', closeConfigPanel);
    body.querySelector('#save-api-key').addEventListener('click', handleSaveAPIKey);

    // Toggle visibility
    const toggleBtn = body.querySelector('#toggle-visibility');
    const input = body.querySelector('#api-key-input');
    toggleBtn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Carica il valore esistente se presente
    loadCurrentAPIKey();
}

/**
 * Carica l'API key corrente nel form
 */
async function loadCurrentAPIKey() {
    const apiKey = await getAPIKey();
    if (apiKey) {
        document.getElementById('api-key-input').value = apiKey;
    }
}

/**
 * Gestisce il salvataggio dell'API key
 */
async function handleSaveAPIKey() {
    const input = document.getElementById('api-key-input');
    const apiKey = input.value.trim();
    const messageDiv = document.getElementById('config-message');

    // Valida formato
    if (!validateAPIKeyFormat(apiKey)) {
        showConfigMessage('❌ Formato API key non valido. Deve iniziare con "sk-"', 'error');
        return;
    }

    try {
        await saveAPIKey(apiKey);
        showConfigMessage('✅ API Key salvata con successo!', 'success');

        // Chiudi il pannello dopo 1.5 secondi
        setTimeout(closeConfigPanel, 1500);
    } catch (error) {
        showConfigMessage('❌ Errore durante il salvataggio', 'error');
    }
}

/**
 * Mostra un messaggio nel pannello di configurazione
 */
function showConfigMessage(message, type) {
    const messageDiv = document.getElementById('config-message');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    messageDiv.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
    messageDiv.style.color = type === 'success' ? '#155724' : '#721c24';
    messageDiv.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;
}

/**
 * Apre il pannello di configurazione
 */
function openConfigPanel() {
    if (!configPanel) {
        createConfigPanel();
    }
    configPanel.style.display = 'flex';
    isConfigOpen = true;

    // Reset messaggio
    const messageDiv = document.getElementById('config-message');
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

/**
 * Chiude il pannello di configurazione
 */
function closeConfigPanel() {
    if (configPanel) {
        configPanel.style.display = 'none';
    }
    isConfigOpen = false;
}
