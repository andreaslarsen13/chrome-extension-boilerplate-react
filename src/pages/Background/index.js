console.log('This is the background page.');
console.log('Put the background scripts here.');

console.log('Internet Assistant background script loaded');

// Store for page information
const pageInfoCache = new Map();

// Twitter timer storage keys
const TWITTER_STORAGE_KEYS = {
    DAILY_USAGE: 'twitter_daily_usage',
    SESSION_START: 'twitter_session_start',
    COOLDOWN_UNTIL: 'twitter_cooldown_until',
    VISIT_COUNT: 'twitter_visit_count',
    LAST_RESET_DATE: 'twitter_last_reset_date',
    LIMIT_REACHED: 'twitter_limit_reached',
    BONUS_VISIT_ACTIVE: 'twitter_bonus_visit_active',
    BONUS_VISIT_START: 'twitter_bonus_visit_start'
};

/**
 * Safe wrapper for chrome.storage.local.get to handle extension context invalidation
 */
async function safeStorageGet(keys) {
    try {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome storage error:', chrome.runtime.lastError);
                    resolve({});
                } else {
                    resolve(result);
                }
            });
        });
    } catch (error) {
        console.error('Error accessing chrome storage:', error);
        return {};
    }
}

/**
 * Safe wrapper for chrome.storage.local.set to handle extension context invalidation
 */
async function safeStorageSet(data) {
    try {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome storage error:', chrome.runtime.lastError);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('Error setting chrome storage:', error);
        return false;
    }
}

// Set up daily reset alarm
try {
    chrome.alarms.create('dailyReset', {
        periodInMinutes: 60 // Check every hour
    });
} catch (error) {
    console.error('Error creating alarm:', error);
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    try {
        if (alarm.name === 'dailyReset') {
            checkAndResetDailyUsage();
        }
    } catch (error) {
        console.error('Error handling alarm:', error);
    }
});

// Check if it's a new day and reset usage if needed
async function checkAndResetDailyUsage() {
    try {
        const data = await safeStorageGet([TWITTER_STORAGE_KEYS.LAST_RESET_DATE]);
        const lastResetDate = data[TWITTER_STORAGE_KEYS.LAST_RESET_DATE] || 0;

        const today = new Date();
        const lastResetDay = new Date(lastResetDate);

        // Reset if it's a new day
        if (today.toDateString() !== lastResetDay.toDateString()) {
            console.log('Twitter Timer: New day, resetting usage from background');
            await safeStorageSet({
                [TWITTER_STORAGE_KEYS.DAILY_USAGE]: 0,
                [TWITTER_STORAGE_KEYS.VISIT_COUNT]: 0,
                [TWITTER_STORAGE_KEYS.LAST_RESET_DATE]: Date.now(),
                [TWITTER_STORAGE_KEYS.LIMIT_REACHED]: false,
                [TWITTER_STORAGE_KEYS.BONUS_VISIT_ACTIVE]: false,
                [TWITTER_STORAGE_KEYS.BONUS_VISIT_START]: null
            });
        }
    } catch (error) {
        console.error('Error in checkAndResetDailyUsage:', error);
    }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        console.log('Background received message:', message, 'from:', sender);

        if (message.action === 'getPageInfo') {
            handleGetPageInfo(sender.tab?.id, sendResponse);
            return true; // Keep the message channel open for async response
        }
        else if (message.action === 'processUserInput') {
            handleProcessUserInput(message.data, sender.tab?.id, sendResponse);
            return true; // Keep the message channel open for async response
        }
        else if (message.action === 'showAssistantUI') {
            handleShowAssistantUI(sender.tab?.id, message.data, sendResponse);
            return true; // Keep the message channel open for async response
        }
        else if (message.action === 'highlightText') {
            handleHighlightText(sender.tab?.id, message.data, sendResponse);
            return true; // Keep the message channel open for async response
        }
        else if (message.action === 'getTwitterStats') {
            handleGetTwitterStats(sendResponse);
            return true; // Keep the message channel open for async response
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
        return true;
    }
});

// Handle requests for Twitter stats
async function handleGetTwitterStats(sendResponse) {
    try {
        const data = await safeStorageGet([
            TWITTER_STORAGE_KEYS.DAILY_USAGE,
            TWITTER_STORAGE_KEYS.VISIT_COUNT,
            TWITTER_STORAGE_KEYS.COOLDOWN_UNTIL,
            TWITTER_STORAGE_KEYS.LIMIT_REACHED,
            TWITTER_STORAGE_KEYS.BONUS_VISIT_ACTIVE,
            TWITTER_STORAGE_KEYS.BONUS_VISIT_START
        ]);

        sendResponse({
            success: true,
            data: {
                dailyUsage: data[TWITTER_STORAGE_KEYS.DAILY_USAGE] || 0,
                visitCount: data[TWITTER_STORAGE_KEYS.VISIT_COUNT] || 0,
                cooldownUntil: data[TWITTER_STORAGE_KEYS.COOLDOWN_UNTIL] || null,
                limitReached: data[TWITTER_STORAGE_KEYS.LIMIT_REACHED] || false,
                bonusVisitActive: data[TWITTER_STORAGE_KEYS.BONUS_VISIT_ACTIVE] || false,
                bonusVisitStart: data[TWITTER_STORAGE_KEYS.BONUS_VISIT_START] || null
            }
        });
    } catch (error) {
        console.error('Error getting Twitter stats:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle requests for page information
function handleGetPageInfo(tabId, sendResponse) {
    if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return;
    }

    // Check if we have cached info
    if (pageInfoCache.has(tabId)) {
        sendResponse({ success: true, data: pageInfoCache.get(tabId) });
        return;
    }

    // Request info from content script
    chrome.tabs.sendMessage(tabId, { action: 'getPageInfo' }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }

        if (response && response.success) {
            // Cache the page info
            pageInfoCache.set(tabId, response.data);
            sendResponse({ success: true, data: response.data });
        } else {
            sendResponse({ success: false, error: 'Failed to get page info' });
        }
    });
}

// Handle user input processing
function handleProcessUserInput(data, tabId, sendResponse) {
    if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return;
    }

    // In a real implementation, this would call an AI service
    // For now, we'll just echo back a simple response
    const response = {
        success: true,
        data: {
            reply: `I received your message: "${data.text}". This is a placeholder response from the background script.`,
            actions: []
        }
    };

    // Add some example actions based on the input
    if (data.text.toLowerCase().includes('highlight')) {
        const textToHighlight = data.text.replace(/highlight/i, '').trim();
        if (textToHighlight) {
            response.data.actions.push({
                type: 'highlight',
                text: textToHighlight
            });
            response.data.reply = `I've highlighted "${textToHighlight}" on the page for you.`;
        }
    }

    setTimeout(() => {
        sendResponse(response);
    }, 500); // Simulate processing delay
}

// Handle showing the assistant UI in the content script
function handleShowAssistantUI(tabId, data, sendResponse) {
    if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return;
    }

    chrome.tabs.sendMessage(tabId, {
        action: 'showAssistantUI',
        data: data || {}
    }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error showing assistant UI:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }

        sendResponse(response || { success: true });
    });
}

// Handle highlighting text in the content script
function handleHighlightText(tabId, data, sendResponse) {
    if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return;
    }

    chrome.tabs.sendMessage(tabId, {
        action: 'highlightText',
        data: data
    }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error highlighting text:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }

        sendResponse(response || { success: true });
    });
}

// Listen for tab updates to clear cache
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        pageInfoCache.delete(tabId);
    }
});

// Listen for tab removal to clear cache
chrome.tabs.onRemoved.addListener((tabId) => {
    pageInfoCache.delete(tabId);
});

// Initialize - check for reset on startup
checkAndResetDailyUsage();
