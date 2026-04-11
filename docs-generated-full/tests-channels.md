---
title: "tests — channels"
module: "tests-channels"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.835Z"
---
# tests — channels

This document provides an overview of the `tests/channels` module, which is dedicated to ensuring the robustness, correctness, and integration of the application's multi-channel communication capabilities. It covers unit tests for core channel abstractions, integration tests for specific channel implementations, and validation of critical features like DM pairing and policy enforcement.

## Module Overview

The `tests/channels` module serves as the primary testing ground for all channel-related logic. It encompasses:

1.  **Core Channel Abstractions**: Validating the `BaseChannel` interface, `MockChannel` utility, and the central `ChannelManager`.
2.  **Individual Channel Implementations**: Ensuring that specific channels (e.g., Discord, Google Chat, Feishu) correctly interact with their respective APIs and translate messages to/from the internal `InboundMessage` and `OutboundMessage` formats.
3.  **DM Pairing and Policy**: Thoroughly testing the security mechanisms for direct messages, including user approval flows and content-based policy enforcement.
4.  **Command Handlers Integration**: Verifying that CLI commands related to channel management (`handleChannels`, `handlePairing`) function as expected.

The tests utilize `vitest` for its testing framework, `vi.mock` for mocking external dependencies (like `fs`, `os`, `fetch`, `ws`), and `jest.fn()` for spying on method calls and tracking events.

## Core Channel Abstractions Testing (`channels.test.ts`)

This file focuses on the fundamental building blocks of the channel system: `MockChannel` and `ChannelManager`.

### `MockChannel`

The `MockChannel` is a crucial utility for isolating channel logic during testing. It implements the `BaseChannel` interface but provides in-memory storage for sent and received messages, and methods to simulate inbound messages and events.

**Key functionalities tested:**

*   **Connection Lifecycle**: `connect()` and `disconnect()` methods, and their corresponding `connected` and `disconnected` events.
*   **Message Handling**:
    *   `send()`: Verifies that outbound messages are correctly tracked.
    *   `simulateMessage()`: Allows injecting arbitrary `InboundMessage` objects, including parsing commands (`/help arg1 arg2`).
    *   `getMessages()` and `getSentMessages()`: Accessors for inspecting message history.
*   **Filtering**: `isUserAllowed()` and `isChannelAllowed()` based on channel configuration.
*   **State Management**: `clear()` for resetting message logs.

### `ChannelManager`

The `ChannelManager` is the central orchestrator for all active channels. Its tests ensure it correctly manages multiple channels, routes messages, and handles global events.

**Key functionalities tested:**

*   **Channel Registration**: `registerChannel()`, `unregisterChannel()`, `getChannel()`, `getAllChannels()`.
*   **Global Operations**: `connectAll()`, `disconnectAll()`, `shutdown()`.
*   **Status Reporting**: `getStatus()` provides an aggregate view of all channels.
*   **Message Routing**:
    *   `send(channelType, message)`: Directs an `OutboundMessage` to a specific channel.
    *   `broadcast(message)`: Sends an `OutboundMessage` to all connected channels.
*   **Event Forwarding**: Ensures `message` and `command` events from individual channels are re-emitted by the manager.
*   **Message Handlers**: `onMessage()` callback registration.
*   **Singleton Pattern**: `getChannelManager()` and `resetChannelManager()` are tested to confirm the singleton behavior and proper resetting for isolated tests.

### Message Types and Options

The tests also validate the structure and handling of `InboundMessage` and `OutboundMessage` objects, including:

*   `contentType` (text, image, file)
*   `attachments`
*   `replyTo`, `threadId`
*   `sender` and `channel` metadata
*   `parseMode`, `buttons`, `silent`, `disablePreview` for outbound messages.

### Session Key

The `getSessionKey()` utility, crucial for session isolation, is tested to ensure it generates consistent keys for messages from the same source (channel + sender) and different keys for different sources.

## DM Pairing and Policy Testing

These sections cover the security and moderation features for direct messages, which are critical for controlling bot access and behavior.

### `DMPairingManager` (`dm-pairing.test.ts`)

The `DMPairingManager` handles the approval process for direct message senders.

**Key functionalities tested:**

*   **Pairing Code Generation**: `checkSender()` generates unique, time-limited codes for unknown DM senders.
*   **Approval Flow**: `approve(channelType, code)` validates a code and marks a sender as approved. `approveDirectly()` allows programmatic approval.
*   **Revocation**: `revoke(channelType, senderId)` removes a sender's approval.
*   **Blocking**: Senders are blocked after `maxAttempts` to prevent brute-force attacks on pairing codes.
*   **Query Methods**: `listApproved()`, `listPending()`, `isApproved()`, `requiresPairing()`.
*   **Configuration**: Tests for `enabled` state, `codeLength`, `codeExpiryMs`, `maxAttempts`, `blockDurationMs`, `autoApproveCli`.
*   **Events**: `pairing:approved` and `pairing:revoked` events.
*   **Persistence**: Although disabled for tests, the `allowlistPath` configuration is acknowledged.
*   **Singleton**: `getDMPairing()` and `resetDMPairing()` are tested.

### DM Pairing Integration (`dm-pairing-integration.test.ts`)

This file tests the end-to-end flow of DM pairing, including its interaction with the `ChannelManager` and the `/pairing` command handler.

**Key integration points tested:**

*   **`checkDMPairing` Helper**: Validates that the helper correctly rejects unknown DM senders on pairing-enabled channels, approves paired senders, and always approves group messages or messages from non-pairing channels.
*   **Full Pairing Lifecycle**: A scenario covering an unknown user sending a DM, generating a code, the owner approving via the CLI, and subsequent revocation.
*   **`/pairing` Command Handler**: `handlePairing()` is tested for all its sub-commands: `help`, `status`, `list`, `pending`, `approve`, `revoke`. This ensures the CLI interface for managing DM pairing works correctly.
*   **Multi-channel Isolation**: Verifies that pairing approvals are isolated per channel (e.g., approving a user on Telegram does not approve them on Discord).
*   **`ChannelManager` Gating**: Confirms that the `ChannelManager`'s message handler correctly applies DM pairing checks, but does not block messages from channels like `cli` that don't require pairing.

### DM Policy Engine (`dm-policy/engine.test.ts`)

The `DMPolicyEngine` allows defining rules to manage inbound message flow based on various criteria and sender reputation.

**Key functionalities tested:**

*   **Rule Management**: `addRule()`, `removeRule()`, `enableRule()`, `disableRule()`, `getRule()`, `getAllRules()`, `getSortedRules()`. Rules are sorted by priority.
*   **Policy Evaluation**: `evaluate(context)` processes messages against defined rules.
    *   **Conditions**: Tests various condition types (`sender`, `channel`, `content` with `contains`/`match` regex, `first_contact`, `attachment`, `keyword`, `reputation`) and operators (`eq`, `gte`, `negate`).
    *   **Actions**: `allow`, `deny`, `queue`, `challenge`, `forward`.
    *   **AND Logic**: All conditions in a rule must match.
    *   **Default Action**: What happens when no rule matches.
*   **Reputation Management**:
    *   `getReputation()`: Creates and retrieves sender reputation profiles.
    *   `updateReputation()`: Adjusts scores and flags based on interactions, with min/max caps.
    *   `blockSender()`, `unblockSender()`, `trustSender()`, `markSuspicious()`: Specific reputation actions.
*   **Reputation-based Rules**: Rules that trigger based on a sender's reputation score.
*   **Events**: `rule:added`, `decision:made`, `reputation:updated`, `sender:blocked`, `challenge:issued`.
*   **Statistics**: `getStats()` provides insights into rules, tracked senders, blocked senders, and trusted senders.

## Individual Channel Integration Tests

These tests validate the specific implementations of various communication channels, often involving mocking external API calls or WebSocket interactions.

### DiscordChannel (`discord.test.ts`)

Tests the `DiscordChannel`'s interaction with the Discord API.

**Key functionalities tested:**

*   **Configuration**: Constructor validation (e.g., token requirement).
*   **Status**: `getStatus()`.
*   **Disconnect**: Emits `disconnected` event.
*   **Message Sending**: `send()` for text messages, messages with buttons (components), and replies. Mocks `fetch` for Discord API calls.
*   **Interaction Handling**: `respondToInteraction()`, `deferInteraction()`, `editInteractionResponse()` for Discord's interactive components.
*   **Message Operations**: `editMessage()`, `deleteMessage()`, `addReaction()`, `sendTyping()`.
*   **User Filtering**: `isUserAllowed()` based on configured `allowedUsers`.
*   **Intents Calculation**: `getIntents()` correctly calculates the Discord Gateway intents bitmask.
*   **WebSocket Mocking**: Uses `MockWebSocket` to simulate Discord Gateway events (though not extensively shown in the provided snippet, it's a common pattern for Discord tests).

### GoogleChatChannel (`google-chat.test.ts`)

Tests the `GoogleChatChannel`'s integration with Google Chat, focusing on authentication and webhook handling.

**Key functionalities tested:**

*   **Configuration**: Service account path and optional `spaceId`, `verificationToken`.
*   **Connection Lifecycle**: `connect()` and `disconnect()`, including loading service account, JWT assertion generation, OAuth token exchange, and listing spaces.
*   **JWT Auth Token**: Verifies that JWT assertions are correctly generated and exchanged for access tokens, and that tokens are cached and refreshed.
*   **Message Sending**: `send()` for text messages, thread replies, and messages with URL or callback buttons (using Google Chat's `cardsV2` format).
*   **Webhook Handling (`handleWebhook`)**:
    *   **Verification Token**: Ensures events are rejected/accepted based on `verificationToken`.
    *   **`MESSAGE` Events**: Parses inbound messages, detects DM vs. group, handles `argumentText` (stripping mentions), ignores bot messages, applies user/channel filters, and processes attachments.
    *   **`ADDED_TO_SPACE` Events**: Returns a greeting and caches the new space.
    *   **`REMOVED_FROM_SPACE` Events**: Removes the space from cache.
    *   **`CARD_CLICKED` Events**: Emits `command` events with action details.
    *   **Slash Commands**: Detects and parses slash commands from `slashCommand` annotations or message text.
*   **Space Management**: `getSpace()` for retrieving cached space information.

### FeishuAdapter (`feishu-cards.test.ts`)

Tests the `FeishuAdapter`'s specific features like interactive cards and reasoning streams.

**Key functionalities tested:**

*   **Interactive Cards**: `buildApprovalCard()` and `buildActionLauncherCard()` generate valid Feishu card JSON structures, including headers, elements, and actions.
*   **Reasoning Streams**: `onReasoningStream()` and `onReasoningEnd()` handlers are tested to ensure they correctly receive streaming chunks and final reasoning text. Multiple handlers and error resilience are also verified.
*   **Thread Context**: `getThreadMessages()` is tested for basic functionality and error handling when the adapter is not running.

## `handleChannels` Command Handler (`channel-handlers-additional-channels.test.ts`)

This file specifically tests the `handleChannels` command handler, which is responsible for starting and stopping *real* channel implementations based on configuration.

**Key functionalities tested:**

*   **Channel Activation**: Iterates through a comprehensive list of `ChannelType`s (WhatsApp, Signal, Matrix, Google Chat, Teams, Line, Nostr, Zalo, Mattermost, Nextcloud Talk, Twilio Voice, iMessage).
*   **Real Implementation**: Verifies that `handleChannels('start', ...)` instantiates the actual channel class (e.g., `WhatsAppChannel`), not a `MockChannel`.
*   **Connection Status**: Asserts that the activated channel's `getStatus().connected` is `true` after `start`.
*   **Lifecycle Management**: Ensures `handleChannels('stop', ...)` correctly disconnects the channel.
*   **Mocking `connect`**: For channels that require external connections, `mockConnect` is used to spy on their `connect` method and simulate a successful connection without actual network calls.

## Conclusion

The `tests/channels` module provides comprehensive validation for the application's communication layer. By combining unit tests for core abstractions, detailed integration tests for individual channel implementations, and end-to-end scenarios for critical features like DM pairing and policy, it ensures that the bot can reliably interact across various platforms while maintaining security and control.