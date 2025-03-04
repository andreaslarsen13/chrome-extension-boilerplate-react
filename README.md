# Internet Assistant Chrome Extension

A helpful Chrome extension that provides information and assistance while browsing the web.

## Features

- **Chat Interface**: Ask questions and get helpful responses in a clean chat interface
- **Page Analysis**: The assistant can analyze the content of the current page
- **Text Highlighting**: Highlight important information on the webpage
- **In-Page Assistant**: Launch the assistant directly on the webpage for easier interaction
- **Twitter Usage Limiter**: Helps reduce time spent on Twitter/X by setting daily limits

## Installation

### Development Mode

1. Clone this repository
   ```
   git clone https://github.com/yourusername/internet-assistant.git
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Build the extension
   ```
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the `build` folder from this project

### Development with Hot Reload

For development with hot reload:

```
npm start
```

This will start the webpack dev server and automatically reload the extension when you make changes.

## Usage

1. Click on the Internet Assistant icon in your Chrome toolbar to open the popup
2. Type your question or request in the input field and press Enter or click Send
3. To launch the assistant directly on the webpage, click the "Launch Assistant on Page" button

### Twitter Usage Limiter

The Twitter Usage Limiter helps you manage your time on Twitter/X with a structured system:

- **Daily Limit**: 15 minutes per day on Twitter/X
- **Usage Tracking**: Shows remaining time in the top-right corner of Twitter
- **Cooldown System**: When you reach your daily limit, Twitter is blocked for 15 minutes
- **Bonus Visits**: After each cooldown period, you get one 2-minute bonus visit
- **Strict Enforcement**: If you leave Twitter during a bonus visit or use up the 2 minutes, Twitter is blocked again for 15 minutes
- **Daily Reset**: All usage limits reset at midnight each day

How the cycle works:
1. You get 15 minutes of Twitter usage per day
2. When you reach this limit, Twitter is blocked for 15 minutes
3. After the cooldown ends, you get one 2-minute bonus visit
4. After using the bonus visit, Twitter is blocked for another 15 minutes
5. This cycle of "15-minute cooldown → 2-minute bonus visit" repeats throughout the day

## Commands

The assistant can respond to various commands, including:

- General questions about the webpage content
- Requests to highlight specific text on the page
- Questions about the information on the current page

## Technical Details

This extension is built with:

- React 18
- TypeScript
- Webpack 5
- Chrome Extension Manifest V3

## Project Structure

```
src/
├── assets/          # Images and other static assets
├── pages/
│   ├── Background/  # Background script
│   ├── Content/     # Content scripts injected into webpages
│   │   └── modules/
│   │       └── twitterTimer.js  # Twitter usage limiting functionality
│   ├── Popup/       # Popup UI
│   └── Options/     # Options page
└── manifest.json    # Extension manifest
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
