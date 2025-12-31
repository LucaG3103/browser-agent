// Configuration Module
// Gestisce la configurazione e lo storage dell'API key

let configPanel = null;
let isConfigOpen = false;

// Default provider
const DEFAULT_PROVIDER = 'openai';

/**
 * Salva la configurazione nello storage
 * @param {string} provider - Provider selezionato (openai, google)
 * @param {string} apiKey - API key del provider
 * @returns {Promise<void>}
 */
async function saveConfig(provider, apiKey) {
    try {
        const config = {
            llm_provider: provider,
        };

        // Salva la key specifica per il provider
        if (provider === 'openai') {
            config.openai_api_key = apiKey;
        } else if (provider === 'google') {
            config.google_api_key = apiKey;
        }

        await browser.storage.local.set(config);
        console.log('✅ Configurazione salvata:', provider);
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio configurazione:', error);
        throw error;
    }
}

/**
 * Recupera la configurazione corrente
 * @returns {Promise<Object>}
 */
async function getConfig() {
    try {
        const result = await browser.storage.local.get(['llm_provider', 'openai_api_key', 'google_api_key']);
        return {
            provider: result.llm_provider || DEFAULT_PROVIDER,
            openaiKey: result.openai_api_key || '',
            googleKey: result.google_api_key || ''
        };
    } catch (error) {
        console.error('❌ Errore recupero configurazione:', error);
        return { provider: DEFAULT_PROVIDER, openaiKey: '', googleKey: '' };
    }
}

/**
 * Verifica se l'API key per il provider attivo è configurata
 * @returns {Promise<boolean>}
 */
async function isAPIKeyConfigured() {
    const config = await getConfig();
    if (config.provider === 'openai') return !!config.openaiKey;
    if (config.provider === 'google') return !!config.googleKey;
    return false;
}

/**
 * Valida il formato dell'API key
 * @param {string} provider - Provider
 * @param {string} apiKey - API key da validare
 * @returns {boolean}
 */
function validateAPIKeyFormat(provider, apiKey) {
    if (!apiKey || apiKey.length < 10) return false;

    if (provider === 'openai') {
        return apiKey.startsWith('sk-');
    } else if (provider === 'google') {
        // Le key di Google AI Studio di solito non hanno prefisso fisso, ma controlliamo lunghezza
        return apiKey.length > 20;
    }
    return false;
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
        <span>⚙️ Configurazione AI</span>
        <button id="close-config" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
    `;

    // Body
    const body = document.createElement('div');
    body.style.cssText = `
        padding: 20px;
    `;

    body.innerHTML = `
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">
                Modello IA
            </label>
            <select id="provider-select" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white;">
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="google">Google (Gemini 3 Pro)</option>
            </select>
        </div>

        <div id="openai-config" class="provider-section">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">
                    OpenAI API Key
                </label>
                <div style="position: relative;">
                    <input type="password" id="openai-key-input" placeholder="sk-..." class="api-key-input"
                        style="width: 100%; padding: 10px 40px 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-family: monospace; box-sizing: border-box;" />
                </div>
                <div style="margin-top: 8px;">
                    <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #667eea; font-size: 13px; text-decoration: none;">
                        🔗 Ottieni API Key OpenAI
                    </a>
                </div>
            </div>
        </div>

        <div id="google-config" class="provider-section" style="display: none;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">
                    Google Gemini API Key
                </label>
                <div style="position: relative;">
                    <input type="password" id="google-key-input" placeholder="AIzaSy..." class="api-key-input"
                        style="width: 100%; padding: 10px 40px 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-family: monospace; box-sizing: border-box;" />
                </div>
                 <div style="margin-top: 8px;">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #667eea; font-size: 13px; text-decoration: none;">
                        🔗 Ottieni API Key Google AI Studio
                    </a>
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="save-config-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px;">
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

    // References
    const providerSelect = body.querySelector('#provider-select');
    const openaiSection = body.querySelector('#openai-config');
    const googleSection = body.querySelector('#google-config');

    // Event listeners
    header.querySelector('#close-config').addEventListener('click', closeConfigPanel);
    body.querySelector('#cancel-config').addEventListener('click', closeConfigPanel);
    body.querySelector('#save-config-btn').addEventListener('click', handleSaveConfig);

    // Switch provider logic
    providerSelect.addEventListener('change', (e) => {
        if (e.target.value === 'openai') {
            openaiSection.style.display = 'block';
            googleSection.style.display = 'none';
        } else {
            openaiSection.style.display = 'none';
            googleSection.style.display = 'block';
        }
    });

    // Carica configurazione
    loadCurrentConfig();
}

/**
 * Carica la configurazione corrente nel form
 */
async function loadCurrentConfig() {
    const config = await getConfig();

    const providerSelect = document.getElementById('provider-select');
    if (!providerSelect) return;

    providerSelect.value = config.provider;
    document.getElementById('openai-key-input').value = config.openaiKey;
    document.getElementById('google-key-input').value = config.googleKey;

    // Trigger change event to update UI visibility
    providerSelect.dispatchEvent(new Event('change'));
}

/**
 * Gestisce il salvataggio
 */
async function handleSaveConfig() {
    const provider = document.getElementById('provider-select').value;
    let apiKey = '';

    if (provider === 'openai') {
        apiKey = document.getElementById('openai-key-input').value.trim();
    } else {
        apiKey = document.getElementById('google-key-input').value.trim();
    }

    // Valida
    if (!validateAPIKeyFormat(provider, apiKey)) {
        showConfigMessage(`❌ API Key non valida per ${provider === 'openai' ? 'OpenAI' : 'Google Gemini'}`, 'error');
        return;
    }

    try {
        await saveConfig(provider, apiKey);
        showConfigMessage('✅ Configurazione salvata!', 'success');
        setTimeout(closeConfigPanel, 1500);
    } catch (error) {
        showConfigMessage('❌ Errore durante il salvataggio', 'error');
    }
}

/**
 * Mostra un messaggio nel pannello
 */
function showConfigMessage(message, type) {
    const messageDiv = document.getElementById('config-message');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    messageDiv.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
    messageDiv.style.color = type === 'success' ? '#155724' : '#721c24';
    messageDiv.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;
}

function openConfigPanel() {
    if (!configPanel) createConfigPanel();
    configPanel.style.display = 'flex';
    isConfigOpen = true;

    // Ricarica i dati aggiornati
    loadCurrentConfig();

    // Reset messaggi
    const messageDiv = document.getElementById('config-message');
    if (messageDiv) messageDiv.style.display = 'none';
}

function closeConfigPanel() {
    if (configPanel) configPanel.style.display = 'none';
    isConfigOpen = false;
}
