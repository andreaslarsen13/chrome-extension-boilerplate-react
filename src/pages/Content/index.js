import { createAssistantUI } from './modules/assistantUI';
import { extractPageContent } from './modules/pageContent';
import { initTwitterTimer, isTwitterSite } from './modules/twitterTimer';

console.log('Internet Assistant content script loaded');

// Initialize Twitter timer if on Twitter/X
try {
    initTwitterTimer();
} catch (error) {
    console.error('Error initializing Twitter timer:', error);
}

// Extract page content when the content script loads
const pageInfo = extractPageContent();
console.log('Page info extracted:', pageInfo);

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        console.log('Content script received message:', message);

        if (message.action === 'getPageInfo') {
            // Send page information back to the requester
            sendResponse({
                success: true,
                data: extractPageContent()
            });
        } else if (message.action === 'showAssistantUI') {
            // Show the assistant UI on the page
            createAssistantUI(message.data);
            sendResponse({ success: true });
        } else if (message.action === 'highlightText') {
            // Highlight text on the page
            try {
                const searchText = message.data.text;
                const highlightedCount = highlightTextOnPage(searchText);
                sendResponse({
                    success: true,
                    count: highlightedCount
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }

    // Return true to indicate that the response will be sent asynchronously
    return true;
});

// Function to highlight text on the page
function highlightTextOnPage(searchText) {
    if (!searchText) return 0;

    try {
        const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const textNodes = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim() !== '' && node.parentNode.nodeName !== 'SCRIPT' && node.parentNode.nodeName !== 'STYLE') {
                textNodes.push(node);
            }
        }

        let count = 0;
        textNodes.forEach(textNode => {
            const parent = textNode.parentNode;
            const content = textNode.nodeValue;

            if (searchRegex.test(content)) {
                const matches = content.match(searchRegex);
                count += matches ? matches.length : 0;

                const fragments = content.split(searchRegex);
                if (fragments.length <= 1) return;

                const container = document.createElement('span');

                fragments.forEach((fragment, i) => {
                    if (i > 0) {
                        const highlight = document.createElement('span');
                        highlight.className = 'internet-assistant-highlight';
                        highlight.style.backgroundColor = '#FFFF00';
                        highlight.style.color = '#000000';
                        highlight.appendChild(document.createTextNode(matches[i - 1]));
                        container.appendChild(highlight);
                    }

                    if (fragment) {
                        container.appendChild(document.createTextNode(fragment));
                    }
                });

                parent.replaceChild(container, textNode);
            }
        });

        return count;
    } catch (error) {
        console.error('Error highlighting text:', error);
        return 0;
    }
}
