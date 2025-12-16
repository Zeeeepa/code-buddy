/**
 * Hardware Module
 *
 * GPU monitoring and hardware management for local LLM inference.
 */

export {
  GPUMonitor,
  getGPUMonitor,
  initializeGPUMonitor,
  resetGPUMonitor,
  DEFAULT_GPU_MONITOR_CONFIG,
  type GPUVendor,
  type GPUInfo,
  type VRAMStats,
  type OffloadRecommendation,
  type GPUMonitorConfig,
} from "./gpu-monitor.js";
