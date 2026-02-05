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
        <div className="my-4 md:my-5 overflow-hidden border-2 border-ink/30 bg-deep-charcoal shadow-xl relative rounded">
            {/* Decorative corner marks (hidden on mobile) */}
            <div className="hidden md:block absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-compass"></div>
            <div className="hidden md:block absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-compass"></div>

            <div className="px-3 py-2 md:px-5 md:py-3 bg-ink/90 border-b-2 border-ink flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {/* Vintage document indicator */}
                    <div className="flex gap-1 flex-shrink-0">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 border border-gold"></div>
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 border border-gold bg-gold/50"></div>
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 border border-gold"></div>
                    </div>
                    {filename && (
                        <span className="ml-1 md:ml-2 text-xs md:text-sm font-mono text-parchment tracking-wider truncate">{filename}</span>
                    )}
                    {!filename && (
                        <span className="ml-1 md:ml-2 text-[10px] md:text-xs font-bold text-gold uppercase tracking-widest truncate">
                            {language}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 bg-compass hover:bg-compass-dark border border-compass-dark rounded transition-all duration-200 group shadow-md flex-shrink-0"
                >
                    {copied ? (
                        <>
                            <CheckIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                            <span className="text-[10px] md:text-xs font-bold text-white">Copied</span>
                        </>
                    ) : (
                        <>
                            <CopyIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] md:text-xs font-bold text-white hidden sm:inline">Copy</span>
                        </>
                    )}
                </button>
            </div>
            <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                        className={`${className} p-3 md:p-5 overflow-x-auto text-xs md:text-sm`}
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
                                className="hover:bg-ink/20 transition-colors border-l-2 border-transparent hover:border-compass pl-1 md:pl-2"
                            >
                                <span className="inline-block w-6 md:w-10 text-terrain select-none text-right pr-2 md:pr-4 font-mono text-[10px] md:text-xs">
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

            {/* Quick Actions */}
            <div className="px-3 py-2 md:px-5 md:py-3 bg-ink/5 border-t-2 border-ink/10 flex gap-1.5 md:gap-2 flex-wrap">
                <button
                    type="button"
                    className="text-[10px] md:text-xs px-2 py-1 md:px-3 md:py-1.5 bg-ocean text-white rounded hover:bg-ink transition-all font-semibold flex items-center gap-1 md:gap-1.5"
                    title="View component documentation"
                    aria-label="View component documentation"
                >
                    View Docs
                </button>
                <button
                    type="button"
                    className="text-[10px] md:text-xs px-2 py-1 md:px-3 md:py-1.5 bg-terrain text-white rounded hover:bg-ink transition-all font-semibold flex items-center gap-1 md:gap-1.5"
                    title="Check accessibility compliance"
                    aria-label="Check accessibility compliance"
                >
                    Check A11y
                </button>
                <button
                    type="button"
                    className="text-[10px] md:text-xs px-2 py-1 md:px-3 md:py-1.5 bg-gold text-ink rounded hover:bg-compass hover:text-white transition-all font-semibold flex items-center gap-1 md:gap-1.5"
                    title="Explore component variants"
                    aria-label="Explore component variants"
                >
                    Variants
                </button>
                <button
                    type="button"
                    className="text-[10px] md:text-xs px-2 py-1 md:px-3 md:py-1.5 bg-compass text-white rounded hover:bg-compass-dark transition-all font-semibold flex items-center gap-1 md:gap-1.5"
                    title="View in Storybook"
                    aria-label="View in Storybook"
                >
                    Storybook
                </button>
            </div>

            {/* Bottom decorative corners (hidden on mobile) */}
            <div className="hidden md:block absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-compass"></div>
            <div className="hidden md:block absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-compass"></div>
        </div>
    );
}
