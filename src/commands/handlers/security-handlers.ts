import { ChatEntry } from "../../agent/grok-agent.js";
import { getSecurityManager, ApprovalMode } from "../../security/index.js";
import { getCodeGuardianAgent, CodeGuardianMode } from "../../agent/specialized/code-guardian-agent.js";
import { ConfirmationService } from "../../utils/confirmation-service.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Security - Show security dashboard
 */
export function handleSecurity(args: string[]): CommandHandlerResult {
  const securityManager = getSecurityManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "mode":
      const mode = args[1]?.toLowerCase() as ApprovalMode;
      if (mode && ['read-only', 'auto', 'full-access'].includes(mode)) {
        securityManager.updateConfig({ approvalMode: mode });
        content = `🛡️ Security mode set to: ${mode.toUpperCase()}`;
      } else {
        content = `Usage: /security mode <read-only|auto|full-access>

Modes:
  read-only   - Only read operations, no writes or commands
  auto        - Auto-approve safe operations, confirm dangerous ones
  full-access - All operations auto-approved (trusted environments)`;
      }
      break;

    case "reset":
      securityManager.resetStats();
      content = `🔄 Security statistics reset`;
      break;

    case "events":
      const events = securityManager.getEvents(10);
      if (events.length === 0) {
        content = `📜 No security events recorded`;
      } else {
        const eventLines = events.map(e => {
          const time = new Date(e.timestamp).toLocaleTimeString();
          return `[${time}] ${e.type}: ${e.action} → ${e.result}`;
        });
        content = `📜 Recent Security Events\n\n${eventLines.join('\n')}`;
      }
      break;

    case "status":
    default:
      content = securityManager.formatDashboard();
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Dry-Run - Toggle simulation mode
 */
export function handleDryRun(args: string[]): CommandHandlerResult {
  const confirmationService = ConfirmationService.getInstance();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "on":
      confirmationService.setDryRunMode(true);
      content = `🔍 Dry-Run Mode: ENABLED

Changes will be previewed but NOT applied.
All operations will be logged for review.

Use /dry-run off to disable and apply changes.
Use /dry-run log to see what would have executed.`;
      break;

    case "off":
      const log = confirmationService.getDryRunLog();
      confirmationService.setDryRunMode(false);
      content = `🔍 Dry-Run Mode: DISABLED

Changes will now be applied normally.

${log.length > 0 ? `📋 ${log.length} operation(s) were logged during dry-run.` : ''}`;
      break;

    case "log":
      content = confirmationService.formatDryRunLog();
      break;

    case "status":
    default:
      const isDryRun = confirmationService.isDryRunMode();
      const currentLog = confirmationService.getDryRunLog();
      content = `🔍 Dry-Run Status

Mode: ${isDryRun ? '✅ ENABLED (simulation)' : '❌ DISABLED (live)'}
Logged Operations: ${currentLog.length}

Commands:
  /dry-run on     - Enable simulation mode
  /dry-run off    - Disable and apply changes
  /dry-run log    - View logged operations

Or use --dry-run flag when starting the CLI.`;
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Guardian - Code Guardian agent for code analysis and review
 */
export async function handleGuardian(args: string[]): Promise<CommandHandlerResult> {
  const guardian = getCodeGuardianAgent();

  // Initialize if needed
  if (!guardian.isReady()) {
    await guardian.initialize();
  }

  const action = args[0]?.toLowerCase() || 'help';
  const target = args[1] || process.cwd();

  // Handle mode setting
  if (action === 'mode') {
    const modeMap: Record<string, CodeGuardianMode> = {
      'analyze': 'ANALYZE_ONLY',
      'analyze-only': 'ANALYZE_ONLY',
      'suggest': 'SUGGEST_REFACTOR',
      'plan': 'PATCH_PLAN',
      'diff': 'PATCH_DIFF',
    };
    const newMode = modeMap[args[1]?.toLowerCase() || ''];
    if (newMode) {
      guardian.setMode(newMode);
      return {
        handled: true,
        entry: {
          type: "assistant",
          content: `🛡️ Code Guardian - Mode: ${newMode}

Les modifications sont ${newMode === 'ANALYZE_ONLY' ? 'désactivées' : 'possibles'}.`,
          timestamp: new Date(),
        },
      };
    }
  }

  // Map actions to agent tasks
  const actionMap: Record<string, { action: string; description: string }> = {
    'analyze': { action: 'analyze-directory', description: 'Analyse complète du répertoire' },
    'security': { action: 'check-security', description: 'Audit de sécurité' },
    'review': { action: 'analyze-file', description: 'Revue de code' },
    'refactor': { action: 'suggest-refactor', description: 'Suggestions de refactoring' },
    'plan': { action: 'create-patch-plan', description: 'Plan de modifications' },
    'architecture': { action: 'review-architecture', description: 'Revue d\'architecture' },
    'deps': { action: 'map-dependencies', description: 'Carte des dépendances' },
    'explain': { action: 'explain-code', description: 'Explication du code' },
  };

  if (action === 'help' || !actionMap[action]) {
    const currentMode = guardian.getMode();
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `🛡️ Grokinette - Code Guardian
═══════════════════════════════════════════════════

Mode actuel: ${currentMode}

📋 Actions disponibles:
  /guardian analyze [path]     - Analyse complète du code
  /guardian security [path]    - Audit de sécurité
  /guardian review <file>      - Revue d'un fichier
  /guardian refactor [path]    - Suggestions de refactoring
  /guardian architecture       - Revue d'architecture
  /guardian deps [path]        - Carte des dépendances
  /guardian explain <file>     - Explication du code

⚙️ Modes:
  /guardian mode analyze-only  - Lecture seule
  /guardian mode suggest       - Analyse + suggestions
  /guardian mode plan          - Plans de modification
  /guardian mode diff          - Génération de diffs

🔒 Règles de sécurité:
  • Validation humaine requise pour les modifications
  • Pas de suppression massive
  • Rollback toujours disponible`,
        timestamp: new Date(),
      },
    };
  }

  const taskInfo = actionMap[action];

  try {
    // Set mode for refactoring actions
    if (['refactor', 'plan'].includes(action)) {
      if (guardian.getMode() === 'ANALYZE_ONLY') {
        guardian.setMode('SUGGEST_REFACTOR');
      }
    }

    const result = await guardian.execute({
      action: taskInfo.action,
      inputFiles: [target],
    });

    if (result.success) {
      return {
        handled: true,
        entry: {
          type: "assistant",
          content: result.output || JSON.stringify(result.data, null, 2),
          timestamp: new Date(),
        },
      };
    } else {
      return {
        handled: true,
        entry: {
          type: "assistant",
          content: `❌ Code Guardian - Erreur

${result.error || 'Une erreur inconnue s\'est produite'}`,
          timestamp: new Date(),
        },
      };
    }
  } catch (error) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `❌ Code Guardian - Erreur

${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      },
    };
  }
}
