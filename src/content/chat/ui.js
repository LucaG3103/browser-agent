// Chat UI Module
// Gestisce la creazione e lo stato dell'interfaccia chat

// Stato della chat
let chatWindow = null;
let chatButton = null;
let isChatOpen = false;

/**
 * Crea il bottone floating per aprire la chat
 */
function createChatButton() {
    chatButton = document.createElement('div');
    chatButton.id = 'llm-chat-button';
    chatButton.innerHTML = '💬';
    chatButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        z-index: 999999998;
        transition: transform 0.2s, box-shadow 0.2s;
    `;

    chatButton.addEventListener('mouseenter', () => {
        chatButton.style.transform = 'scale(1.1)';
        chatButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });

    chatButton.addEventListener('mouseleave', () => {
        chatButton.style.transform = 'scale(1)';
        chatButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    chatButton.addEventListener('click', toggleChat);

    document.body.appendChild(chatButton);
}

/**
 * Crea la finestra della chat
 */
function createChatWindow() {
    chatWindow = document.createElement('div');
    chatWindow.id = 'llm-chat-window';
    chatWindow.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 380px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        z-index: 999999999;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // Header (draggable)
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        font-weight: 600;
        cursor: move;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <span>💬 Chat LLM</span>
        <div style="display: flex; gap: 10px; align-items: center;">
            <button id="settings-button" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 24px; height: 24px;" title="Impostazioni">⚙️</button>
            <button id="close-chat" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
        </div>
    `;

    // Messages area
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'chat-messages';
    messagesContainer.style.cssText = `
        flex: 1;
        padding: 15px;
        overflow-y: auto;
        background: #f7f8fa;
    `;

    // Input area
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
        padding: 15px;
        background: white;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 10px;
    `;

    const input = document.createElement('input');
    input.id = 'chat-input';
    input.type = 'text';
    input.placeholder = 'Scrivi un messaggio...';
    input.style.cssText = `
        flex: 1;
        padding: 10px 15px;
        border: 1px solid #e0e0e0;
        border-radius: 20px;
        outline: none;
        font-size: 14px;
        font-family: inherit;
    `;

    const sendButton = document.createElement('button');
    sendButton.id = 'send-button';
    sendButton.innerHTML = '➤';
    sendButton.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
    `;

    sendButton.addEventListener('mouseenter', () => {
        sendButton.style.transform = 'scale(1.1)';
    });

    sendButton.addEventListener('mouseleave', () => {
        sendButton.style.transform = 'scale(1)';
    });

    inputContainer.appendChild(input);
    inputContainer.appendChild(sendButton);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);

    document.body.appendChild(chatWindow);

    // Event listeners
    header.querySelector('#close-chat').addEventListener('click', toggleChat);
    header.querySelector('#settings-button').addEventListener('click', openConfigPanel);
    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Make draggable (usa la funzione da drag.js)
    makeDraggable(chatWindow, header);

    // Welcome message (usa la funzione da messages.js)
    addMessage('Ciao! Sono pronto ad aiutarti. Scrivi un messaggio per iniziare!', 'bot');
}

/**
 * Toggle chat aperta/chiusa
 */
function toggleChat() {
    isChatOpen = !isChatOpen;
    if (chatWindow) {
        chatWindow.style.display = isChatOpen ? 'flex' : 'none';
    }
    if (chatButton) {
        chatButton.style.transform = isChatOpen ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}
