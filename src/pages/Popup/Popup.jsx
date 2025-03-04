import React, { useState, useEffect, useRef } from 'react';
import './Popup.css';

const Popup = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your Internet Assistant. How can I help you today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(null);
  const [twitterStats, setTwitterStats] = useState(null);
  const [isTwitterSite, setIsTwitterSite] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get current tab information
  useEffect(() => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          setError('Failed to access tab information');
          return;
        }

        if (tabs[0]) {
          setCurrentTab(tabs[0]);
          console.log('Current page:', tabs[0].title, tabs[0].url);

          // Check if current site is Twitter
          const url = tabs[0].url || '';
          const isTwitter = url.includes('twitter.com') || url.includes('x.com');
          setIsTwitterSite(isTwitter);

          // If it's Twitter, get usage stats
          if (isTwitter) {
            getTwitterStats();
          }
        }
      });
    } catch (error) {
      console.error('Error in tab query:', error);
      setError('Failed to access browser tabs');
    }
  }, []);

  // Get Twitter usage statistics
  const getTwitterStats = () => {
    try {
      chrome.runtime.sendMessage({
        action: 'getTwitterStats'
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          setError('Failed to get Twitter stats');
          return;
        }

        if (response && response.success) {
          setTwitterStats(response.data);
        } else {
          console.error('Error getting Twitter stats:', response?.error);
          setError('Failed to get Twitter stats');
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to communicate with extension');
    }
  };

  // Format time in minutes and seconds
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      if (currentTab) {
        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'processUserInput',
          data: {
            text: input,
            url: currentTab.url
          }
        }, response => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'Sorry, there was an error communicating with the extension. Please try reloading the page.'
            }]);
            setIsLoading(false);
            return;
          }

          if (response && response.success) {
            const assistantMessage = {
              role: 'assistant',
              content: response.data.reply
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Process any actions
            if (response.data.actions && response.data.actions.length > 0) {
              processActions(response.data.actions);
            }
          } else {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.'
            }]);
          }
          setIsLoading(false);
        });
      } else {
        // Fallback if no tab is available
        setTimeout(() => {
          const assistantMessage = {
            role: 'assistant',
            content: `I received your message: "${input}". This is a placeholder response. In a complete implementation, I would provide a helpful answer based on your query.`
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting response:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
      setIsLoading(false);
    }
  };

  // Process actions returned from the background script
  const processActions = (actions) => {
    if (!currentTab || !currentTab.id) return;

    try {
      actions.forEach(action => {
        if (action.type === 'highlight' && action.text) {
          chrome.tabs.sendMessage(currentTab.id, {
            action: 'highlightText',
            data: { text: action.text }
          }, response => {
            if (chrome.runtime.lastError) {
              console.error('Error highlighting text:', chrome.runtime.lastError);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error processing actions:', error);
    }
  };

  // Launch the assistant UI in the current tab
  const launchAssistantInPage = () => {
    if (!currentTab || !currentTab.id) return;

    try {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'showAssistantUI',
        data: {
          title: 'Internet Assistant',
          initialMessage: 'Hello! I\'m now available directly on this page. How can I help you?'
        }
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error launching assistant:', chrome.runtime.lastError);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, I couldn\'t launch the assistant on this page. The page might be restricted or the extension might need to be reloaded.'
          }]);
          return;
        }

        if (response && response.success) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I\'ve launched the assistant directly on the page. You can now interact with me there!'
          }]);
        }
      });
    } catch (error) {
      console.error('Error launching assistant:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t launch the assistant on this page due to an error.'
      }]);
    }
  };

  // Render Twitter stats section if on Twitter
  const renderTwitterStats = () => {
    if (!isTwitterSite || !twitterStats) return null;

    const dailyLimit = 15 * 60 * 1000; // 15 minutes in milliseconds
    const bonusLimit = 2 * 60 * 1000; // 2 minutes for bonus visits

    const now = Date.now();
    const inCooldown = twitterStats.cooldownUntil && now < twitterStats.cooldownUntil;
    const cooldownTimeLeft = inCooldown ? twitterStats.cooldownUntil - now : 0;

    // Check if we're in a bonus visit
    const bonusVisitActive = twitterStats.bonusVisitActive || false;

    if (bonusVisitActive) {
      // Show bonus visit stats
      const bonusTimeUsed = now - (twitterStats.bonusVisitStart || now);
      const bonusTimeLeft = Math.max(0, bonusLimit - bonusTimeUsed);
      const percentUsed = Math.min(100, (bonusTimeUsed / bonusLimit) * 100);

      return (
        <div className="twitter-stats bonus-mode">
          <h2>Twitter Bonus Visit</h2>

          <div className="stat-item">
            <span>Bonus Time:</span>
            <span>2:00</span>
          </div>

          <div className="stat-item">
            <span>Time Left:</span>
            <span className={bonusTimeLeft < 30000 ? 'warning' : 'bonus'}>
              {formatTime(bonusTimeLeft)}
            </span>
          </div>

          <div className="progress-bar">
            <div
              className="progress bonus"
              style={{ width: `${percentUsed}%`, backgroundColor: percentUsed > 75 ? '#FF3B30' : '#34C759' }}
            ></div>
          </div>

          <div className="bonus-info">
            <p>This is a bonus visit (2 min max)</p>
            <p className="note">Switching away from Twitter will end your bonus visit</p>
          </div>
        </div>
      );
    } else if (inCooldown) {
      // Show cooldown stats
      return (
        <div className="twitter-stats cooldown-mode">
          <h2>Twitter Cooldown</h2>

          <div className="stat-item">
            <span>Cooldown Period:</span>
            <span>15:00</span>
          </div>

          <div className="stat-item">
            <span>Time Remaining:</span>
            <span>{formatTime(cooldownTimeLeft)}</span>
          </div>

          <div className="cooldown-info">
            <p>You'll get a 2-minute bonus visit after cooldown</p>
          </div>
        </div>
      );
    } else {
      // Show regular usage stats
      const timeUsed = twitterStats.dailyUsage;
      const timeLeft = Math.max(0, dailyLimit - timeUsed);
      const percentUsed = Math.min(100, (timeUsed / dailyLimit) * 100);

      return (
        <div className="twitter-stats">
          <h2>Twitter Usage Stats</h2>

          <div className="stat-item">
            <span>Daily Limit:</span>
            <span>15:00</span>
          </div>

          <div className="stat-item">
            <span>Time Used:</span>
            <span>{formatTime(timeUsed)}</span>
          </div>

          <div className="stat-item">
            <span>Time Left:</span>
            <span className={timeLeft < 300000 ? 'warning' : ''}>{formatTime(timeLeft)}</span>
          </div>

          <div className="progress-bar">
            <div
              className="progress"
              style={{ width: `${percentUsed}%`, backgroundColor: percentUsed > 80 ? '#FF3B30' : '#1DA1F2' }}
            ></div>
          </div>

          <div className="info-message">
            <p>After reaching your limit, you'll get a 2-minute bonus visit after each 15-minute cooldown</p>
          </div>
        </div>
      );
    }
  };

  const reloadExtension = () => {
    // Reload the extension by opening the extensions page
    chrome.tabs.create({ url: 'chrome://extensions' }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to open extensions page:', chrome.runtime.lastError);
        setError('Failed to open extensions page. Please reload the extension manually.');
      } else {
        // Provide instructions in the error message
        setError('Please reload the extension by clicking the refresh icon on the extensions page.');
      }
    });
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <div className="error-message">
        <p>{error}</p>
        <button onClick={reloadExtension}>Reload Extension</button>
      </div>
    );
  };

  return (
    <div className="internet-assistant">
      <header className="assistant-header">
        <h1>Internet Assistant</h1>
      </header>

      {renderError()}
      {renderTwitterStats()}

      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-content">{message.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant-message">
            <div className="message-content loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="action-buttons">
        <button
          className="launch-button"
          onClick={launchAssistantInPage}
          disabled={!currentTab}
        >
          Launch Assistant on Page
        </button>
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Popup;
