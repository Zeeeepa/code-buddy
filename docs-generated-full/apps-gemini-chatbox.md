---
title: "apps — gemini-chatbox"
module: "apps-gemini-chatbox"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.039Z"
---
# apps — gemini-chatbox

This document provides a technical overview of the `apps/gemini-chatbox` module, detailing its purpose, architecture, key components, and operational flow. It is designed for developers who need to understand, maintain, or extend this application.

## 1. Introduction

The `gemini-chatbox` module is a self-contained mini-application designed to demonstrate and test integration with the Google Gemini API under real-world conditions. It features a simple web-based chat interface (frontend) and an Express.js backend that proxies requests to the Gemini API.

Its primary purpose is to serve as a dedicated environment for:
*   Verifying Gemini API connectivity and functionality.
*   Providing a tangible example of a basic chat application built with Gemini.
*   Facilitating quick smoke tests for the Gemini integration.

## 2. Architecture Overview

The `gemini-chatbox` application follows a client-server architecture:

*   **Frontend:** A static web application (`public/`) served by the backend, providing the user interface for chat.
*   **Backend:** An Express.js server (`server.mjs`) that handles HTTP requests, serves static assets, and acts as a proxy to the Google Gemini API.
*   **External Dependency:** The Google Gemini API, which performs the actual large language model processing.

```mermaid
graph TD
    A[Browser] -->|GET /| B(server.mjs)
    A -- User Input --> C(app.js)
    C -->|POST /api/chat {message, history}| B
    B -->|POST to Gemini API| D(Google Gemini API)
    D -->|Response| B
    B -->|JSON {reply, model}| C
    C -->|Display Message| A
```

## 3. Key Components

### 3.1. Frontend (`apps/gemini-chatbox/public/`)

The frontend is a standard web application composed of HTML, CSS, and JavaScript.

*   **`index.html`**: The main entry point for the web interface. It defines the structure of the chatbox, including the message display area (`#messages`), the input form (`#chat-form`), and a status indicator (`#status`). It also embeds the styling and loads `app.js`.
*   **`app.js`**: Contains the client-side logic for the chat interface.
    *   **`addMessage(role, content)`**: Appends a new message (either 'user' or 'assistant') to the chat display, scrolling to the bottom.
    *   **`setBusy(isBusy, text)`**: Manages the UI state, disabling the input field and send button while a request is in progress, and updating the status text.
    *   **`form.addEventListener('submit', async (event) => { ... })`**: The core event listener that triggers when the user sends a message. It captures the message, updates the UI, sends a `POST` request to `/api/chat`, processes the response, and updates the chat history.
    *   **`history` array**: A client-side array that stores the conversation history in `[{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]` format, which is sent with each new chat request to maintain context.

### 3.2. Backend (`apps/gemini-chatbox/server.mjs`)

This is an Express.js server responsible for serving the frontend and handling API interactions with Gemini.

*   **Environment Configuration**: Uses `dotenv` to load environment variables from `.env` files (both repository root and current working directory) for configuration.
    *   `CHATBOX_PORT`: The port the server listens on (defaults to `3333`).
    *   `GOOGLE_API_KEY` or `GEMINI_API_KEY`: Your API key for accessing the Gemini API. **This is mandatory for chat functionality.**
    *   `GEMINI_MODEL`: The specific Gemini model to use (defaults to `gemini-2.5-flash`).
*   **Static File Serving**: `app.use(express.static(publicDir))` serves all files from the `public/` directory.
*   **`app.get('/health', ...)`**: A simple health check endpoint that returns `ok: true` and indicates if the Gemini API key is configured.
*   **`app.post('/api/chat', async (req, res) => { ... })`**: The main API endpoint for chat interactions.
    *   It validates the presence of `GEMINI_API_KEY` and the incoming `message`.
    *   It calls `normalizeHistory(history)` to transform the client-side chat history into the format expected by the Gemini API (`{ role: 'model' | 'user', parts: [{ text: '...' }] }`). It also limits history length and content size.
    *   It constructs and sends a `POST` request to the Google Gemini API endpoint (`generativelanguage.googleapis.com`).
    *   It parses the Gemini API response, extracts the generated text, and sends it back to the client.
    *   Robust error handling is included for missing API keys, invalid requests, and failures from the Gemini API.
*   **`app.get(/.*/, ...)`**: A catch-all route that serves `index.html` for any request not matched by other routes, enabling client-side routing if needed (though not explicitly used here).

### 3.3. Smoke Test (`apps/gemini-chatbox/smoke-test.mjs`)

This script provides an automated way to verify the application's basic functionality.

*   **`spawn('node', ['apps/gemini-chatbox/server.mjs'], ...)`**: Launches the `server.mjs` as a child process.
*   **`waitForServer(timeoutMs)`**: Monitors the server's stdout to detect when it has successfully started and is listening for connections.
*   **`run()`**: Executes a sequence of tests:
    1.  Waits for the server to start.
    2.  Performs a `GET` request to `/health` to check server status and API key configuration.
    3.  Performs a `GET` request to `/` to ensure the main HTML page loads correctly.
    4.  Performs a `POST` request to `/api/chat` with a specific message, expecting a reply from Gemini.
    5.  Logs success or failure and ensures the server process is terminated.

## 4. Execution Flow: Chat Interaction

1.  **Initialization**: When `http://localhost:3333` is accessed, `server.mjs` serves `index.html` and `app.js`. `app.js` initializes the chat interface and displays a welcome message.
2.  **User Input**: The user types a message into the `message-input` textarea and clicks "Envoyer" (or presses Enter).
3.  **Frontend Processing (`app.js`)**:
    *   The `submit` event listener on `chat-form` is triggered.
    *   `addMessage('user', message)` displays the user's message in the chat window.
    *   `setBusy(true, 'Envoi au modèle Gemini...')` disables the input and button, and updates the status.
    *   A `fetch` `POST` request is sent to `/api/chat` with the user's `message` and the current `history` array.
4.  **Backend Processing (`server.mjs`)**:
    *   The `app.post('/api/chat', ...)` handler receives the request.
    *   It validates the input and `GEMINI_API_KEY`.
    *   `normalizeHistory` converts the client-side history format to the Gemini API's `contents` format.
    *   A `fetch` `POST` request is made to the Google Gemini API endpoint, including the `contents` (message + history) and `generationConfig` (temperature, max output tokens).
    *   The response from Gemini is parsed. If successful, the `text` content from Gemini's reply is extracted.
    *   A JSON response `{ reply: text, model: GEMINI_MODEL }` is sent back to the frontend.
5.  **Frontend Response Handling (`app.js`)**:
    *   The `fetch` promise resolves.
    *   If the response is `ok`:
        *   `addMessage('assistant', reply)` displays Gemini's response.
        *   The `history` array is updated with both the user's message and Gemini's reply to maintain context for subsequent interactions.
        *   `statusEl.textContent` is updated with the model used.
    *   If an error occurs (either HTTP error from `/api/chat` or an error from Gemini):
        *   `addMessage('assistant', 'Erreur: ...')` displays the error message.
        *   `statusEl.textContent` indicates a failure.
    *   Finally, `setBusy(false, ...)` re-enables the input and button, and focuses the input field.

## 5. Configuration

The application relies on environment variables for configuration. These can be set in a `.env` file at the repository root or in the `apps/gemini-chatbox` directory.

*   **`GOOGLE_API_KEY` or `GEMINI_API_KEY`**: Your API key obtained from Google Cloud or Google AI Studio. This is crucial for the application to function.
    *   Example: `GOOGLE_API_KEY=YOUR_GEMINI_API_KEY_HERE`
*   **`GEMINI_MODEL`**: Specifies which Gemini model to use.
    *   Example: `GEMINI_MODEL=gemini-1.5-flash` (defaults to `gemini-2.5-flash` if not set).
*   **`CHATBOX_PORT`**: The port on which the Express server will listen.
    *   Example: `CHATBOX_PORT=8080` (defaults to `3333`).

## 6. How to Run

From the root of the repository:

```bash
node -r dotenv/config apps/gemini-chatbox/server.mjs
```

Then, open your web browser to `http://localhost:3333` (or your configured `CHATBOX_PORT`).

## 7. How to Test

To run the automated smoke test:

```bash
node -r dotenv/config apps/gemini-chatbox/smoke-test.mjs
```

This script will launch the server, perform health checks, verify the homepage, and send a test message to the Gemini API via the `/api/chat` endpoint.

## 8. Contributing

This module is designed as a dedicated, standalone application within the repository. While it doesn't have direct code dependencies on other internal modules, contributions should focus on:

*   **Improving Gemini integration**: Enhancing prompt engineering, adding more advanced generation configurations, or supporting streaming responses.
*   **UI/UX enhancements**: Improving the chat interface, responsiveness, or accessibility.
*   **Robustness**: Adding more comprehensive error handling, logging, or input validation.
*   **Testing**: Expanding the `smoke-test.mjs` or adding unit tests for specific functions.

When making changes, ensure that the `smoke-test.mjs` continues to pass and that the application functions correctly with a valid Gemini API key.