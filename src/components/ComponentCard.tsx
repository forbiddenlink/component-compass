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
  const props = data.props.split(',').map(p => p.trim()).filter(Boolean);

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
    ? 'bg-terrain/20 text-terrain border-terrain/30'
    : data.status === 'beta'
    ? 'bg-gold/20 text-gold border-gold/30'
    : 'bg-compass/20 text-compass border-compass/30';

  return (
    <div className="my-3 border-2 border-ink/15 bg-warm-white rounded-lg overflow-hidden shadow-paper">
      {/* Header */}
      <div className="px-4 py-3 bg-parchment/50 border-b border-ink/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-ink text-sm">{data.name}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider', statusColor)}>
            {data.status}
          </span>
        </div>
        <span className="text-[10px] text-ink/40 font-mono uppercase tracking-widest">{data.category}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-ink/70 leading-relaxed">{data.description}</p>

        {/* Variants */}
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variants.map(v => (
              <span key={v} className="text-[10px] px-1.5 py-0.5 bg-ocean/10 text-ocean rounded border border-ocean/20 font-mono">
                {v}
              </span>
            ))}
          </div>
        )}

        {/* Props */}
        {props.length > 0 && (
          <div className="text-[10px] text-ink/50">
            <span className="font-semibold">Props:</span>{' '}
            <span className="font-mono">{props.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-2 bg-parchment/30 border-t border-ink/10 flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => handleAction('docs')}
          className="text-[10px] px-2 py-1 bg-ocean text-white rounded hover:bg-ink transition-all font-semibold"
        >
          View Docs
        </button>
        <button
          type="button"
          onClick={() => handleAction('a11y')}
          className="text-[10px] px-2 py-1 bg-terrain text-white rounded hover:bg-ink transition-all font-semibold"
        >
          Check A11y
        </button>
        <button
          type="button"
          onClick={() => handleAction('variants')}
          className="text-[10px] px-2 py-1 bg-gold text-ink rounded hover:bg-compass hover:text-white transition-all font-semibold"
        >
          Variants
        </button>
        <button
          type="button"
          onClick={() => handleAction('examples')}
          className="text-[10px] px-2 py-1 bg-compass text-white rounded hover:bg-compass-dark transition-all font-semibold"
        >
          Examples
        </button>
      </div>
    </div>
  );
}

// Exported for use by ChatInterface to detect component names
export const KNOWN_COMPONENTS = Array.from(componentLookup.keys());
