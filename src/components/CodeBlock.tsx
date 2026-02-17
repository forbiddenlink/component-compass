import { Highlight, themes } from 'prism-react-renderer';
import { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
}

export function CodeBlock({ code, language = 'typescript', filename }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-4 overflow-hidden border border-ink/20 bg-deep-charcoal rounded-lg shadow-sm">
            {/* Header */}
            <div className="px-4 py-2.5 bg-ink/80 border-b border-ink/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-caption font-mono text-parchment/70 uppercase tracking-wider">
                        {filename || language}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-parchment/70 hover:text-white hover:bg-white/10 rounded transition-colors text-caption font-medium focus-ring"
                >
                    {copied ? (
                        <>
                            <CheckIcon className="w-3.5 h-3.5" />
                            <span>Copied</span>
                        </>
                    ) : (
                        <>
                            <CopyIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Copy</span>
                        </>
                    )}
                </button>
            </div>
            <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                        className={`${className} p-4 overflow-x-auto text-small`}
                        style={{
                            ...style,
                            background: '#1A1D23',
                            fontFamily: "'JetBrains Mono', monospace"
                        }}
                    >
                        {tokens.map((line, i) => (
                            <div
                                key={i}
                                {...getLineProps({ line })}
                            >
                                <span className="inline-block w-8 text-muted select-none text-right pr-4 font-mono text-caption">
                                    {i + 1}
                                </span>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                ))}
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    );
}
