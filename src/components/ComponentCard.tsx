import { cn } from '../lib/utils';
import { trackComponentCardClick } from '../services/insights';
import componentsData from '../../data/components_index_enhanced.json';

interface ComponentInfo {
  objectID: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  status: string;
  props: string;
  variants: string;
}

const componentLookup = new Map<string, ComponentInfo>(
  (componentsData as ComponentInfo[]).map(c => [c.name.toLowerCase(), c])
);

interface ComponentCardProps {
  componentName: string;
  onAction: (query: string) => void;
}

export function ComponentCard({ componentName, onAction }: ComponentCardProps) {
  const data = componentLookup.get(componentName.toLowerCase());
  if (!data) return null;

  const variants = data.variants.split(',').map(v => v.trim()).filter(Boolean);

  const handleAction = (action: string) => {
    trackComponentCardClick(data.name);
    const queries: Record<string, string> = {
      docs: `Show me the ${data.name} component documentation`,
      a11y: `What are the accessibility guidelines for ${data.name}?`,
      examples: `Show me code examples for ${data.name}`,
      variants: `What variants does ${data.name} have and when should I use each?`,
    };
    onAction(queries[action] || `Tell me about ${data.name}`);
  };

  const statusColor = data.status === 'stable'
    ? 'bg-terrain/10 text-terrain'
    : data.status === 'beta'
    ? 'bg-gold/10 text-gold'
    : 'bg-compass/10 text-compass';

  return (
    <div className="my-3 border border-ink/10 bg-white rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-ink/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-ink text-small">{data.name}</span>
          <span className={cn('text-caption px-1.5 py-0.5 rounded font-semibold', statusColor)}>
            {data.status}
          </span>
        </div>
        <span className="text-caption text-muted font-mono uppercase tracking-wider">{data.category}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-small text-ink/70 leading-relaxed">{data.description}</p>

        {/* Variants */}
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variants.map(v => (
              <span key={v} className="text-caption px-1.5 py-0.5 bg-ink/5 text-ink/60 rounded font-mono">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions - simplified to 2 buttons */}
      <div className="px-4 py-2.5 border-t border-ink/8 flex gap-2">
        <button
          type="button"
          onClick={() => handleAction('docs')}
          className="text-caption px-3 py-1.5 bg-compass text-white rounded hover:bg-compass-dark transition-colors font-semibold focus-ring"
        >
          View Docs
        </button>
        <button
          type="button"
          onClick={() => handleAction('examples')}
          className="text-caption px-3 py-1.5 border border-ink/15 text-ink rounded hover:bg-ink/5 transition-colors font-semibold focus-ring"
        >
          Examples
        </button>
      </div>
    </div>
  );
}

// Exported for use by ChatInterface to detect component names
export const KNOWN_COMPONENTS = Array.from(componentLookup.keys());
