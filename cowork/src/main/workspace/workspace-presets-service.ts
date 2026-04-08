/**
 * WorkspacePresetsService — Phase 3 step 9
 *
 * Persists named workspace configurations (model, permission mode,
 * memory scope, working directory) in a single JSON file under
 * `<userData>/workspace-presets.json` and lets the renderer apply
 * them to the active session.
 *
 * @module main/workspace/workspace-presets-service
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { logWarn } from '../utils/logger';

export interface WorkspacePreset {
  id: string;
  name: string;
  description?: string;
  workspacePath?: string;
  model?: string;
  permissionMode?: string;
  memoryScope?: 'project' | 'global' | 'none';
  createdAt: number;
  updatedAt: number;
}

interface PresetsFile {
  version: number;
  presets: WorkspacePreset[];
}

const FILE_VERSION = 1;

export class WorkspacePresetsService {
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'workspace-presets.json');
    this.ensureFile();
  }

  private ensureFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        const initial: PresetsFile = { version: FILE_VERSION, presets: [] };
        fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
      }
    } catch (err) {
      logWarn('[WorkspacePresetsService] ensureFile failed:', err);
    }
  }

  private read(): PresetsFile {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as PresetsFile;
      if (!parsed.version) parsed.version = FILE_VERSION;
      if (!Array.isArray(parsed.presets)) parsed.presets = [];
      return parsed;
    } catch (err) {
      logWarn('[WorkspacePresetsService] read failed:', err);
      return { version: FILE_VERSION, presets: [] };
    }
  }

  private write(file: PresetsFile): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(file, null, 2), 'utf-8');
    } catch (err) {
      logWarn('[WorkspacePresetsService] write failed:', err);
    }
  }

  list(): WorkspacePreset[] {
    return this.read().presets;
  }

  get(id: string): WorkspacePreset | null {
    return this.read().presets.find((p) => p.id === id) ?? null;
  }

  save(preset: Omit<WorkspacePreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): {
    success: boolean;
    preset?: WorkspacePreset;
    error?: string;
  } {
    try {
      if (!preset.name.trim()) {
        return { success: false, error: 'Name is required' };
      }
      const file = this.read();
      const now = Date.now();
      if (preset.id) {
        const existing = file.presets.find((p) => p.id === preset.id);
        if (!existing) return { success: false, error: 'Preset not found' };
        Object.assign(existing, {
          name: preset.name,
          description: preset.description,
          workspacePath: preset.workspacePath,
          model: preset.model,
          permissionMode: preset.permissionMode,
          memoryScope: preset.memoryScope,
          updatedAt: now,
        });
        this.write(file);
        return { success: true, preset: existing };
      }
      const created: WorkspacePreset = {
        id: randomUUID(),
        name: preset.name.trim(),
        description: preset.description,
        workspacePath: preset.workspacePath,
        model: preset.model,
        permissionMode: preset.permissionMode,
        memoryScope: preset.memoryScope,
        createdAt: now,
        updatedAt: now,
      };
      file.presets.push(created);
      this.write(file);
      return { success: true, preset: created };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  delete(id: string): { success: boolean } {
    const file = this.read();
    const next = file.presets.filter((p) => p.id !== id);
    if (next.length === file.presets.length) return { success: false };
    file.presets = next;
    this.write(file);
    return { success: true };
  }
}

let instance: WorkspacePresetsService | null = null;
export function getWorkspacePresetsService(): WorkspacePresetsService {
  if (!instance) instance = new WorkspacePresetsService();
  return instance;
}
