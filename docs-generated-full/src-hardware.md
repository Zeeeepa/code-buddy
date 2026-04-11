---
title: "src — hardware"
module: "src-hardware"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.512Z"
---
# src — hardware

The `src/hardware` module provides robust GPU monitoring capabilities, primarily focused on VRAM usage for local Large Language Model (LLM) inference. Its core component, `GPUMonitor`, offers real-time insights into GPU memory, utilization, and temperature, supporting various GPU vendors. This module is crucial for optimizing LLM performance by preventing Out-Of-Memory (OOM) errors through dynamic offloading recommendations.

## Module Overview

The `src/hardware` module exports the `GPUMonitor` class and related utility functions and types. Its primary goal is to abstract away the complexities of querying different GPU hardware (NVIDIA, AMD, Apple Silicon, Intel) and provide a unified interface for monitoring and making informed decisions about LLM layer offloading.

**Key Responsibilities:**

*   **GPU Vendor Detection**: Automatically identifies the underlying GPU hardware.
*   **VRAM Monitoring**: Gathers real-time statistics on total, used, and free VRAM.
*   **Performance Metrics**: Collects GPU utilization, temperature, and power draw where available.
*   **Threshold Alerts**: Emits events when VRAM usage crosses warning or critical levels.
*   **Offloading Recommendations**: Calculates optimal GPU layer counts for LLMs based on available VRAM.
*   **Multi-GPU Support**: Aggregates statistics across multiple detected GPUs.

## Core Concepts

The module defines several interfaces and types to structure the data it handles:

*   **`GPUVendor`**: A union type (`"nvidia" | "amd" | "intel" | "apple" | "unknown"`) representing the detected GPU manufacturer.
*   **`GPUInfo`**: Detailed information for a single GPU, including `id`, `name`, `vendor`, `vramTotal`, `vramUsed`, `vramFree`, `utilization`, `temperature`, and `powerDraw`.
*   **`VRAMStats`**: Aggregated VRAM statistics across all detected GPUs, including `totalVRAM`, `usedVRAM`, `freeVRAM`, `usagePercent`, `gpuCount`, and an array of `GPUInfo` objects.
*   **`OffloadRecommendation`**: Provides guidance on how many LLM layers to offload to the GPU, including `shouldOffload`, `suggestedGpuLayers`, `maxGpuLayers`, `reason`, `estimatedVRAMUsage`, and `safeVRAMLimit`.
*   **`GPUMonitorConfig`**: Configuration options for the monitor, such as `pollInterval`, `warningThreshold`, `criticalThreshold`, `autoPoll`, and `safeBuffer`. The `DEFAULT_GPU_MONITOR_CONFIG` provides sensible defaults.

## The `GPUMonitor` Class

The `GPUMonitor` class is the central component of this module. It extends `EventEmitter`, allowing other parts of the application to subscribe to VRAM status updates and warnings.

### Initialization and Vendor Detection

Before monitoring can begin, the `GPUMonitor` must be initialized to detect the available GPU hardware.

1.  **`constructor(config?: Partial<GPUMonitorConfig>)`**: Initializes the monitor with default or provided configuration.
2.  **`async initialize(): Promise<GPUVendor>`**: This is the entry point for setting up the monitor. It calls `detectGPUVendor()` to identify the GPU type. If `autoPoll` is enabled in the config, it will then call `startPolling()`.
3.  **`private async detectGPUVendor(): Promise<GPUVendor>`**: This method attempts to identify the GPU vendor by executing various system commands:
    *   `nvidia-smi --version` for NVIDIA.
    *   `rocm-smi --version` or `ls /sys/class/drm/card*/device/vendor` for AMD.
    *   `ls /sys/class/drm/card*/device/vendor` for Intel.
    *   `sysctl -n machdep.cpu.brand_string` for Apple Silicon.
    It prioritizes NVIDIA and AMD (ROCm) as they are common for ML workloads.

### VRAM Monitoring and Data Collection

Once initialized, the monitor can query GPU statistics.

1.  **`async getStats(): Promise<VRAMStats>`**: This is the primary method to retrieve current VRAM statistics. It orchestrates the vendor-specific queries and aggregates the results into a `VRAMStats` object. It also calls `checkThresholds()` and caches the result in `lastStats`.
2.  **`private async queryGPUs(): Promise<GPUInfo[]>`**: This internal method acts as a dispatcher, calling the appropriate vendor-specific query function based on the `detectedVendor`.
3.  **Vendor-Specific Query Methods**:
    *   **`private async queryNVIDIA(): Promise<GPUInfo[]>`**: Uses `nvidia-smi` with a specific query format (`--query-gpu=... --format=csv,noheader,nounits`) to parse detailed GPU information.
    *   **`private async queryAMD(): Promise<GPUInfo[]>`**: First attempts to use `rocm-smi --showmeminfo vram --json`. If `rocm-smi` is not available or fails, it falls back to reading VRAM information directly from `/sys/class/drm/card*/device/` files (Linux sysfs).
    *   **`private async queryApple(): Promise<GPUInfo[]>`**: For Apple Silicon, which uses unified memory, it estimates GPU VRAM by querying `hw.memsize` (total RAM) and `memory_pressure` to gauge overall memory usage. It assumes the GPU can utilize a significant portion of system RAM.
    *   **`private async queryIntel(): Promise<GPUInfo[]>`**: For Intel integrated GPUs, it estimates available VRAM based on system RAM (`/proc/meminfo`) and a conservative assumption of 1-2GB dedicated to the iGPU.
    *   **`private async queryGeneric(): Promise<GPUInfo[]>`**: A fallback method that returns a conservative estimate (e.g., 4GB total VRAM) if no specific vendor is detected or queried successfully.

#### `getStats` Execution Flow

```mermaid
graph TD
    A[GPUMonitor.getStats()] --> B{Detected Vendor?};
    B -- nvidia --> C[queryNVIDIA()];
    B -- amd --> D[queryAMD()];
    B -- apple --> E[queryApple()];
    B -- intel --> F[queryIntel()];
    B -- unknown --> G[queryGeneric()];
    C,D,E,F,G --> H[Aggregate GPUInfo into VRAMStats];
    H --> I[Check Thresholds];
    I --> J[Emit Events (vram:warning, vram:critical)];
    J --> K[Return VRAMStats];
```

### Automatic Polling and Events

The monitor can be configured to automatically poll for VRAM updates at a set interval.

1.  **`startPolling(): void`**: Initiates a `setInterval` timer that periodically calls `getStats()` and emits a `vram:update` event with the latest `VRAMStats`.
2.  **`stopPolling(): void`**: Clears the polling timer, stopping automatic updates.
3.  **`private checkThresholds(stats: VRAMStats): void`**: Called by `getStats()`, this method compares the current `usagePercent` against `warningThreshold` and `criticalThreshold` from the configuration, emitting `vram:warning` or `vram:critical` events as appropriate.

**Emitted Events:**

*   `vram:update`: (stats: `VRAMStats`) — Emitted on every successful poll.
*   `vram:warning`: (stats: `VRAMStats`) — Emitted when VRAM usage exceeds the `warningThreshold`.
*   `vram:critical`: (stats: `VRAMStats`) — Emitted when VRAM usage exceeds the `criticalThreshold`.

### Offloading Recommendations

A key feature for LLM inference is the ability to recommend how many model layers can safely reside on the GPU.

1.  **`calculateOffloadRecommendation(modelSizeMB: number, totalLayers: number, contextSize: number): OffloadRecommendation`**: This method takes model parameters (size, total layers, context size) and calculates an `OffloadRecommendation`. It estimates VRAM per layer (considering model weights and KV cache) and determines how many layers can fit within the `safeVRAMLimit` (total VRAM minus a configured `safeBuffer`).
2.  **`async getRecommendedLayers(modelSize: "3b" | "7b" | "13b" | "30b" | "70b"): Promise<number>`**: A convenience method that uses predefined approximate model sizes and layer counts for common LLM sizes (e.g., "7b", "13b") to return a suggested number of GPU layers.

### Reporting and Utilities

The monitor also provides methods for displaying its status.

1.  **`formatStats(): string`**: Generates a human-readable string summary of the last VRAM statistics, including a progress bar for each GPU.
2.  **`private createProgressBar(percent: number, width: number): string`**: An internal helper to generate an ASCII progress bar with color-coded emojis based on usage thresholds.

### Configuration and Lifecycle Management

1.  **`updateConfig(config: Partial<GPUMonitorConfig>): void`**: Allows runtime modification of the monitor's configuration.
2.  **`getConfig(): GPUMonitorConfig`**: Returns the current configuration.
3.  **`getVendor(): GPUVendor`**: Returns the detected GPU vendor.
4.  **`getLastStats(): VRAMStats | null`**: Returns the last cached VRAM statistics.
5.  **`dispose(): void`**: Cleans up the monitor by stopping polling and removing all event listeners.

## Singleton Management

The module provides helper functions to manage a singleton instance of `GPUMonitor`, ensuring consistent state across the application.

*   **`getGPUMonitor(config?: Partial<GPUMonitorConfig>): GPUMonitor`**: Returns the singleton `GPUMonitor` instance. If one doesn't exist, it creates it.
*   **`async initializeGPUMonitor(config?: Partial<GPUMonitorConfig>): Promise<GPUMonitor>`**: A convenience function to get the singleton instance and then call its `initialize()` method. This is the recommended way to start the monitor.
*   **`resetGPUMonitor(): void`**: Disposes of the current singleton instance and sets it to `null`, allowing a new instance to be created on the next `getGPUMonitor` call. This is useful for testing or re-initializing with different configurations.

## Integration with Other Modules

The `GPUMonitor` is designed to be a foundational service for other parts of the application that need hardware awareness, particularly for LLM inference.

### `src/models/model-hub.ts`

The `model-hub.ts` module, responsible for managing LLM models, directly interacts with the `GPUMonitor` to make intelligent decisions:

*   **`getRecommendedModel`**: Uses `getGPUMonitor`, `initialize`, and `getStats` to understand available VRAM and recommend suitable models or configurations.
*   **`selectQuantization`**: Leverages `getGPUMonitor`, `initialize`, and `getStats` to help determine the optimal quantization level for a model based on the system's VRAM capacity.
*   **`formatRecommendations`**: Likely uses `getGPUMonitor`, `initialize`, and `getStats` to present hardware-aware recommendations to the user.

This integration ensures that LLM loading and execution are optimized for the specific hardware environment, reducing the risk of OOM errors and improving performance.

## Usage Example

```typescript
import { initializeGPUMonitor, getGPUMonitor, GPUMonitorConfig } from "./hardware/gpu-monitor.js";

async function main() {
  // Initialize the monitor (detects GPU, starts polling if autoPoll is true)
  const monitor = await initializeGPUMonitor({
    autoPoll: true,
    pollInterval: 2000, // Poll every 2 seconds
    warningThreshold: 70,
    criticalThreshold: 90,
    safeBuffer: 1024, // Keep 1GB free
  });

  console.log(`Detected GPU Vendor: ${monitor.getVendor()}`);

  // Subscribe to VRAM updates
  monitor.on("vram:update", (stats) => {
    console.log(`VRAM Update: ${stats.usagePercent.toFixed(1)}% used`);
    // console.log(monitor.formatStats()); // Uncomment for detailed output
  });

  // Subscribe to warning/critical events
  monitor.on("vram:warning", (stats) => {
    console.warn(`🚨 VRAM Warning: ${stats.usagePercent.toFixed(1)}% used!`);
  });

  monitor.on("vram:critical", (stats) => {
    console.error(`🔥 VRAM CRITICAL: ${stats.usagePercent.toFixed(1)}% used! Immediate action needed.`);
  });

  // Get current stats immediately
  const currentStats = await monitor.getStats();
  console.log("\nInitial GPU Status:");
  console.log(monitor.formatStats());

  // Calculate offloading recommendation for a 7B model (approx 4000MB, 32 layers)
  const modelSizeMB = 4000; // e.g., 7B Q4
  const totalLayers = 32;
  const contextSize = 4096;

  const recommendation = monitor.calculateOffloadRecommendation(modelSizeMB, totalLayers, contextSize);
  console.log("\nOffloading Recommendation for 7B Model:");
  console.log(`  Should Offload: ${recommendation.shouldOffload}`);
  console.log(`  Suggested GPU Layers: ${recommendation.suggestedGpuLayers}/${recommendation.maxGpuLayers}`);
  console.log(`  Reason: ${recommendation.reason}`);
  console.log(`  Estimated VRAM Usage: ${recommendation.estimatedVRAMUsage.toFixed(0)}MB`);
  console.log(`  Safe VRAM Limit: ${recommendation.safeVRAMLimit}MB`);

  // Get recommended layers for a common model size
  const recommendedLayers7B = await monitor.getRecommendedLayers("7b");
  console.log(`\nRecommended layers for a '7b' model: ${recommendedLayers7B}`);

  // Simulate some work...
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Stop polling and dispose when done
  monitor.dispose();
  console.log("\nGPU Monitor disposed.");
}

main().catch(console.error);
```