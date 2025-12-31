// LLM API Module
// Gestisce l'interazione con l'API di OpenAI
// Refactored: One-Action-At-A-Time pattern

/**
 * Chiama l'API di OpenAI per decidere la PROSSIMA SINGOLA azione
 * @param {string} userGoal - Obiettivo dell'utente
 * @param {Object} domData - Dati del DOM raccolti
 * @param {Object} agentContext - Contesto dell'agente (storia azioni, step corrente, ecc.)
 * @returns {Promise<Object>} Risposta dell'LLM con singola azione
 */
async function callOpenAI(userGoal, domData, agentContext = null) {
  // Recupera API key dallo storage
  const apiKey = await getAPIKey();

  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  // Formatta il prompt
  const userPrompt = formatPromptForLLM(domData, userGoal, agentContext);

  // System prompt per pattern one-action-at-a-time
  const systemPrompt = `Sei un assistente esperto che aiuta gli utenti a navigare siti web eseguendo UNA SINGOLA AZIONE alla volta.

IMPORTANTE: Devi decidere UNA SOLA AZIONE per ogni richiesta. Dopo ogni azione, il sistema aggiornerà il DOM e ti chiederà la prossima azione.
IMPORTANTE: Non ripetere azioni già fallite con lo stesso approccio e verifica che la risposta rispecchia il formatto richiesto.

Riceverai:
1. Il TITOLO e l'URL della pagina web
2. Una lista di BOTTONI disponibili nella pagina con:
   - Indice numerico [0], [1], [2]...
   - Tag HTML (BUTTON, A, INPUT, LABEL, DIV, SPAN, LI)
   - Attributi (id, class)
   - TESTO visibile del bottone
3. L'OBIETTIVO dell'utente in linguaggio naturale
4. La STORIA delle azioni già completate (se presenti)

TIPI DI AZIONI DISPONIBILI:
1. "click" - Clicca su un bottone specifico (usa buttonIndex)
2. "type" - Scrivi testo in un campo di input (usa buttonIndex e text)
3. "hover" - Passa il mouse su un elemento SENZA cliccare (per aprire menu a tendina)
4. "forceOpen" - Forza l'apertura di un menu agendo sul DOM (usa se hover fallisce)
5. "wait" - Attendi un certo tempo (usa duration in ms)
6. "clickByText" - Cerca un bottone per testo e ci clicca (usa searchText)

REGOLE:
- Decidi UNA SOLA AZIONE
- Analizza la storia delle azioni per sapere cosa è già stato fatto
- Se hai appena aperto un menu con hover/click/forceOpen, cerca nel DOM gli elementi del menu
- Non ripetere azioni già fallite con lo stesso approccio
- IMPORTANTE: Verifica visivamente se l'azione è già completata (es. cerca [ACTIVE], (SELEZIONATO), checked). Se vedi che l'opzione desiderata è già attiva, NON CLICCARE DI NUOVO, ma segna come completo.
- Se l'ultima azione ha causato un reload/navigazione, ASSUMI che abbia avuto successo e cerca conferme visive.
- IMPORTANTE: Non ripetere azioni già fallite con lo stesso approccio e verifica che la risposta rispecchia il formatto richiesto.
- Se l'obiettivo è raggiunto, imposta "isComplete": true

FORMATO RISPOSTA - Rispondi SOLO in formato JSON valido:
{
  "thought": "<ragionamento su cosa fare>",
  "action": {
    "type": "click" | "type" | "hover" | "forceOpen" | "wait" | "clickByText",
    "buttonIndex": <numero>,     // per click, type, hover, forceOpen
    "text": "<testo da scrivere>", // SOLO per type
    "searchText": "<testo>",     // per clickByText
    "duration": <ms>,            // per wait
    "reasoning": "<spiegazione breve>"
  },
  "expectation": "<cosa ti aspetti succeda dopo questa azione>",
  "isComplete": false
}

Se l'obiettivo è RAGGIUNTO:
{
  "thought": "L'obiettivo è stato raggiunto",
  "action": null,
  "isComplete": true
}

Se NON puoi procedere (errore):
{
  "thought": "<spiegazione del problema>",
  "action": {
    "type": "error",
    "reasoning": "<spiega perché non puoi procedere>"
  },
  "isComplete": true
}`;

  const requestBody = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };

  console.log('🤖 Chiamata API OpenAI in corso...');
  console.log('📝 Prompt inviato:', userPrompt.substring(0, 500) + '...');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error('API_KEY_INVALID');
      } else if (response.status === 429) {
        throw new Error('RATE_LIMIT');
      } else {
        throw new Error(`API_ERROR: ${errorData.error?.message || response.statusText}`);
      }
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parsa la risposta JSON
    const result = JSON.parse(content);

    console.log('✅ Risposta LLM:', result);

    // Valida la risposta
    if (typeof result.isComplete !== 'boolean') {
      throw new Error('INVALID_RESPONSE_FORMAT: manca isComplete');
    }

    if (!result.isComplete && !result.action) {
      throw new Error('INVALID_RESPONSE_FORMAT: manca action');
    }

    if (result.action && !result.action.type) {
      throw new Error('INVALID_RESPONSE_FORMAT: manca action.type');
    }

    return result;

  } catch (error) {
    console.error('❌ Errore chiamata API:', error);

    // Re-throw errori custom
    if (error.message.startsWith('API_KEY') ||
      error.message.startsWith('RATE_LIMIT') ||
      error.message.startsWith('INVALID_RESPONSE')) {
      throw error;
    }

    // Errori di rete
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('NETWORK_ERROR');
    }

    throw new Error('UNKNOWN_ERROR');
  }
}

/**
 * Formatta il prompt per l'LLM includendo contesto agente
 * @param {Object} domData - Dati DOM
 * @param {string} userGoal - Obiettivo utente
 * @param {Object} agentContext - Contesto agente (opzionale)
 * @returns {string} Prompt formattato
 */
function formatPromptForLLM(domData, userGoal, agentContext = null) {
  let prompt = `## PAGINA WEB
Titolo: ${domData.pageContext?.title || 'N/A'}
URL: ${domData.pageContext?.url || 'N/A'}

## OBIETTIVO
${userGoal}

## CONTENUTO PAGINA (Testo visibile)
${domData.pageText ? domData.pageText : "Nessun testo significativo rilevato."}

`;

  // Aggiungi storia azioni se presente
  if (agentContext && agentContext.completedActions && agentContext.completedActions.length > 0) {
    prompt += `## AZIONI GIÀ COMPLETATE (${agentContext.completedActions.length} step)\n`;
    agentContext.completedActions.forEach((a, i) => {
      const target = a.target !== null ? ` [${a.target}]` : '';
      const status = a.success ? '✅' : '❌';
      prompt += `${i + 1}. ${status} ${a.type}${target}: ${a.reasoning}\n`;
    });
    prompt += `\nStep corrente: ${agentContext.currentStep + 1}\n`;
    prompt += `Tempo trascorso: ${Math.round(agentContext.elapsedTime / 1000)}s\n\n`;
  }

  // Lista bottoni
  prompt += `## BOTTONI DISPONIBILI (${domData.buttons.length} elementi)\n`;
  domData.buttons.forEach(btn => {
    prompt += `[${btn.index}] ${btn.tagName}`;
    if (btn.id) prompt += ` #${btn.id}`;
    if (btn.className) prompt += ` .${btn.className.split(' ')[0]}`;
    prompt += ` "${btn.text}"\n`;
  });

  prompt += `\n## DECIDI LA PROSSIMA AZIONE\nRispondi in JSON.`;

  return prompt;
}

/**
 * Recupera la API key dallo storage o dalla configurazione hardcoded
 * @returns {Promise<string|null>} API key o null se non configurata
 */
async function getAPIKey() {
  try {
    // Prima controlla se c'è una key hardcoded in apiConfig.js
    if (typeof API_CONFIG !== 'undefined' &&
      API_CONFIG.USE_HARDCODED_KEY &&
      API_CONFIG.OPENAI_API_KEY) {
      console.log('🔑 Usando API key hardcoded');
      return API_CONFIG.OPENAI_API_KEY;
    }

    // Altrimenti usa quella salvata nello storage
    const result = await browser.storage.local.get('openai_api_key');
    return result.openai_api_key || null;
  } catch (error) {
    console.error('❌ Errore recupero API key:', error);
    return null;
  }
}
