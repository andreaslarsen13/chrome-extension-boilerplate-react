/**
 * Twitter Timer Module
 * Handles tracking and limiting time spent on Twitter/X
 */

// Constants
const DAILY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const COOLDOWN_PERIOD_MS = 15 * 60 * 1000; // 15 minutes cooldown (changed from 10)
const BONUS_VISIT_LIMIT_MS = 2 * 60 * 1000; // 2 minutes for bonus visit
const TWITTER_DOMAINS = ['twitter.com', 'x.com'];

// Storage keys
const STORAGE_KEYS = {
    DAILY_USAGE: 'twitter_daily_usage',
    SESSION_START: 'twitter_session_start',
    COOLDOWN_UNTIL: 'twitter_cooldown_until',
    VISIT_COUNT: 'twitter_visit_count',
    LAST_RESET_DATE: 'twitter_last_reset_date',
    LIMIT_REACHED: 'twitter_limit_reached',
    BONUS_VISIT_ACTIVE: 'twitter_bonus_visit_active',
    BONUS_VISIT_START: 'twitter_bonus_visit_start'
};

// Global interval reference
let checkInterval = null;

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

/**
 * Check if the current site is Twitter/X
 * @returns {boolean} True if the current site is Twitter/X
 */
export const isTwitterSite = () => {
    return TWITTER_DOMAINS.some(domain => window.location.hostname.includes(domain));
};

/**
 * Initialize the Twitter timer
 * Sets up the timer and event listeners
 */
export const initTwitterTimer = async () => {
    try {
        if (!isTwitterSite()) return;

        console.log('Twitter Timer: Initializing on Twitter/X');

        // Reset usage if it's a new day
        await checkAndResetDailyUsage();

        // Check if we're in a cooldown period
        const cooldownUntil = await getCooldownTime();
        if (cooldownUntil && Date.now() < cooldownUntil) {
            // Check if we should allow a bonus visit
            const data = await safeStorageGet([
                STORAGE_KEYS.BONUS_VISIT_ACTIVE,
                STORAGE_KEYS.LIMIT_REACHED
            ]);

            const limitReached = data[STORAGE_KEYS.LIMIT_REACHED] || false;
            const bonusVisitActive = data[STORAGE_KEYS.BONUS_VISIT_ACTIVE] || false;

            if (limitReached && !bonusVisitActive) {
                // Allow one bonus visit after cooldown
                console.log('Twitter Timer: Starting bonus visit (2 minutes)');
                await startBonusVisit();
            } else {
                // Show cooldown overlay
                showCooldownOverlay(cooldownUntil);
                return;
            }
        }

        // Create and show usage stats
        createUsageStatsElement();

        // Check if we're in a bonus visit
        const data = await safeStorageGet([
            STORAGE_KEYS.BONUS_VISIT_ACTIVE,
            STORAGE_KEYS.BONUS_VISIT_START
        ]);

        const bonusVisitActive = data[STORAGE_KEYS.BONUS_VISIT_ACTIVE] || false;

        if (bonusVisitActive) {
            // We're in a bonus visit - start the 2-minute timer
            const bonusVisitStart = data[STORAGE_KEYS.BONUS_VISIT_START] || Date.now();
            const timeElapsed = Date.now() - bonusVisitStart;

            if (timeElapsed >= BONUS_VISIT_LIMIT_MS) {
                // Bonus visit time is up
                await endBonusVisit();
                return;
            }

            // Start tracking the bonus visit time
            startBonusVisitTimer(bonusVisitStart);
        } else {
            // Normal visit - track regular usage time
            // Start tracking time - only set a new session start if one doesn't exist
            const sessionData = await safeStorageGet([STORAGE_KEYS.SESSION_START]);
            if (!sessionData[STORAGE_KEYS.SESSION_START]) {
                await safeStorageSet({ [STORAGE_KEYS.SESSION_START]: Date.now() });
            }

            // Set up interval to check time spent
            startTimeCheckInterval();
        }

        // Track this visit
        await trackVisit();

        // Set up event listener for when the page is hidden/closed
        document.addEventListener('visibilitychange', handleVisibilityChange);
    } catch (error) {
        console.error('Twitter Timer: Error initializing timer', error);

        // Display error message to the user
        const errorMessage = error.message.includes('Extension context invalidated')
            ? 'The extension context has been invalidated. Please reload the extension.'
            : 'An error occurred while initializing the Twitter timer. Please reload the page or the extension.';

        showErrorMessage(errorMessage, false);

        // Try to clean up any existing intervals
        if (checkInterval) {
            clearInterval(checkInterval);
        }
    }
};

/**
 * Track a new visit to Twitter
 */
async function trackVisit() {
    const data = await chrome.storage.local.get([
        STORAGE_KEYS.VISIT_COUNT,
        STORAGE_KEYS.LIMIT_REACHED,
        STORAGE_KEYS.DAILY_USAGE
    ]);

    const limitReached = data[STORAGE_KEYS.LIMIT_REACHED] || false;
    const currentUsage = data[STORAGE_KEYS.DAILY_USAGE] || 0;

    // Only count as a new visit if the limit has been reached before
    if (limitReached || currentUsage >= DAILY_LIMIT_MS) {
        const visitCount = data[STORAGE_KEYS.VISIT_COUNT] || 0;
        console.log(`Twitter Timer: Incrementing visit count from ${visitCount} to ${visitCount + 1}`);

        await chrome.storage.local.set({
            [STORAGE_KEYS.VISIT_COUNT]: visitCount + 1
        });
    }
}

/**
 * Start a bonus visit (2 minutes)
 */
async function startBonusVisit() {
    try {
        await safeStorageSet({
            [STORAGE_KEYS.BONUS_VISIT_ACTIVE]: true,
            [STORAGE_KEYS.BONUS_VISIT_START]: Date.now()
        });
    } catch (error) {
        console.error('Error starting bonus visit:', error);

        const errorMessage = error.message.includes('Extension context invalidated')
            ? 'The extension context has been invalidated. Please reload the extension.'
            : 'An error occurred while starting your bonus visit. Please reload the page or the extension.';

        showErrorMessage(errorMessage);
    }
}

/**
 * End the bonus visit and start cooldown
 */
async function endBonusVisit() {
    try {
        await safeStorageSet({
            [STORAGE_KEYS.BONUS_VISIT_ACTIVE]: false,
            [STORAGE_KEYS.BONUS_VISIT_START]: null
        });

        // Start the cooldown
        await startCooldown();
    } catch (error) {
        console.error('Error ending bonus visit:', error);

        const errorMessage = error.message.includes('Extension context invalidated')
            ? 'The extension context has been invalidated. Please reload the extension.'
            : 'An error occurred while ending your bonus visit. Please reload the page or the extension.';

        showErrorMessage(errorMessage);
    }
}

/**
 * Start the timer for bonus visit
 */
function startBonusVisitTimer(startTime) {
    try {
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        // Set up new interval for bonus visit
        checkInterval = setInterval(async () => {
            try {
                const timeElapsed = Date.now() - startTime;
                const timeLeft = Math.max(0, BONUS_VISIT_LIMIT_MS - timeElapsed);

                // Update the UI to show bonus visit time
                updateBonusVisitStats(timeLeft);

                if (timeElapsed >= BONUS_VISIT_LIMIT_MS) {
                    clearInterval(checkInterval);
                    checkInterval = null;
                    await endBonusVisit();
                }
            } catch (error) {
                console.error('Error in bonus visit timer:', error);
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }, 1000);
    } catch (error) {
        console.error('Error starting bonus visit timer:', error);
    }
}

/**
 * Update the UI to show bonus visit time
 */
function updateBonusVisitStats(timeLeftMs) {
    try {
        const statsContainer = document.getElementById('twitter-usage-stats');
        if (!statsContainer) return;

        const timeLeftElement = statsContainer.querySelector('.time-left');
        if (!timeLeftElement) return;

        const minutes = Math.floor(timeLeftMs / 60000);
        const seconds = Math.floor((timeLeftMs % 60000) / 1000);

        timeLeftElement.textContent = `Bonus visit: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Change color when time is running out
        if (timeLeftMs < 30000) { // Less than 30 seconds
            timeLeftElement.style.color = '#FF3B30';
        } else if (timeLeftMs < 60000) { // Less than 1 minute
            timeLeftElement.style.color = '#FF9500';
        } else {
            timeLeftElement.style.color = '#34C759'; // Green for bonus time
        }
    } catch (error) {
        console.error('Error updating bonus visit stats:', error);
    }
}

/**
 * Start the interval to check time spent
 */
function startTimeCheckInterval() {
    try {
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        // Set up new interval
        checkInterval = setInterval(async () => {
            try {
                const timeSpent = await getTimeSpentToday();
                updateUsageStats(timeSpent);

                if (timeSpent >= DAILY_LIMIT_MS) {
                    clearInterval(checkInterval);
                    checkInterval = null;

                    // Mark that the limit has been reached
                    await safeStorageSet({
                        [STORAGE_KEYS.LIMIT_REACHED]: true
                    });

                    await startCooldown();
                }
            } catch (error) {
                console.error('Error in time check interval:', error);
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }, 1000); // Check every second
    } catch (error) {
        console.error('Error starting time check interval:', error);
    }
}

/**
 * Handle visibility change events (tab switching, minimizing, etc.)
 */
async function handleVisibilityChange() {
    try {
        if (document.visibilityState === 'hidden') {
            // Page is hidden (tab switched, minimized, etc.)
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }

            // Check if we're in a bonus visit
            const data = await safeStorageGet([STORAGE_KEYS.BONUS_VISIT_ACTIVE]);
            const bonusVisitActive = data[STORAGE_KEYS.BONUS_VISIT_ACTIVE] || false;

            if (bonusVisitActive) {
                // End bonus visit when leaving
                await endBonusVisit();
            } else {
                // Update regular time tracking
                await updateTimeSpent();
            }
        } else if (document.visibilityState === 'visible') {
            // Page is visible again - reinitialize
            initTwitterTimer();
        }
    } catch (error) {
        console.error('Error handling visibility change:', error);

        // Only show error message if the page is visible
        if (document.visibilityState === 'visible') {
            const errorMessage = error.message.includes('Extension context invalidated')
                ? 'The extension context has been invalidated. Please reload the extension.'
                : 'An error occurred while tracking your Twitter usage. Please reload the page or the extension.';

            showErrorMessage(errorMessage);
        }
    }
}

/**
 * Check if it's a new day and reset usage if needed
 */
async function checkAndResetDailyUsage() {
    try {
        const data = await safeStorageGet([STORAGE_KEYS.LAST_RESET_DATE]);
        const lastResetDate = data[STORAGE_KEYS.LAST_RESET_DATE] || 0;

        const today = new Date();
        const lastResetDay = new Date(lastResetDate);

        // Reset if it's a new day
        if (today.toDateString() !== lastResetDay.toDateString()) {
            console.log('Twitter Timer: New day, resetting usage');
            await safeStorageSet({
                [STORAGE_KEYS.DAILY_USAGE]: 0,
                [STORAGE_KEYS.VISIT_COUNT]: 0,
                [STORAGE_KEYS.LAST_RESET_DATE]: Date.now(),
                [STORAGE_KEYS.SESSION_START]: Date.now(), // Reset session start on a new day
                [STORAGE_KEYS.LIMIT_REACHED]: false, // Reset limit reached flag
                [STORAGE_KEYS.BONUS_VISIT_ACTIVE]: false, // Reset bonus visit flag
                [STORAGE_KEYS.BONUS_VISIT_START]: null // Reset bonus visit start time
            });
        }
    } catch (error) {
        console.error('Error checking and resetting daily usage:', error);
    }
}

/**
 * Update the time spent today
 */
async function updateTimeSpent() {
    try {
        const data = await safeStorageGet([
            STORAGE_KEYS.DAILY_USAGE,
            STORAGE_KEYS.SESSION_START
        ]);

        const sessionStart = data[STORAGE_KEYS.SESSION_START] || Date.now();
        const currentUsage = data[STORAGE_KEYS.DAILY_USAGE] || 0;

        const sessionDuration = Date.now() - sessionStart;
        const newUsage = currentUsage + sessionDuration;

        // Update the total usage and reset the session start time
        await safeStorageSet({
            [STORAGE_KEYS.DAILY_USAGE]: newUsage,
            [STORAGE_KEYS.SESSION_START]: Date.now()
        });

        console.log(`Twitter Timer: Updated usage to ${Math.round(newUsage / 1000)} seconds`);
    } catch (error) {
        console.error('Error updating time spent:', error);

        // Only show error message if the page is visible
        if (document.visibilityState === 'visible') {
            const errorMessage = error.message.includes('Extension context invalidated')
                ? 'The extension context has been invalidated. Please reload the extension.'
                : 'An error occurred while updating your Twitter usage time. Your usage may not be tracked correctly.';

            showErrorMessage(errorMessage);
        }
    }
}

/**
 * Get the total time spent on Twitter today
 * @returns {Promise<number>} Time spent in milliseconds
 */
async function getTimeSpentToday() {
    try {
        const data = await safeStorageGet([
            STORAGE_KEYS.DAILY_USAGE,
            STORAGE_KEYS.SESSION_START
        ]);

        const sessionStart = data[STORAGE_KEYS.SESSION_START] || Date.now();
        const storedUsage = data[STORAGE_KEYS.DAILY_USAGE] || 0;

        // Add the current session time to the stored usage
        const currentSessionDuration = Date.now() - sessionStart;
        return storedUsage + currentSessionDuration;
    } catch (error) {
        console.error('Error getting time spent today:', error);
        return 0;
    }
}

/**
 * Start the cooldown period
 */
async function startCooldown() {
    try {
        // Show the cooldown overlay
        const cooldownUntil = Date.now() + COOLDOWN_PERIOD_MS;

        await safeStorageSet({
            [STORAGE_KEYS.COOLDOWN_UNTIL]: cooldownUntil
        });

        showCooldownOverlay(cooldownUntil);
    } catch (error) {
        console.error('Error starting cooldown:', error);

        const errorMessage = error.message.includes('Extension context invalidated')
            ? 'The extension context has been invalidated. Please reload the extension.'
            : 'An error occurred while starting the cooldown period. Please reload the page or the extension.';

        showErrorMessage(errorMessage);
    }
}

/**
 * Get the current cooldown end time
 * @returns {Promise<number|null>} Timestamp when cooldown ends or null if not in cooldown
 */
async function getCooldownTime() {
    try {
        const data = await safeStorageGet([STORAGE_KEYS.COOLDOWN_UNTIL]);
        return data[STORAGE_KEYS.COOLDOWN_UNTIL] || null;
    } catch (error) {
        console.error('Error getting cooldown time:', error);
        return null;
    }
}

/**
 * Create the usage stats element
 */
function createUsageStatsElement() {
    try {
        // Remove any existing stats element
        const existingStats = document.getElementById('twitter-usage-stats');
        if (existingStats) {
            existingStats.remove();
        }

        // Create stats container
        const statsContainer = document.createElement('div');
        statsContainer.id = 'twitter-usage-stats';

        // Create time left element
        const timeLeftElement = document.createElement('div');
        timeLeftElement.className = 'time-left';
        timeLeftElement.textContent = 'Loading...';

        // Check if we're in a bonus visit
        safeStorageGet([STORAGE_KEYS.BONUS_VISIT_ACTIVE]).then(data => {
            try {
                const bonusVisitActive = data[STORAGE_KEYS.BONUS_VISIT_ACTIVE] || false;

                // Create status element
                const statusElement = document.createElement('div');
                statusElement.className = 'visit-count';

                if (bonusVisitActive) {
                    statusElement.textContent = 'Bonus visit (2 min max)';
                    statusElement.style.color = '#34C759'; // Green for bonus
                } else {
                    statusElement.textContent = 'Regular visit (15 min daily limit)';
                }

                // Add elements to container
                statsContainer.appendChild(timeLeftElement);
                statsContainer.appendChild(statusElement);

                // Add container to page
                document.body.appendChild(statsContainer);
            } catch (error) {
                console.error('Error creating usage stats UI:', error);
            }
        }).catch(error => {
            console.error('Error getting bonus visit status:', error);
        });
    } catch (error) {
        console.error('Error creating usage stats element:', error);
    }
}

/**
 * Update the usage stats display
 * @param {number} timeSpent - Time spent in milliseconds
 */
function updateUsageStats(timeSpent) {
    try {
        const statsContainer = document.getElementById('twitter-usage-stats');
        if (!statsContainer) return;

        const timeLeftElement = statsContainer.querySelector('.time-left');
        if (!timeLeftElement) return;

        const timeLeftMs = Math.max(0, DAILY_LIMIT_MS - timeSpent);
        const minutes = Math.floor(timeLeftMs / 60000);
        const seconds = Math.floor((timeLeftMs % 60000) / 1000);

        timeLeftElement.textContent = `Time left: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Change color when time is running out
        if (timeLeftMs < 60000) { // Less than 1 minute
            timeLeftElement.style.color = '#FF3B30';
        } else if (timeLeftMs < 300000) { // Less than 5 minutes
            timeLeftElement.style.color = '#FF9500';
        } else {
            timeLeftElement.style.color = '#1DA1F2';
        }
    } catch (error) {
        console.error('Error updating usage stats:', error);
    }
}

/**
 * Show the cooldown overlay on the Twitter page
 * @param {number} cooldownUntil - Timestamp when cooldown ends
 */
function showCooldownOverlay(cooldownUntil) {
    try {
        // Remove any existing overlay
        const existingOverlay = document.getElementById('twitter-timer-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'twitter-timer-overlay';

        // Create content container
        const container = document.createElement('div');
        container.className = 'container';

        // Create header
        const header = document.createElement('h1');
        header.textContent = 'Time to take a break from Twitter';

        // Create message
        const message = document.createElement('p');
        message.textContent = "You've reached your time limit on Twitter. After this cooldown period, you'll get a 2-minute bonus visit.";

        // Create timer
        const timer = document.createElement('div');
        timer.className = 'timer';

        // Update timer every second
        const updateTimer = () => {
            try {
                const timeLeft = Math.max(0, cooldownUntil - Date.now());
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);

                timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    overlay.remove();
                    window.location.reload();
                }
            } catch (error) {
                console.error('Error updating timer:', error);
            }
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);

        // Add elements to container
        container.appendChild(header);
        container.appendChild(message);
        container.appendChild(timer);

        // Add container to overlay
        overlay.appendChild(container);

        // Add overlay to page
        document.body.appendChild(overlay);
    } catch (error) {
        console.error('Error showing cooldown overlay:', error);
    }
}

/**
 * Displays an error message in the UI
 */
function showErrorMessage(errorMessage, isTemporary = true) {
    // Remove any existing error message
    const existingError = document.querySelector('.twitter-timer-error');
    if (existingError) {
        existingError.remove();
    }

    // Create error container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'twitter-timer-error';

    // Create error title
    const errorTitle = document.createElement('div');
    errorTitle.className = 'error-title';
    errorTitle.textContent = 'Internet Assistant Error';

    // Create error message
    const errorText = document.createElement('div');
    errorText.className = 'error-message';
    errorText.textContent = errorMessage;

    // Create reload button
    const reloadButton = document.createElement('button');
    reloadButton.className = 'error-action';
    reloadButton.textContent = 'Reload Extension';
    reloadButton.addEventListener('click', () => {
        // Open the extensions page
        chrome.tabs.create({ url: 'chrome://extensions' }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to open extensions page:', chrome.runtime.lastError);
                // Update the error message
                errorText.textContent = 'Failed to open extensions page. Please reload the extension manually.';
            }
        });
    });

    // Assemble the error container
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorText);
    errorContainer.appendChild(reloadButton);

    // Add to the document
    document.body.appendChild(errorContainer);

    // Remove after 10 seconds if temporary
    if (isTemporary) {
        setTimeout(() => {
            errorContainer.remove();
        }, 10000);
    }
} 