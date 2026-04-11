---
title: "src — canvas"
module: "src-canvas"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.389Z"
---
# src — canvas

The `src/canvas` module provides a comprehensive framework for AI agents to interact with and render visual interfaces. It encompasses two primary, albeit distinct, systems:

1.  **A2UI (Agent-to-UI) Protocol Implementation**: A structured, component-based UI system for building dynamic, interactive interfaces. This includes the `A2UIManager` for state management, `A2UIServer` for real-time communication, and `A2UITool` for agent interaction.
2.  **Canvas Manager**: A more free-form drawing surface for managing graphical elements, their positions, sizes, and history.

This documentation will cover both systems, highlighting their individual functionalities and how they integrate within the broader codebase.

---

## Module Overview

The `src/canvas` module serves as the foundation for visual interaction within the system. It allows AI agents to:

*   **Define and manipulate rich user interfaces** using a component-based model (A2UI).
*   **Receive real-time user interactions** from these UIs.
*   **Render UIs** to various targets like terminal, HTML, or even a browser client via WebSocket.
*   **Manage free-form graphical canvases** with elements, selection, and undo/redo capabilities.

### Core Concepts

*   **A2UI Protocol**: A JSON-based protocol (`a2ui-types.ts`) for agents to describe UI surfaces, components, and data bindings. It's inspired by reactive UI frameworks, allowing for declarative UI definitions.
*   **Surface**: The primary container in A2UI, identified by a `surfaceId`. Each surface holds its own set of components and a data model.
*   **Component**: The building blocks of an A2UI surface (e.g., `button`, `textField`, `card`, `row`). Components are defined in a flat "adjacency list" structure and reference each other by ID to form a tree.
*   **Data Model**: A key-value store associated with each A2UI surface, used for data binding to component properties. Updates to the data model automatically propagate to bound components.
*   **Canvas (Manager)**: A separate, more traditional graphical canvas where elements (like shapes, text boxes, images) can be placed, moved, resized, and layered. This is distinct from an A2UI "Surface" but resides in the same module.

### Architecture Diagram (A2UI)

The A2UI system follows a clear separation of concerns:

```mermaid
graph TD
    A[AI Agent] -->|Calls A2UITool actions| B(A2UITool)
    B -->|Processes messages| C(A2UIManager)
    C -->|Emits UI state changes| D(A2UIServer)
    D -->|Broadcasts via WebSocket| E[UI Client (Browser/Terminal)]
    E -->|Sends user actions| D
    D -->|Forwards user actions| C
    C -->|Renders to HTML/Terminal| E
```

*   **`A2UITool`**: The primary interface for AI agents to interact with the A2UI system. It abstracts the underlying manager and server operations into simple actions.
*   **`A2UIManager`**: The central state manager. It maintains the state of all A2UI surfaces, processes incoming A2UI protocol messages, builds component trees, resolves data bindings, and handles rendering logic.
*   **`A2UIServer`**: The communication layer. It exposes a WebSocket endpoint for real-time UI clients and HTTP endpoints for static HTML views. It listens to `A2UIManager` events and broadcasts updates to subscribed clients, and forwards client interactions back to the manager.

---

## A2UI Components

### `a2ui-types.ts`: The A2UI Protocol Definition

This file defines the entire A2UI protocol, acting as the contract between agents, the manager, and UI clients.

**Key Interfaces & Types:**

*   **`ComponentType`**: A union type listing all supported UI component types (e.g., `'button'`, `'textField'`, `'row'`, `'card'`).
*   **`A2UIStyles`**: Defines a set of CSS-like properties that can be applied to components for styling.
*   **`A2UIAction`**: Describes an action that a component can trigger, including a `name` and optional `payload`.
*   **`ComponentProps`**: A discriminated union type where each member corresponds to a `ComponentType` and defines its specific properties. For example, `{ button: ButtonComponentProps }`.
*   **`A2UIComponent`**: The fundamental unit of UI definition. It contains an `id` and a `component` field (which is a `ComponentProps` object). Components are stored in a flat list, and their hierarchical relationships are defined by `children` arrays within their `props`.
*   **`A2UIMessage`**: A union type for messages sent from the agent/server to the UI client. This includes:
    *   `SurfaceUpdateMessage`: To add or update components on a surface.
    *   `DataModelUpdateMessage`: To update the data model of a surface.
    *   `BeginRenderingMessage`: To signal that a surface is ready to be displayed, specifying its root component and global styles.
    *   `DeleteSurfaceMessage`: To remove a surface.
*   **`A2UIClientMessage`**: A union type for messages sent from the UI client to the server. This includes:
    *   `UserActionMessage`: When a user interacts with a component (e.g., button click).
    *   `CanvasEventMessage`: A more granular event from the browser client (e.g., input change, select).
*   **`Surface`**: The internal representation of an A2UI surface within the `A2UIManager`. It holds a `Map` of `A2UIComponent`s, a `dataModel`, `root` component ID, `styles`, and metadata.
*   **`RenderedComponent`**: The tree-like structure built by the `A2UIManager` from the flat `A2UIComponent` list, with data bindings resolved, ready for rendering.

---

### `A2UIManager`: The A2UI State Machine

The `A2UIManager` class is the core logic unit for the A2UI system. It manages the lifecycle and state of all A2UI surfaces and their components.

**Key Responsibilities:**

*   **Message Processing (`processMessage`, `processMessages`)**:
    *   Receives and dispatches incoming `A2UIMessage`s (e.g., `surfaceUpdate`, `dataModelUpdate`, `beginRendering`, `deleteSurface`).
    *   These methods are the primary entry points for agents to modify the UI state.
*   **Surface Management (`createSurface`, `getSurface`, `getAllSurfaces`, `deleteSurface`)**:
    *   Maintains a `Map<string, Surface>` to store all active surfaces.
    *   Handles the creation, retrieval, and deletion of `Surface` objects.
*   **Component Tree Building (`buildComponentTree`, `buildComponentNode`)**:
    *   Transforms the flat `A2UIComponent` list (adjacency list) stored in a `Surface` into a hierarchical `RenderedComponent` tree. This tree is then used for rendering.
    *   `extractComponentInfo` and `getChildrenIds` assist in this process.
*   **Data Binding (`resolveDataBindings`, `getNestedValue`, `setNestedValue`)**:
    *   Allows component properties to be dynamically linked to values within the `Surface`'s `dataModel`.
    *   Supports dot-notation paths for accessing nested data.
    *   `resolveDataBindings` is crucial during `buildComponentTree` to inject actual data values into component props.
*   **User Action Handling (`handleUserAction`, `createUserAction`)**:
    *   Processes `UserActionMessage`s originating from UI clients.
    *   Emits a `'user:action'` event, allowing other parts of the system (e.g., the agent) to react to user input.
*   **Rendering (`renderToTerminal`, `renderToHTML`)**:
    *   Provides methods to generate a textual representation of a surface (for terminal display) or a full HTML document (for browser display).
    *   These methods traverse the `RenderedComponent` tree and apply specific rendering logic for each `ComponentType`.
    *   Includes helper methods like `stylesToCSS`, `toCSSValue`, `escapeHTML`, `getDefaultCSS`, and `getClientScript` for HTML generation.
*   **Data Observation (`observeDataPath`, `notifyDataObservers`)**:
    *   Allows external modules to register callbacks that are triggered when specific paths in a surface's data model are updated. This enables reactive behavior.
*   **State Queries (`getDataValue`, `getDataModel`, `getComponent`, `getSurfaceSnapshot`)**:
    *   Provides methods for agents or other modules to inspect the current state of surfaces, their data models, and individual components.
*   **Events (`A2UIManagerEvents`)**: Extends `EventEmitter` to notify listeners about changes in surface, component, and data state.
    *   `'surface:created'`, `'surface:updated'`, `'surface:deleted'`, `'surface:rendered'`
    *   `'component:added'`, `'component:updated'`
    *   `'data:updated'`
    *   `'user:action'`
    *   `'error'`
*   **Singleton Access**: `getA2UIManager()` ensures a single instance of the manager throughout the application. `resetA2UIManager()` is available for testing.

**Execution Flow Example: Agent updates data, UI client reacts**

1.  AI Agent calls `a2uiTool.execute({ action: 'update_data', surfaceId: 'my-surface', data: { counter: 5 } })`.
2.  `A2UITool.updateData` calls `a2uiManager.processMessage({ dataModelUpdate: { surfaceId: 'my-surface', contents: { counter: 5 } } })`.
3.  `A2UIManager.processDataModelUpdate` updates `surfaces.get('my-surface').dataModel`.
4.  `A2UIManager.processDataModelUpdate` emits `'data:updated'` and calls `notifyDataObservers`.
5.  `A2UIServer` (which listens to `A2UIManager` events) receives the `'data:updated'` event.
6.  `A2UIServer.setupManagerListeners` calls `broadcastToSurface('my-surface', { dataModelUpdate: ... })`.
7.  Subscribed UI clients receive the `dataModelUpdate` WebSocket message and update their UI.

---

### `A2UIServer`: The A2UI Communication Hub

The `A2UIServer` class provides the network interface for the A2UI system, enabling real-time communication with UI clients and serving static HTML views.

**Key Responsibilities:**

*   **Server Lifecycle (`start`, `stop`, `isRunning`)**:
    *   Manages the creation and shutdown of an HTTP server (for static content) and a WebSocket server (for real-time communication).
    *   Configurable port, host, and HTTP enablement.
*   **Client Management (`handleConnection`, `handleDisconnection`)**:
    *   Assigns unique IDs to connected WebSocket clients.
    *   Tracks client subscriptions to specific A2UI surfaces.
    *   Manages client state (e.g., `lastHeartbeat`).
*   **Client Message Handling (`handleClientMessage`)**:
    *   Parses incoming WebSocket messages from clients.
    *   Dispatches messages to appropriate handlers:
        *   `handleSubscribe`, `handleUnsubscribe`: Manages client subscriptions to surfaces.
        *   `handleCanvasEvent`: Converts browser-generated UI events into `UserActionMessage`s and forwards them to the `A2UIManager`.
        *   `handleUserAction`: Forwards `UserActionMessage`s directly to the `A2UIManager`.
        *   `handleGetSurfaces`, `handleGetSurface`: Allows clients to query server-side surface state.
*   **Manager Event Listening (`setupManagerListeners`)**:
    *   Crucially, the server subscribes to events emitted by the `A2UIManager`.
    *   When the manager emits `surface:deleted`, `surface:rendered`, `component:added`, `component:updated`, or `data:updated`, the server broadcasts the corresponding `A2UIMessage` to all clients subscribed to that surface. This ensures real-time UI updates.
*   **Message Broadcasting (`sendToClient`, `broadcastToSurface`, `broadcastToAll`)**:
    *   Provides methods to send `A2UIMessage`s to individual clients or groups of clients subscribed to a surface.
*   **HTTP Endpoints (`handleHTTPRequest`)**:
    *   If `enableHTTP` is true, serves basic HTTP routes:
        *   `/`: An index page listing all active surfaces.
        *   `/surfaces`: A JSON endpoint for surface metadata.
        *   `/surface/:id`: Renders a specific A2UI surface to a full HTML page using `A2UIManager.renderToHTML`.
        *   `/health`: A simple health check endpoint.
*   **Heartbeat (`startHeartbeat`)**:
    *   Periodically sends pings to connected clients and terminates unresponsive connections to maintain a healthy client pool.
*   **Events (`A2UIServerEvents`)**: Extends `EventEmitter` to notify about server and client lifecycle events.
    *   `'client:connected'`, `'client:disconnected'`
    *   `'client:subscribed'`, `'client:unsubscribed'`
    *   `'user:action'` (forwards client actions)
    *   `'error'`, `'started'`, `'stopped'`
*   **Singleton Access**: `getA2UIServer()` ensures a single instance of the server. `resetA2UIServer()` is available for testing.

---

### `A2UITool`: Agent Interface for A2UI

The `A2UITool` class provides a high-level, simplified interface for AI agents to interact with the A2UI system without needing to understand the intricacies of the `A2UIManager` or `A2UIServer` directly.

**Key Responsibilities:**

*   **`execute(input: A2UIToolInput)`**: The main entry point for agents. It takes an `A2UIAction` and relevant parameters, then dispatches to the appropriate private method.
*   **Action Abstraction**: Each private method (e.g., `createSurface`, `addComponent`, `updateData`, `renderTerminal`, `startServer`) encapsulates the logic for a specific A2UI operation, often by calling methods on the `A2UIManager` or `A2UIServer` singletons.
*   **Input/Output Standardization**: All actions take an `A2UIToolInput` object and return an `A2UIToolResult` object, providing a consistent interface for agents.
*   **Server Control**: Includes actions to `start_server`, `stop_server`, and `server_status`, allowing agents to manage the A2UI communication layer.
*   **Querying State**: Provides actions like `get_surface`, `list_surfaces`, `get_data`, `get_component_state`, and `canvas_snapshot` for agents to inspect the current UI state.
*   **Singleton Access**: `getA2UITool()` ensures a single instance of the tool. `resetA2UITool()` is available for testing.

**Example Agent Interaction:**

```typescript
import { getA2UITool } from './a2ui-tool.js';

const a2uiTool = getA2UITool();

async function agentWorkflow() {
  // Start the A2UI server
  let result = await a2uiTool.execute({ action: 'start_server', port: 8080 });
  console.log(result.output); // "A2UI server started at http://127.0.0.1:8080..."

  // Create a new surface
  result = await a2uiTool.execute({ action: 'create_surface', surfaceId: 'dashboard-1' });
  console.log(result.output); // "Surface 'dashboard-1' created"

  // Add components
  result = await a2uiTool.execute({
    action: 'add_components',
    surfaceId: 'dashboard-1',
    components: [
      { id: 'header', type: 'heading', props: { level: 1, value: 'Welcome to Dashboard' } },
      { id: 'counter-text', type: 'text', props: { path: 'counterValue' } },
      { id: 'increment-btn', type: 'button', props: { label: 'Increment', action: { name: 'increment' } } },
    ],
  });
  console.log(result.output); // "3 component(s) added to surface 'dashboard-1'"

  // Update data model
  result = await a2uiTool.execute({ action: 'update_data', surfaceId: 'dashboard-1', data: { counterValue: 0 } });
  console.log(result.output); // "Data model updated in surface 'dashboard-1'"

  // Begin rendering
  result = await a2uiTool.execute({ action: 'begin_rendering', surfaceId: 'dashboard-1', root: 'header' });
  console.log(result.output); // "Surface 'dashboard-1' is now rendering from root 'header'"

  // Render to terminal
  result = await a2uiTool.execute({ action: 'render_terminal', surfaceId: 'dashboard-1' });
  console.log(result.output); // ASCII art representation of the UI
}

agentWorkflow();
```

---

## Canvas Manager

### `canvas-manager.ts`: Free-form Canvas Management

The `CanvasManager` class provides functionality for managing a more traditional, free-form graphical canvas, distinct from the A2UI component-based surfaces. It allows for the creation and manipulation of various `CanvasElement` types.

**Key Responsibilities:**

*   **Canvas Lifecycle (`createCanvas`, `getCanvas`, `getAllCanvases`, `deleteCanvas`)**:
    *   Manages a collection of `Canvas` objects, each with its own elements and configuration.
*   **Element Operations (`addElement`, `updateElement`, `deleteElement`, `getElement`, `getElementsByType`)**:
    *   Allows adding, modifying, and removing individual `CanvasElement`s (e.g., text, shapes, images) on a canvas.
    *   Elements have properties like `position`, `size`, `type`, `content`, and `zIndex`.
*   **Position & Size Operations (`moveElement`, `resizeElement`, `snapToGrid`, `snapSizeToGrid`)**:
    *   Provides methods to change the `position` and `size` of elements.
    *   Includes logic for snapping elements to a grid, if configured.
*   **Selection Operations (`selectElement`, `deselectElement`, `clearSelection`, `getSelectedElements`)**:
    *   Manages which elements are currently selected on a canvas, supporting single or multi-selection.
*   **Z-Order Operations (`bringToFront`, `sendToBack`)**:
    *   Adjusts the `zIndex` property of elements to control their visual stacking order.
*   **History Operations (`addHistoryEntry`, `undo`, `redo`, `canUndo`, `canRedo`)**:
    *   Implements a basic undo/redo mechanism by storing `CanvasHistoryEntry` objects for each significant action (add, update, delete).
    *   This allows users (or agents) to revert or reapply changes to the canvas.
*   **Export Functionality (`export`, `renderToSVG`, `renderToPNG`, `renderToPDF`)**:
    *   Provides methods to export the current state of a canvas into various formats:
        *   **SVG**: Generates an SVG string representation of the canvas.
        *   **PNG**: Converts the SVG to a PNG image using `@resvg/resvg-js`.
        *   **PDF**: Can generate a minimal PDF directly or use an external tool (`wkhtmltopdf`) for more complex rendering.
*   **Events**: Extends `EventEmitter` to notify listeners about changes:
    *   `'canvas-created'`, `'canvas-deleted'`, `'canvas-updated'`
    *   `'element-added'`, `'element-updated'`, `'element-deleted'`
    *   `'selection-changed'`

**Distinction from A2UI:**

It's important to note that the `CanvasManager` operates on a different model than the A2UI system.

*   **A2UI**: Focuses on structured, interactive UI components defined by a protocol, primarily for displaying information and gathering input in a programmatic way. It's about building "apps" or "dashboards."
*   **CanvasManager**: Focuses on free-form graphical elements, often for diagramming, whiteboarding, or visual organization. It's about manipulating "objects" on a drawing surface.

While both are "visual," they serve different purposes and have distinct internal representations.

---

## Integration Points and Extensibility

*   **A2UI Server & Manager**: The `A2UIServer` acts as the bridge between the `A2UIManager`'s internal state and external UI clients. It listens to all relevant `A2UIManager` events (`surface:created`, `data:updated`, etc.) and translates them into WebSocket messages for clients. Conversely, client interactions (`CanvasEventMessage`, `UserActionMessage`) are received by the server and forwarded to the manager for processing.
*   **A2UI Tool**: This class provides a high-level abstraction for AI agents, allowing them to interact with the A2UI system using simple, declarative actions without needing to directly manipulate protocol messages or manage server connections.
*   **Rendering**: The `A2UIManager`'s `renderToHTML` method is directly used by the `A2UIServer` to serve dynamic HTML pages for specific surfaces, enabling browser-based viewing of A2UI content.
*   **`canvas-manager` and `a2ui-manager`**: Currently, these two systems are largely independent. There is no direct integration where an A2UI component would directly control a `CanvasElement` or vice-versa. If such integration were desired, it would require new logic in either manager to translate between their respective models.

### How to Extend

*   **Adding New A2UI Components**:
    1.  Define the new `ComponentType` and its `Props` interface in `a2ui-types.ts`.
    2.  Add the new component to the `ComponentProps` union type.
    3.  Implement rendering logic for the new component type in `A2UIManager.renderNodeToTerminal` and `A2UIManager.renderNodeToHTML`.
    4.  If the component is interactive, ensure `A2UIServer.getClientScript` includes event listeners for it, converting client-side events into `CanvasEventMessage`s or `UserActionMessage`s.
*   **Adding New A2UI Actions for Agents**:
    1.  Add the new action name to the `A2UIAction` type in `a2ui-tool.ts`.
    2.  Implement a new private method in `A2UITool` to handle the action, calling the appropriate `A2UIManager` or `A2UIServer` methods.
    3.  Add a `case` for the new action in `A2UITool.execute`.
*   **Extending `CanvasManager` Elements**:
    1.  Define new `CanvasElementType` and its properties in `types.ts` (the one imported by `canvas-manager.ts`).
    2.  Implement rendering logic for the new element type in `CanvasManager.elementToSVG` (and potentially `renderToPNG`, `renderToPDF`).
    3.  Add methods to `CanvasManager` for creating/manipulating this new element type.