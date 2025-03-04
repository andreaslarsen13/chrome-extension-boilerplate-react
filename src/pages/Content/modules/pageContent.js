/**
 * Extracts relevant content from the current page
 * @returns {Object} Object containing page information
 */
export const extractPageContent = () => {
    // Get basic page information
    const pageInfo = {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: new Date().toISOString(),
    };

    // Extract meta tags
    const metaTags = {};
    const metaElements = document.querySelectorAll('meta');
    metaElements.forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        if (name && content) {
            metaTags[name] = content;
        }
    });
    pageInfo.meta = metaTags;

    // Extract main content
    try {
        // Try to get the main content
        let mainContent = '';

        // First try to find article or main content
        const mainElement = document.querySelector('article') ||
            document.querySelector('main') ||
            document.querySelector('.main-content');

        if (mainElement) {
            mainContent = mainElement.innerText;
        } else {
            // Fallback to extracting paragraphs
            const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.innerText);
            mainContent = paragraphs.join('\n\n');
        }

        // Limit content length
        pageInfo.mainContent = mainContent.substring(0, 10000);

        // Get headings for structure
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
            level: parseInt(h.tagName.substring(1)),
            text: h.innerText.trim()
        }));
        pageInfo.headings = headings;
    } catch (error) {
        console.error('Error extracting page content:', error);
        pageInfo.error = error.message;
    }

    return pageInfo;
}; 