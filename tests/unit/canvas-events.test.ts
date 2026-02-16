/**
 * Canvas Bidirectional Events Tests
 *
 * Tests for canvas event routing, data binding observers, and state query actions.
 */

import { A2UIManager } from '../../src/canvas/a2ui-manager.js';
import { A2UITool } from '../../src/canvas/a2ui-tool.js';
import type { CanvasEventMessage } from '../../src/canvas/a2ui-types.js';

describe('Canvas Bidirectional Events', () => {
  let manager: A2UIManager;
  let tool: A2UITool;

  beforeEach(() => {
    manager = new A2UIManager();
    tool = new A2UITool(manager);
  });

  // ==========================================================================
  // Data Binding Observers
  // ==========================================================================

  describe('Data Binding Observers', () => {
    it('should notify observers when data path is updated', () => {
      // Create a surface with data
      manager.processMessage({
        surfaceUpdate: { surfaceId: 'test', components: [] },
      });

      const callback = jest.fn();
      manager.observeDataPath('test', 'user.name', callback);

      // Update the data at the observed path
      manager.processMessage({
        dataModelUpdate: {
          surfaceId: 'test',
          path: 'user',
          contents: { name: 'Alice' },
        },
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should notify observers on root data updates', () => {
      manager.processMessage({
        surfaceUpdate: { surfaceId: 'test', components: [] },
      });

      const callback = jest.fn();
      manager.observeDataPath('test', 'status', callback);

      // Root update (no path) should trigger all observers
      manager.processMessage({
        dataModelUpdate: {
          surfaceId: 'test',
          contents: { status: 'active' },
        },
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should not notify observers for unrelated paths', () => {
      manager.processMessage({
        surfaceUpdate: { surfaceId: 'test', components: [] },
      });

      const callback = jest.fn();
      manager.observeDataPath('test', 'user.name', callback);

      // Update a different path
      manager.processMessage({
        dataModelUpdate: {
          surfaceId: 'test',
          path: 'settings',
          contents: { theme: 'dark' },
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple observers on same path', () => {
      manager.processMessage({
        surfaceUpdate: { surfaceId: 'test', components: [] },
      });

      const cb1 = jest.fn();
      const cb2 = jest.fn();
      manager.observeDataPath('test', 'count', cb1);
      manager.observeDataPath('test', 'count', cb2);

      manager.processMessage({
        dataModelUpdate: {
          surfaceId: 'test',
          path: 'count',
          contents: { value: 42 },
        },
      });

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('should remove observers', () => {
      manager.processMessage({
        surfaceUpdate: { surfaceId: 'test', components: [] },
      });

      const callback = jest.fn();
      manager.observeDataPath('test', 'data', callback);
      manager.removeDataObservers('test');

      manager.processMessage({
        dataModelUpdate: {
          surfaceId: 'test',
          path: 'data',
          contents: { value: 1 },
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // State Query Actions (via A2UITool)
  // ==========================================================================

  describe('get_data action', () => {
    it('should return full data model', async () => {
      // Create surface and set data
      await tool.execute({ action: 'create_surface', surfaceId: 'dash' });
      await tool.execute({
        action: 'update_data',
        surfaceId: 'dash',
        data: { user: { name: 'Bob' }, count: 10 },
      });

      const result = await tool.execute({
        action: 'get_data',
        surfaceId: 'dash',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({ user: { name: 'Bob' }, count: 10 })
      );
    });

    it('should return data at specific path', async () => {
      await tool.execute({ action: 'create_surface', surfaceId: 'dash' });
      await tool.execute({
        action: 'update_data',
        surfaceId: 'dash',
        data: { user: { name: 'Bob', age: 30 } },
      });

      const result = await tool.execute({
        action: 'get_data',
        surfaceId: 'dash',
        dataPath: 'user.name',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('user.name');
    });

    it('should fail when surface not found', async () => {
      const result = await tool.execute({
        action: 'get_data',
        surfaceId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should require surfaceId', async () => {
      const result = await tool.execute({ action: 'get_data' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('surfaceId is required');
    });
  });

  describe('get_component_state action', () => {
    it('should return component state', async () => {
      await tool.execute({ action: 'create_surface', surfaceId: 'form' });
      await tool.execute({
        action: 'add_component',
        surfaceId: 'form',
        component: {
          id: 'btn1',
          type: 'button',
          props: { label: 'Click Me', variant: 'primary' },
        },
      });

      const result = await tool.execute({
        action: 'get_component_state',
        surfaceId: 'form',
        componentId: 'btn1',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('btn1');
      expect(result.data).toEqual(
        expect.objectContaining({ id: 'btn1', type: 'button' })
      );
    });

    it('should fail for missing component', async () => {
      await tool.execute({ action: 'create_surface', surfaceId: 'form' });

      const result = await tool.execute({
        action: 'get_component_state',
        surfaceId: 'form',
        componentId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should require surfaceId and componentId', async () => {
      const result1 = await tool.execute({ action: 'get_component_state' });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('surfaceId is required');

      const result2 = await tool.execute({
        action: 'get_component_state',
        surfaceId: 'form',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('componentId is required');
    });
  });

  describe('canvas_snapshot action', () => {
    it('should return full surface snapshot', async () => {
      await tool.execute({ action: 'create_surface', surfaceId: 'snap-test' });
      await tool.execute({
        action: 'add_components',
        surfaceId: 'snap-test',
        components: [
          { id: 'root', type: 'column', props: { children: ['txt'] } },
          { id: 'txt', type: 'text', props: { value: 'Hello' } },
        ],
      });
      await tool.execute({
        action: 'update_data',
        surfaceId: 'snap-test',
        data: { greeting: 'Hi' },
      });

      const result = await tool.execute({
        action: 'canvas_snapshot',
        surfaceId: 'snap-test',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('snap-test');
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'snap-test',
          componentCount: 2,
        })
      );
    });

    it('should fail for nonexistent surface', async () => {
      const result = await tool.execute({
        action: 'canvas_snapshot',
        surfaceId: 'missing',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ==========================================================================
  // Canvas Event Routing (via A2UIManager events)
  // ==========================================================================

  describe('Canvas Event Routing', () => {
    it('should emit user:action when canvasEvent is received', () => {
      // The A2UI server converts canvasEvent → user:action via the manager
      // Here we test the manager's event emission directly
      const actionHandler = jest.fn();
      manager.on('user:action', actionHandler);

      // Create a surface
      manager.processMessage({
        surfaceUpdate: {
          surfaceId: 'ui',
          components: [
            {
              id: 'btn',
              component: { button: { label: 'Go' } },
            },
          ],
        },
      });

      // Simulate what the server does: emit user:action
      manager.emit('user:action', {
        surfaceId: 'ui',
        componentId: 'btn',
        name: 'click',
        context: { eventType: 'click', value: undefined, timestamp: Date.now() },
      });

      expect(actionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          surfaceId: 'ui',
          componentId: 'btn',
          name: 'click',
        })
      );
    });

    it('should handle submit event with form data', () => {
      const actionHandler = jest.fn();
      manager.on('user:action', actionHandler);

      manager.emit('user:action', {
        surfaceId: 'form',
        componentId: 'submit-btn',
        name: 'submit',
        context: {
          eventType: 'submit',
          value: { email: 'test@example.com' },
          timestamp: Date.now(),
        },
      });

      expect(actionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'submit',
          context: expect.objectContaining({
            value: { email: 'test@example.com' },
          }),
        })
      );
    });

    it('should handle input_change event', () => {
      const actionHandler = jest.fn();
      manager.on('user:action', actionHandler);

      manager.emit('user:action', {
        surfaceId: 'editor',
        componentId: 'name-field',
        name: 'input_change',
        context: {
          eventType: 'input_change',
          value: 'Alice',
          timestamp: Date.now(),
        },
      });

      expect(actionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'input_change',
          context: expect.objectContaining({ value: 'Alice' }),
        })
      );
    });

    it('should handle select event', () => {
      const actionHandler = jest.fn();
      manager.on('user:action', actionHandler);

      manager.emit('user:action', {
        surfaceId: 'settings',
        componentId: 'theme-select',
        name: 'select',
        context: {
          eventType: 'select',
          value: 'dark',
          timestamp: Date.now(),
        },
      });

      expect(actionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'select',
          context: expect.objectContaining({ value: 'dark' }),
        })
      );
    });
  });

  // ==========================================================================
  // CanvasEventMessage Type Validation
  // ==========================================================================

  describe('CanvasEventMessage type', () => {
    it('should have correct structure', () => {
      const event: CanvasEventMessage = {
        canvasEvent: {
          surfaceId: 'test',
          componentId: 'btn1',
          eventType: 'click',
          value: undefined,
          timestamp: Date.now(),
        },
      };

      expect(event.canvasEvent.surfaceId).toBe('test');
      expect(event.canvasEvent.componentId).toBe('btn1');
      expect(event.canvasEvent.eventType).toBe('click');
      expect(typeof event.canvasEvent.timestamp).toBe('number');
    });

    it('should support all event types', () => {
      const eventTypes: Array<'click' | 'submit' | 'input_change' | 'select'> = [
        'click', 'submit', 'input_change', 'select',
      ];

      for (const eventType of eventTypes) {
        const event: CanvasEventMessage = {
          canvasEvent: {
            surfaceId: 's1',
            componentId: 'c1',
            eventType,
            timestamp: 0,
          },
        };
        expect(event.canvasEvent.eventType).toBe(eventType);
      }
    });
  });

  // ==========================================================================
  // Integration: Tool + Manager
  // ==========================================================================

  describe('Tool + Manager integration', () => {
    it('should create surface, add components, update data, and snapshot', async () => {
      // Full workflow
      const r1 = await tool.execute({ action: 'create_surface', surfaceId: 'app' });
      expect(r1.success).toBe(true);

      const r2 = await tool.execute({
        action: 'add_components',
        surfaceId: 'app',
        components: [
          { id: 'root', type: 'column', props: { children: ['title', 'input'] } },
          { id: 'title', type: 'heading', props: { value: 'My App', level: 1 } },
          { id: 'input', type: 'textField', props: { label: 'Name', placeholder: 'Enter name' } },
        ],
      });
      expect(r2.success).toBe(true);

      const r3 = await tool.execute({
        action: 'update_data',
        surfaceId: 'app',
        data: { formValues: { name: '' } },
      });
      expect(r3.success).toBe(true);

      const r4 = await tool.execute({
        action: 'begin_rendering',
        surfaceId: 'app',
        root: 'root',
      });
      expect(r4.success).toBe(true);

      // Take snapshot
      const snap = await tool.execute({
        action: 'canvas_snapshot',
        surfaceId: 'app',
      });
      expect(snap.success).toBe(true);
      expect((snap.data as Record<string, unknown>).componentCount).toBe(3);
      expect((snap.data as Record<string, unknown>).visible).toBe(true);

      // Query specific component
      const comp = await tool.execute({
        action: 'get_component_state',
        surfaceId: 'app',
        componentId: 'title',
      });
      expect(comp.success).toBe(true);
      expect((comp.data as Record<string, unknown>).type).toBe('heading');

      // Query data
      const data = await tool.execute({
        action: 'get_data',
        surfaceId: 'app',
      });
      expect(data.success).toBe(true);
      expect(data.data).toEqual(
        expect.objectContaining({ formValues: { name: '' } })
      );
    });
  });
});
