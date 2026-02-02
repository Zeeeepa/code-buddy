/**
 * Todo Tool Definitions
 *
 * Tools for task management:
 * - Create todo lists
 * - Update todo items
 */

import type { CodeBuddyTool } from './types.js';

// Create todo list
export const CREATE_TODO_LIST_TOOL: CodeBuddyTool = {
  type: "function",
  function: {
    name: "create_todo_list",
    description: "Create a new todo list for planning and tracking tasks",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "Array of todo items",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for the todo item",
              },
              content: {
                type: "string",
                description: "Description of the todo item",
              },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
                description: "Current status of the todo item",
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Priority level of the todo item",
              },
            },
            required: ["id", "content", "status", "priority"],
          },
        },
      },
      required: ["todos"],
    },
  },
};

// Get todo list
export const GET_TODO_LIST_TOOL: CodeBuddyTool = {
  type: "function",
  function: {
    name: "get_todo_list",
    description: "Get the current todo list to see all tasks and their status",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "pending", "in_progress", "completed"],
          description: "Filter todos by status (default: all)",
        },
      },
      required: [],
    },
  },
};

// Update todo list
export const UPDATE_TODO_LIST_TOOL: CodeBuddyTool = {
  type: "function",
  function: {
    name: "update_todo_list",
    description: "Update existing todos in the todo list",
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          description: "Array of todo updates",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "ID of the todo item to update",
              },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
                description: "New status for the todo item",
              },
              content: {
                type: "string",
                description: "New content for the todo item",
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "New priority for the todo item",
              },
            },
            required: ["id"],
          },
        },
      },
      required: ["updates"],
    },
  },
};

/**
 * All todo tools as an array
 */
export const TODO_TOOLS: CodeBuddyTool[] = [
  CREATE_TODO_LIST_TOOL,
  GET_TODO_LIST_TOOL,
  UPDATE_TODO_LIST_TOOL,
];
