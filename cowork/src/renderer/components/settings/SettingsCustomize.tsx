import { Blocks, Plug, Package, Workflow, Webhook, SlashSquare, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsContentSection } from './shared';

type CustomizeTab = 'connectors' | 'skills' | 'mcpMarketplace' | 'workflows' | 'hooks' | 'customCommands' | 'workspacePresets';

interface SettingsCustomizeProps {
  onNavigate: (tab: CustomizeTab) => void;
}

const CARD_ICONS = {
  connectors: Plug,
  skills: Package,
  mcpMarketplace: Blocks,
  workflows: Workflow,
  hooks: Webhook,
  customCommands: SlashSquare,
  workspacePresets: Layers,
} as const;

export function SettingsCustomize({ onNavigate }: SettingsCustomizeProps) {
  const { t } = useTranslation();

  const items: Array<{
    id: CustomizeTab;
    title: string;
    description: string;
  }> = [
    {
      id: 'connectors',
      title: t('settings.connectors'),
      description: t('settings.connectorsDesc'),
    },
    {
      id: 'skills',
      title: t('settings.skills'),
      description: t('skills.pluginsDesc', 'Browse marketplace plugins or import local skills.'),
    },
    {
      id: 'mcpMarketplace',
      title: t('settings.mcpMarketplace', 'MCP marketplace'),
      description: t('settings.mcpMarketplaceDesc', 'Install MCP servers from the registry'),
    },
    {
      id: 'workflows',
      title: t('settings.workflows', 'Workflows'),
      description: t('settings.workflowsDesc', 'Visual DAG editor for repeatable workflows'),
    },
    {
      id: 'hooks',
      title: t('hooks.title', 'Hooks & triggers'),
      description: t('hooks.hint', 'Run shell or HTTP hooks on agent events'),
    },
    {
      id: 'customCommands',
      title: t('customCommands.title', 'Custom commands'),
      description: t('customCommands.hint', 'User-defined slash commands'),
    },
    {
      id: 'workspacePresets',
      title: t('workspacePresets.title', 'Workspace presets'),
      description: t('workspacePresets.hint', 'Save and apply workspace configurations'),
    },
  ];

  return (
    <div className="space-y-5">
      <SettingsContentSection
        title={t('settings.customize', 'Customize')}
        description={t(
          'settings.customizeDesc',
          'Use this hub to configure plugins, connectors, workflows, hooks, and reusable workspace behavior.'
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const Icon = CARD_ICONS[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="rounded-xl border border-border-muted bg-background px-4 py-4 text-left transition-colors hover:border-border hover:bg-surface-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-accent/10 p-2 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-text-muted">{item.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsContentSection>
    </div>
  );
}
