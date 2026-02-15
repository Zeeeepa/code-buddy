/**
 * Device Node System
 *
 * Manages paired device nodes (macOS, iOS, Android) with capabilities
 * like camera, screen recording, location, notifications, and system commands.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type DeviceType = 'macos' | 'ios' | 'android';

export type DeviceCapability = 'camera' | 'screen_record' | 'location' | 'notifications' | 'system_run';

export interface DeviceNode {
  id: string;
  name: string;
  type: DeviceType;
  capabilities: DeviceCapability[];
  paired: boolean;
  lastSeen: number;
  address?: string;
}

export interface LocationCoords {
  lat: number;
  lon: number;
}

// ============================================================================
// DeviceNodeManager
// ============================================================================

export class DeviceNodeManager {
  private static instance: DeviceNodeManager | null = null;
  private devices: Map<string, DeviceNode> = new Map();

  static getInstance(): DeviceNodeManager {
    if (!DeviceNodeManager.instance) {
      DeviceNodeManager.instance = new DeviceNodeManager();
    }
    return DeviceNodeManager.instance;
  }

  static resetInstance(): void {
    DeviceNodeManager.instance = null;
  }

  pairDevice(id: string, name: string, type: DeviceType, capabilities: DeviceCapability[]): DeviceNode {
    logger.info(`Pairing device: ${name} (${id})`);
    const device: DeviceNode = {
      id,
      name,
      type,
      capabilities,
      paired: true,
      lastSeen: Date.now(),
    };
    this.devices.set(id, device);
    return device;
  }

  unpairDevice(id: string): boolean {
    logger.info(`Unpairing device: ${id}`);
    return this.devices.delete(id);
  }

  getDevice(id: string): DeviceNode | undefined {
    return this.devices.get(id);
  }

  listDevices(): DeviceNode[] {
    return Array.from(this.devices.values());
  }

  listPairedDevices(): DeviceNode[] {
    return Array.from(this.devices.values()).filter(d => d.paired);
  }

  isDevicePaired(id: string): boolean {
    const device = this.devices.get(id);
    return device?.paired === true;
  }

  cameraSnap(deviceId: string): string | null {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.includes('camera')) {
      logger.warn(`Device ${deviceId} does not support camera`);
      return null;
    }
    logger.info(`Camera snap on device ${deviceId}`);
    return `/tmp/snap-${deviceId}-${Date.now()}.jpg`;
  }

  screenRecord(deviceId: string, duration?: number): string | null {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.includes('screen_record')) {
      logger.warn(`Device ${deviceId} does not support screen recording`);
      return null;
    }
    const dur = duration || 10;
    logger.info(`Screen record on device ${deviceId} for ${dur}s`);
    return `/tmp/screen-${deviceId}-${Date.now()}.mp4`;
  }

  getLocation(deviceId: string): LocationCoords | null {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.includes('location')) {
      logger.warn(`Device ${deviceId} does not support location`);
      return null;
    }
    logger.info(`Getting location for device ${deviceId}`);
    return { lat: 0, lon: 0 };
  }

  sendNotification(deviceId: string, title: string, body: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.includes('notifications')) {
      logger.warn(`Device ${deviceId} does not support notifications`);
      return false;
    }
    logger.info(`Sending notification to ${deviceId}: ${title}`);
    return true;
  }

  systemRun(deviceId: string, command: string): string | null {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.includes('system_run')) {
      logger.warn(`Device ${deviceId} does not support system_run`);
      return null;
    }
    if (device.type !== 'macos') {
      logger.warn(`system_run only supported on macOS, device ${deviceId} is ${device.type}`);
      return null;
    }
    logger.info(`Running command on device ${deviceId}: ${command}`);
    return `stub: executed "${command}" on ${deviceId}`;
  }

  generatePairingCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    logger.info(`Generated pairing code: ${code}`);
    return code;
  }

  updateLastSeen(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }
    device.lastSeen = Date.now();
    return true;
  }
}
