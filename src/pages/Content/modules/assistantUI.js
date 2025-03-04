/**
 * Creates and injects the assistant UI into the current page
 * @param {Object} options - Configuration options for the UI
 */
export const createAssistantUI = (options = {}) => {
    // Check if the UI already exists
    if (document.getElementById('internet-assistant-container')) {
        console.log('Internet Assistant UI already exists');
        return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'internet-assistant-container';
    container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    height: 500px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    transition: transform 0.3s ease;
  `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
    background-color: #4285f4;
    color: white;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;

    const title = document.createElement('h3');
    title.textContent = options.title || 'Internet Assistant';
    title.style.margin = '0';
    title.style.fontSize = '16px';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

    closeButton.addEventListener('click', () => {
        container.remove();
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create content area
    const content = document.createElement('div');
    content.style.cssText = `
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background-color: #f9f9f9;
  `;

    // Add initial message
    const initialMessage = document.createElement('div');
    initialMessage.style.cssText = `
    background-color: #e9e9eb;
    color: #333;
    padding: 10px 14px;
    border-radius: 18px;
    border-bottom-left-radius: 4px;
    margin-bottom: 12px;
    max-width: 80%;
    line-height: 1.4;
    font-size: 14px;
  `;
    initialMessage.textContent = options.initialMessage ||
        "Hello! I'm your Internet Assistant. I can help you understand and interact with this page.";
    content.appendChild(initialMessage);

    // Create input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
    padding: 12px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    background-color: white;
  `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Ask me anything...';
    input.style.cssText = `
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #e0e0e0;
    border-radius: 20px;
    font-size: 14px;
    outline: none;
  `;

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.style.cssText = `
    margin-left: 8px;
    padding: 8px 16px;
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
  `;

    // Handle sending messages
    sendButton.addEventListener('click', () => {
        if (!input.value.trim()) return;

        // Add user message
        addMessage(input.value, 'user');

        // Send message to background script
        chrome.runtime.sendMessage({
            action: 'processUserInput',
            data: {
                text: input.value,
                url: window.location.href
            }
        }, response => {
            if (response && response.success) {
                addMessage(response.data.reply, 'assistant');
            } else {
                addMessage('Sorry, I encountered an error processing your request.', 'assistant');
            }
        });

        input.value = '';
    });

    // Allow sending with Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendButton.click();
        }
    });

    inputArea.appendChild(input);
    inputArea.appendChild(sendButton);

    // Add all elements to container
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(inputArea);

    // Add container to page
    document.body.appendChild(container);

    // Make the assistant draggable
    makeDraggable(container, header);

    // Function to add a message to the UI
    function addMessage(text, role) {
        const message = document.createElement('div');
        message.style.cssText = `
      padding: 10px 14px;
      border-radius: 18px;
      margin-bottom: 12px;
      max-width: 80%;
      line-height: 1.4;
      font-size: 14px;
      word-wrap: break-word;
    `;

        if (role === 'user') {
            message.style.cssText += `
        background-color: #4285f4;
        color: white;
        border-bottom-right-radius: 4px;
        margin-left: auto;
      `;
        } else {
            message.style.cssText += `
        background-color: #e9e9eb;
        color: #333;
        border-bottom-left-radius: 4px;
      `;
        }

        message.textContent = text;
        content.appendChild(message);
        content.scrollTop = content.scrollHeight;
    }
};

/**
 * Makes an element draggable
 * @param {HTMLElement} element - The element to make draggable
 * @param {HTMLElement} handle - The element to use as a drag handle
 */
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        // Get the mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
} 