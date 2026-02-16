/**
 * Device CLI Commands
 *
 * CLI commands for managing paired devices:
 *   buddy device pair|list|remove|snap|screenshot|record|run
 */

import { Command } from 'commander';

export function registerDeviceCommands(program: Command): void {
  const device = program
    .command('device')
    .description('Manage paired device nodes (SSH, ADB, local)');

  device
    .command('list')
    .description('List all paired devices')
    .action(async () => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const devices = manager.listDevices();

      if (devices.length === 0) {
        console.log('No devices paired. Use "buddy device pair" to add one.');
        return;
      }

      console.log('Paired devices:');
      for (const d of devices) {
        console.log(`  ${d.id} (${d.name}) — ${d.type} via ${d.transportType}`);
        console.log(`    Capabilities: ${d.capabilities.join(', ') || 'none detected'}`);
        console.log(`    Last seen: ${new Date(d.lastSeen).toLocaleString()}`);
      }
    });

  device
    .command('pair')
    .description('Pair a new device')
    .requiredOption('--id <id>', 'Device identifier')
    .requiredOption('--name <name>', 'Display name')
    .requiredOption('--transport <type>', 'Transport type: ssh, adb, or local')
    .option('--address <address>', 'Connection address (host/IP)')
    .option('--port <port>', 'Connection port', parseInt)
    .option('--username <user>', 'SSH username')
    .option('--key <path>', 'Path to SSH key')
    .action(async (opts) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();

      try {
        const device = await manager.pairDevice(opts.id, opts.name, opts.transport, {
          address: opts.address,
          port: opts.port,
          username: opts.username,
          keyPath: opts.key,
        });
        console.log(`Device paired: ${device.name} (${device.id})`);
        console.log(`  Type: ${device.type}`);
        console.log(`  Transport: ${device.transportType}`);
        console.log(`  Capabilities: ${device.capabilities.join(', ')}`);
      } catch (err) {
        console.error(`Failed to pair device: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  device
    .command('remove <id>')
    .description('Remove a paired device')
    .action(async (id: string) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const removed = manager.unpairDevice(id);
      console.log(removed ? `Device ${id} removed` : `Device ${id} not found`);
    });

  device
    .command('snap <id>')
    .description('Take a camera snapshot on a device')
    .action(async (id: string) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const path = await manager.cameraSnap(id);
      console.log(path ? `Snapshot saved: ${path}` : 'Camera snap failed');
    });

  device
    .command('screenshot <id>')
    .description('Take a screenshot on a device')
    .action(async (id: string) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const path = await manager.screenshot(id);
      console.log(path ? `Screenshot saved: ${path}` : 'Screenshot failed');
    });

  device
    .command('record <id>')
    .description('Record the screen on a device')
    .option('-d, --duration <seconds>', 'Recording duration', parseInt)
    .action(async (id: string, opts: { duration?: number }) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const path = await manager.screenRecord(id, opts.duration);
      console.log(path ? `Recording saved: ${path}` : 'Screen recording failed');
    });

  device
    .command('run <id> <command...>')
    .description('Run a command on a device')
    .action(async (id: string, commandParts: string[]) => {
      const { DeviceNodeManager } = await import('../../nodes/device-node.js');
      const manager = DeviceNodeManager.getInstance();
      const result = await manager.systemRun(id, commandParts.join(' '));
      if (!result) {
        console.error('Command execution failed');
        process.exit(1);
      }
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      process.exit(result.exitCode);
    });
}
