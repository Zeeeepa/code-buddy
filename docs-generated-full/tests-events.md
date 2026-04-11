---
title: "tests — events"
module: "tests-events"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.890Z"
---
# tests — events

This document describes the core components of the `src/events` module, as revealed and validated by the `tests/events/event-bus.test.ts` test suite. This module provides a robust, type-safe eventing system designed for internal application communication, offering features like event history, statistics, listener prioritization, and filtering.

## Overview

The `src/events` module provides a flexible and type-safe way to manage events within the application. It centers around the `TypedEventEmitter` class, which offers enhanced capabilities over standard Node.js `EventEmitter`s, including strong typing for event names and payloads, event history, and performance statistics. A global `EventBus` is provided for application-wide communication, and utility type guards help with runtime event type narrowing.

### Core Concepts

*   **`BaseEvent`**: The fundamental interface for all events, requiring at least a `type` string and a `timestamp`.
*   **Event Types**: Events are categorized by their `type` string (e.g., `tool:started`, `agent:completed`). The module defines various event interfaces (e.g., `ToolEvent`, `AgentEvent`, `SessionEvent`) which extend `BaseEvent` and add specific properties.
*   **`AllEvents`**: A union type representing all possible events in the system, used by the global `EventBus`.

## Key Components

### 1. `TypedEventEmitter<TEventMap>`

The `TypedEventEmitter` is the foundational class for event management. It's a generic class where `TEventMap` is an interface mapping event names (strings) to their corresponding event data types.

**Features:**

*   **Type-Safe Event Handling**: Listeners are strongly typed based on the `TEventMap` provided.
    ```typescript
    type ToolEvents = {
      'tool:started': { toolName: string; args: Record<string, any> };
      'tool:completed': { toolName: string; duration: number };
    };
    const emitter = new TypedEventEmitter<ToolEvents>();

    emitter.on('tool:started', (event) => {
      // event is correctly typed as { toolName: string; args: Record<string, any> }
      console.log(`Tool ${event.toolName} started.`);
    });
    emitter.emit('tool:completed', { toolName: 'search', duration: 100 });
    ```
*   **`on(type, listener, options?)`**: Registers a listener for a specific event type.
    *   `options.priority`: Listeners with higher priority values are executed first.
    *   `options.filter`: A predicate function `(event) => boolean` that must return `true` for the listener to be invoked.
*   **`once(type, listener)`**: Registers a listener that will be invoked only once for the specified event type.
*   **`off(listenerId)`**: Removes a specific listener using the ID returned by `on` or `once`.
*   **`offAll(type?)`**: Removes all listeners for a given event `type`, or all listeners across all types if no `type` is provided.
*   **`emit(type, event)`**: Emits an event. Returns `true` if there were listeners for the event, `false` otherwise.
*   **`onAny(listener)`**: Registers a wildcard listener that receives all emitted events, regardless of type.
*   **Event History**:
    *   `getHistory()`: Returns an array of recently emitted events, including their timestamp and the event object.
    *   `clearHistory()`: Clears the stored event history.
    *   `maxHistorySize`: Configurable option during instantiation to limit the history size.
*   **Statistics**:
    *   `getStats()`: Returns an object containing `totalEmitted`, `totalListeners`, and `eventCounts` (a map of event types to their emission counts).
    *   `resetStats()`: Resets the emission counts, but preserves listener counts.
*   **Control**:
    *   `setEnabled(enabled: boolean)`: Enables or disables event emission. When disabled, `emit` calls are ignored.
    *   `isEnabled()`: Checks the current enabled state.
*   **`eventNames()`**: Returns an array of event types for which listeners are currently registered.
*   **`listenerCount(type?)`**: Returns the number of listeners for a specific event `type`, or the total number of listeners if no `type` is provided.
*   **`waitFor(type, options?)`**: Returns a `Promise` that resolves with the next event of the specified `type`.
    *   `options.timeout`: An optional timeout in milliseconds, after which the promise will reject if the event is not received.
*   **`pipe(type, targetEmitter)`**: Forwards all events of a specific `type` from this emitter to another `TypedEventEmitter` instance.
*   **`dispose()`**: Cleans up internal resources, removing all listeners and clearing history/stats. Essential for preventing memory leaks, especially in long-running processes or when emitters are short-lived.

### 2. `FilteredEventEmitter<TEvent>`

The `FilteredEventEmitter` provides a mechanism to create a specialized emitter that only processes events from a source `TypedEventEmitter` that match a specific type and an additional filter function.

*   **Creation**: Instances are created via `TypedEventEmitter.filter(eventType, filterFn)`.
*   **Usage**: It exposes `on`, `once`, `off`, and `offAll` methods similar to `TypedEventEmitter`, but these methods only apply to the events that pass the initial type and the `filterFn` provided during its creation.

```typescript
const emitter = new TypedEventEmitter<ToolEvents>();
const bashToolEvents = emitter.filter('tool:started', (event) => event.toolName === 'bash');

bashToolEvents.on((event) => {
  // This listener only receives 'tool:started' events where toolName is 'bash'
  console.log(`Bash tool started: ${event.args.command}`);
});

emitter.emit('tool:started', { toolName: 'bash', args: { command: 'ls' } }); // Received by bashToolEvents listener
emitter.emit('tool:started', { toolName: 'search', args: { query: 'foo' } }); // Not received
```

### 3. `EventBus`

The `EventBus` is a singleton instance of `TypedEventEmitter<AllEvents>`, serving as the central hub for application-wide events.

*   **`EventBus.getInstance()`**: Retrieves the singleton instance of the `EventBus`.
*   **`EventBus.resetInstance()`**: Resets the singleton instance, creating a new one on the next `getInstance()` call. This is primarily used for testing to ensure isolation between test runs.
*   **`getGlobalEventBus()` / `getEventBus()`**: Convenience functions that simply return `EventBus.getInstance()`.
*   **`resetEventBus()`**: Convenience function that calls `EventBus.resetInstance()`.

### 4. `TypedEventEmitterAdapter<TEventMap>`

This class acts as an adapter, wrapping a `TypedEventEmitter` instance and exposing both its type-safe API (`onTyped`, `emitTyped`, etc.) and the standard Node.js `EventEmitter` API (`on`, `emit`). This allows for interoperability with code that expects a native `EventEmitter` while still leveraging the type safety and advanced features of `TypedEventEmitter` internally.

*   **`onTyped(type, listener)` / `onceTyped(...)` / `offTyped(...)` / `emitTyped(...)`**: The type-safe methods, delegating to the internal `TypedEventEmitter`.
*   **`on(event, listener)` / `emit(event, ...args)`**: The native `EventEmitter` methods.
*   **`getTypedEmitter()`**: Returns the underlying `TypedEventEmitter` instance.
*   **`getEventStats()` / `getEventHistory()`**: Proxies to the underlying `TypedEventEmitter`'s methods.
*   **`dispose()`**: Cleans up the internal `TypedEventEmitter`.

### 5. Type Guards

The module provides several type guard functions to safely narrow down the type of a `BaseEvent` at runtime. These are crucial when working with `AllEvents` or `BaseEvent` unions, allowing you to access specific properties of an event without type assertions.

*   **`isEventType(event, type)`**: Checks if an event's `type` property matches a given string literal.
*   **`isAgentEvent(event)`**: Narrows `event` to `AgentEvent` if its type starts with `'agent:'`.
*   **`isToolEvent(event)`**: Narrows `event` to `ToolEvent` if its type starts with `'tool:'`.
*   **`isSessionEvent(event)`**: Narrows `event` to `SessionEvent` if its type starts with `'session:'`.
*   **`isFileEvent(event)`**: Narrows `event` to `FileEvent` if its type starts with `'file:'`.
*   **`isCacheEvent(event)`**: Narrows `event` to `CacheEvent` if its type starts with `'cache:'`.
*   **`isSyncEvent(event)`**: Narrows `event` to `SyncEvent` if its type starts with `'sync:'`.

```typescript
import { getGlobalEventBus, isToolEvent, AllEvents } from './events';

const bus = getGlobalEventBus();

bus.onAny((event: AllEvents) => {
  if (isToolEvent(event)) {
    // event is now safely typed as ToolEvent
    console.log(`Tool event: ${event.toolName} - Type: ${event.type}`);
  } else {
    console.log(`Other event: ${event.type}`);
  }
});
```

## Component Relationships

The following diagram illustrates the relationships between the main eventing components:

```mermaid
classDiagram
    class EventEmitter {
        +on(event, listener)
        +emit(event, ...args)
    }
    class TypedEventEmitter<T> {
        +on(type, listener, options)
        +emit(type, event)
        +getHistory()
        +getStats()
        +filter(type, filterFn) FilteredEventEmitter
        +waitFor(type, options) Promise<Event>
        +pipe(type, target)
        +dispose()
    }
    class FilteredEventEmitter<TEvent> {
        +on(listener)
        +once(listener)
        +off(id)
        +offAll()
    }
    class EventBus {
        +getInstance() EventBus
        +resetInstance()
    }
    class TypedEventEmitterAdapter<T> {
        +onTyped(type, listener)
        +emitTyped(type, event)
        +getTypedEmitter() TypedEventEmitter<T>
    }

    TypedEventEmitter <|-- EventBus : extends
    TypedEventEmitterAdapter o-- TypedEventEmitter : aggregates
    EventEmitter <|-- TypedEventEmitterAdapter : extends (conceptual)
    TypedEventEmitter ..> FilteredEventEmitter : creates
```

*   `EventBus` extends `TypedEventEmitter`, inheriting all its capabilities but specifically typed for `AllEvents`.
*   `TypedEventEmitterAdapter` aggregates a `TypedEventEmitter` internally and conceptually extends `EventEmitter` to provide both typed and untyped interfaces.
*   `TypedEventEmitter` is responsible for creating `FilteredEventEmitter` instances.

## Usage Patterns and Best Practices

*   **Use `TypedEventEmitter` for module-specific events**: When events are confined to a particular module or component, instantiate a `TypedEventEmitter` with the relevant `TEventMap`.
*   **Use `EventBus` for global events**: For events that need to be broadcast across different parts of the application, use the `getGlobalEventBus()` singleton.
*   **Always `dispose()`**: If you create `TypedEventEmitter` or `TypedEventEmitterAdapter` instances that are not long-lived (e.g., within a function scope or a component that gets destroyed), ensure you call `dispose()` to clean up listeners and prevent memory leaks.
*   **Leverage Type Guards**: When consuming events from the `EventBus` (which emits `AllEvents`), use the provided type guards to safely narrow down event types and access specific properties.
*   **Prioritize Listeners**: Use the `priority` option in `on()` for listeners that need to execute in a specific order (e.g., logging before processing).
*   **Filter at the Listener Level**: For fine-grained control over which events a listener receives, use the `filter` option in `on()` or create a `FilteredEventEmitter`.
*   **Asynchronous Event Handling**: `waitFor()` is useful for scenarios where you need to pause execution until a specific event occurs, with built-in timeout handling.