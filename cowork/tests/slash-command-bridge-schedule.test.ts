import { describe, expect, it } from 'vitest';
import {
  buildScheduleCreateInputFromArgs,
  SlashCommandBridge,
  parseScheduleSlashArgs,
} from '../src/main/commands/slash-command-bridge';

describe('SlashCommandBridge schedule support', () => {
  it('parses daily schedule arguments into a draft', () => {
    expect(parseScheduleSlashArgs(['daily', '09:00', 'Review', 'release', 'notes'])).toEqual({
      prompt: 'Review release notes',
      scheduleMode: 'daily',
      selectedTimes: ['09:00'],
      enabled: true,
    });
  });

  it('parses weekly schedule arguments into a draft', () => {
    expect(parseScheduleSlashArgs(['weekly', 'mon', '10:30', 'Send', 'team', 'summary'])).toEqual(
      {
        prompt: 'Send team summary',
        scheduleMode: 'weekly',
        selectedWeekdays: [1],
        selectedTimes: ['10:30'],
        enabled: true,
      }
    );
  });

  it('parses one-shot schedule arguments into a draft', () => {
    expect(parseScheduleSlashArgs(['once', '2026-04-10T09:15', 'Prepare', 'board', 'deck'])).toEqual(
      {
        prompt: 'Prepare board deck',
        scheduleMode: 'once',
        runAt: '2026-04-10T09:15',
        enabled: true,
      }
    );
  });

  it('returns a create_schedule action for a complete /schedule execution', async () => {
    const bridge = new SlashCommandBridge();
    bridge.listCommands = async () => [
      {
        name: 'schedule',
        description: 'Open schedule form',
        prompt: '__OPEN_SCHEDULE__',
        isBuiltin: true,
      },
    ];

    const result = await bridge.execute('schedule', ['daily', '09:00', 'Check', 'backups']);
    expect(result.success).toBe(true);
    expect(result.handled).toBe(true);
    expect(result.action?.type).toBe('create_schedule');
  });

  it('builds a direct create payload for a complete daily schedule command', () => {
    const now = new Date('2026-04-09T08:00:00').getTime();
    expect(buildScheduleCreateInputFromArgs(['daily', '09:00', 'Check', 'backups'], now)).toEqual({
      prompt: 'Check backups',
      runAt: new Date('2026-04-09T09:00:00').getTime(),
      nextRunAt: new Date('2026-04-09T09:00:00').getTime(),
      scheduleConfig: {
        kind: 'daily',
        times: ['09:00'],
      },
      enabled: true,
    });
  });

  it('falls back to UI flow when the schedule command is incomplete', async () => {
    const bridge = new SlashCommandBridge();
    bridge.listCommands = async () => [
      {
        name: 'schedule',
        description: 'Open schedule form',
        prompt: '__OPEN_SCHEDULE__',
        isBuiltin: true,
      },
    ];

    const result = await bridge.execute('schedule', ['daily', '09:00']);
    expect(result.action).toEqual({
      type: 'open_schedule',
      draft: {
        prompt: '',
        scheduleMode: 'daily',
        selectedTimes: ['09:00'],
        enabled: true,
      },
    });
  });
});
