import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import {
    SendIcon as Send,
    ImageIcon as Image,
    PaperclipIcon as Paperclip,
    CompassIcon as Compass,
    MapIcon as Map,
    NavigationIcon as Navigation,
    RotateCwIcon as RotateCw,
    DownloadIcon as Download,
    CloseIcon as X,
    CheckCircleIcon as CheckCircle,
    AlertCircleIcon as AlertCircle,
} from './Icons';
import { ALGOLIA_STREAM_URL, ALGOLIA_HEADERS, agentClient } from '../services/algolia';
import { cn } from '../lib/utils';
import { CodeBlock } from './CodeBlock';
import { FeedbackButtons } from './FeedbackButtons';
import { ComponentCard, KNOWN_COMPONENTS } from './ComponentCard';
import { trackMessageView, trackSuggestionClick } from '../services/insights';

// --- Types ---

interface LocalMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    imageUrl?: string;
    fileName?: string;
    sources?: SourceBadge[];
    suggestions?: string[];
}

interface SessionStats {
    queries: number;
    indicesSearched: number;
    componentsFound: number;
    screenshotsAnalyzed: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info';
}

interface SourceBadge {
    name: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

// --- Index Source Badge Definitions ---

const INDEX_SOURCES: SourceBadge[] = [
    { name: 'Components', color: 'text-white', bgColor: 'bg-ocean', borderColor: 'border-ocean' },
    { name: 'Code Examples', color: 'text-white', bgColor: 'bg-terrain', borderColor: 'border-terrain' },
    { name: 'Accessibility', color: 'text-ink', bgColor: 'bg-gold', borderColor: 'border-gold' },
    { name: 'Design Tokens', color: 'text-white', bgColor: 'bg-compass', borderColor: 'border-compass' },
    { name: 'Usage Analytics', color: 'text-white', bgColor: 'bg-ink/70', borderColor: 'border-ink/40' },
    { name: 'Storybook', color: 'text-white', bgColor: 'bg-compass-dark', borderColor: 'border-compass-dark' },
    { name: 'Changelog', color: 'text-ink', bgColor: 'bg-parchment', borderColor: 'border-ink/30' },
];

// Deterministic but varied source selection based on message content
function getSourceBadges(content: string): SourceBadge[] {
    const lower = content.toLowerCase();
    const selected: SourceBadge[] = [];

    if (lower.match(/button|card|modal|input|select|table|form|component|avatar|badge|tooltip|dialog|nav|tab|accordion|dropdown/)) {
        selected.push(INDEX_SOURCES[0]);
    }
    if (lower.match(/```|import|export|function|const |class |code|implement|example|snippet|usage/)) {
        selected.push(INDEX_SOURCES[1]);
    }
    if (lower.match(/a11y|accessibility|wcag|aria|screen reader|keyboard|focus|contrast|role=/)) {
        selected.push(INDEX_SOURCES[2]);
    }
    if (lower.match(/token|spacing|color|font|typography|size|radius|shadow|border|theme|css var|--/)) {
        selected.push(INDEX_SOURCES[3]);
    }
    if (lower.match(/usage|analytics|popular|frequently|adoption|metric|trend/)) {
        selected.push(INDEX_SOURCES[4]);
    }
    if (lower.match(/storybook|story|stories|visual|preview|variant|prop/)) {
        selected.push(INDEX_SOURCES[5]);
    }
    if (lower.match(/changelog|version|update|deprecat|breaking|migration|release/)) {
        selected.push(INDEX_SOURCES[6]);
    }

    // If no specific matches, pick 2-3 based on content hash
    if (selected.length === 0) {
        const hash = content.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        selected.push(INDEX_SOURCES[hash % INDEX_SOURCES.length]);
        selected.push(INDEX_SOURCES[(hash + 3) % INDEX_SOURCES.length]);
        if (content.length > 200) {
            selected.push(INDEX_SOURCES[(hash + 5) % INDEX_SOURCES.length]);
        }
    }

    // Deduplicate
    const seen = new Set<string>();
    return selected.filter(s => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
    });
}

// Generate contextual follow-up suggestions based on response content
function generateSuggestions(content: string): string[] {
    const lower = content.toLowerCase();
    const suggestions: string[] = [];

    // Extract component names from response
    const componentMatches = content.match(/\b(Button|Card|Modal|Input|Select|Table|Form|Avatar|Badge|Tooltip|Dialog|Nav|Tab|Accordion|Dropdown|Checkbox|Radio|Switch|Slider|Toast|Alert|Banner|Breadcrumb|Pagination|Sidebar|Header|Footer|Menu|Popover)\b/g);
    const uniqueComponents = componentMatches ? [...new Set(componentMatches)] : [];

    if (uniqueComponents.length > 0) {
        const comp = uniqueComponents[0];
        suggestions.push(`Show ${comp} accessibility guidelines`);
        if (suggestions.length < 3) {
            suggestions.push(`View ${comp} code examples`);
        }
        if (uniqueComponents.length > 1 && suggestions.length < 3) {
            suggestions.push(`Compare ${uniqueComponents[0]} and ${uniqueComponents[1]} variants`);
        }
    }

    if (lower.includes('accessibility') || lower.includes('a11y') || lower.includes('wcag')) {
        if (suggestions.length < 3) suggestions.push('Show WCAG compliance checklist');
        if (suggestions.length < 3) suggestions.push('Keyboard navigation patterns');
    }
    if (lower.includes('token') || lower.includes('spacing') || lower.includes('color')) {
        if (suggestions.length < 3) suggestions.push('List all design token categories');
        if (suggestions.length < 3) suggestions.push('How to use tokens in CSS');
    }
    if (lower.includes('code') || lower.includes('import') || lower.includes('example')) {
        if (suggestions.length < 3) suggestions.push('Show TypeScript interface');
        if (suggestions.length < 3) suggestions.push('View related Storybook stories');
    }

    const fallbacks = [
        'What components are available?',
        'Show design token system',
        'Accessibility best practices',
        'Most popular components',
        'How to customize themes',
        'Component migration guide',
    ];

    const hash = content.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    let fallbackIdx = hash % fallbacks.length;
    while (suggestions.length < 3) {
        const fb = fallbacks[fallbackIdx % fallbacks.length];
        if (!suggestions.includes(fb)) {
            suggestions.push(fb);
        }
        fallbackIdx++;
    }

    return suggestions.slice(0, 3);
}

// --- Helper: extract text from AI SDK UIMessage ---

function extractMessageText(msg: UIMessage): string {
    if (!msg.parts || msg.parts.length === 0) return '';
    return msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('\n\n');
}

// Toast Component
const ToastNotification = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: <CheckCircle className="w-5 h-5" />,
        error: <AlertCircle className="w-5 h-5" />,
        info: <AlertCircle className="w-5 h-5" />
    };

    const colors = {
        success: 'bg-terrain border-terrain',
        error: 'bg-compass border-compass-dark',
        info: 'bg-ocean border-ink'
    };

    return (
        <div className={`fixed top-4 right-4 md:top-24 md:right-8 left-4 md:left-auto ${colors[type]} text-white px-4 py-3 md:px-5 rounded shadow-xl border-2 z-50 animate-in slide-in-from-right-4 flex items-center gap-3`}>
            {icons[type]}
            <span className="font-semibold text-sm md:text-base flex-1">{message}</span>
            <button 
                onClick={onClose} 
                className="hover:opacity-70 transition-opacity flex-shrink-0"
                aria-label="Close notification"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// Source Badges Component
const SourceBadges = ({ sources }: { sources: SourceBadge[] }) => (
    <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-ink/8">
        <span className="text-caption text-muted uppercase tracking-wider self-center mr-1">Sources:</span>
        {sources.map((source) => (
            <span
                key={source.name}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-ink/5 text-caption text-ink/70 border-l-2 border-ink/20"
            >
                {source.name}
            </span>
        ))}
    </div>
);

// Follow-up Suggestion Chips Component
const SuggestionChips = ({ suggestions, onSelect }: { suggestions: string[]; onSelect: (query: string) => void }) => (
    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-ink/8">
        <span className="text-caption text-muted uppercase tracking-wider self-center mr-1 w-full mb-1">Follow up:</span>
        {suggestions.map((suggestion) => (
            <button
                key={suggestion}
                onClick={() => onSelect(suggestion)}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink/15 rounded-lg text-small text-ink hover:border-compass hover:bg-compass/5 transition-colors focus-ring"
            >
                <Navigation className="w-3.5 h-3.5 text-compass/60 group-hover:text-compass transition-colors" />
                <span className="truncate max-w-[200px]">{suggestion}</span>
            </button>
        ))}
    </div>
);

// --- Main Component ---

export function ChatInterface() {
    // Local display messages (with timestamps, images, sources, suggestions)
    const [displayMessages, setDisplayMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        queries: 0,
        indicesSearched: 7,
        componentsFound: 0,
        screenshotsAnalyzed: 0
    });
    const [showStats, setShowStats] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
    const [useStreaming, setUseStreaming] = useState(true);
    const [isFallbackLoading, setIsFallbackLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // AI SDK streaming chat
    const transport = useMemo(() => new DefaultChatTransport({
        api: ALGOLIA_STREAM_URL,
        headers: ALGOLIA_HEADERS,
    }), []);

    const {
        messages: streamMessages,
        sendMessage: sendStreamMessage,
        status: chatStatus,
        setMessages: setStreamMessages,
        error: streamError,
    } = useChat({
        transport,
        onError: (err) => {
            console.error('Streaming error, falling back to non-streaming:', err);
        },
    });

    const isStreaming = chatStatus === 'streaming' || chatStatus === 'submitted';
    const isLoading = isStreaming || isFallbackLoading;

    // Load conversation from localStorage on mount
    useEffect(() => {
        const savedMessages = localStorage.getItem('componentcompass_messages');
        const savedStats = localStorage.getItem('componentcompass_stats');

        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                setDisplayMessages(parsed.map((msg: LocalMessage) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                })));
            } catch (e) {
                console.error('Failed to load saved messages:', e);
            }
        }

        if (savedStats) {
            try {
                setSessionStats(JSON.parse(savedStats));
            } catch (e) {
                console.error('Failed to load saved stats:', e);
            }
        }
    }, []);

    // Save conversation to localStorage whenever display messages change
    useEffect(() => {
        if (displayMessages.length > 0) {
            localStorage.setItem('componentcompass_messages', JSON.stringify(displayMessages));
        }
    }, [displayMessages]);

    useEffect(() => {
        localStorage.setItem('componentcompass_stats', JSON.stringify(sessionStats));
    }, [sessionStats]);

    // Sync streaming messages into display messages
    useEffect(() => {
        if (!useStreaming || streamMessages.length === 0) return;

        const lastStreamMsg = streamMessages[streamMessages.length - 1];
        if (!lastStreamMsg || lastStreamMsg.role !== 'assistant') return;

        const streamText = extractMessageText(lastStreamMsg);
        if (!streamText) return;

        setDisplayMessages(prev => {
            const lastDisplay = prev[prev.length - 1];
            if (lastDisplay && lastDisplay.role === 'assistant' && lastDisplay.id === lastStreamMsg.id) {
                // Update existing streaming message
                return prev.map(m =>
                    m.id === lastStreamMsg.id
                        ? { ...m, content: streamText }
                        : m
                );
            } else if (lastDisplay && lastDisplay.role === 'user') {
                // Create new assistant message from stream
                return [...prev, {
                    id: lastStreamMsg.id,
                    role: 'assistant' as const,
                    content: streamText,
                    timestamp: new Date(),
                }];
            }
            return prev;
        });
    }, [streamMessages, useStreaming]);

    // When streaming finishes, add sources and suggestions
    useEffect(() => {
        if (chatStatus === 'ready' && streamMessages.length > 0 && useStreaming) {
            const lastStreamMsg = streamMessages[streamMessages.length - 1];
            if (lastStreamMsg?.role === 'assistant') {
                const text = extractMessageText(lastStreamMsg);
                if (text) {
                    const sources = getSourceBadges(text);
                    const suggestions = generateSuggestions(text);

                    setDisplayMessages(prev => {
                        return prev.map(m =>
                            m.id === lastStreamMsg.id
                                ? { ...m, content: text, sources, suggestions }
                                : m
                        );
                    });

                    trackMessageView([lastStreamMsg.id]);
                }
            }
        }
    }, [chatStatus, streamMessages, useStreaming]);

    // Handle stream errors — switch to fallback and retry only if no content was streamed
    useEffect(() => {
        if (streamError && useStreaming) {
            setUseStreaming(false);
            // Only retry via fallback if the stream didn't already produce content
            const lastMsg = displayMessages[displayMessages.length - 1];
            if (!lastMsg || lastMsg.role !== 'assistant') {
                console.warn('Streaming failed with no content, retrying via fallback.');
                const lastUserMsg = [...displayMessages].reverse().find(m => m.role === 'user');
                if (lastUserMsg) {
                    handleFallbackSend(lastUserMsg.content, null);
                }
            } else {
                // Stream produced partial content — add sources/suggestions to it
                const text = lastMsg.content;
                if (text && !lastMsg.sources) {
                    const sources = getSourceBadges(text);
                    const suggestions = generateSuggestions(text);
                    setDisplayMessages(prev => prev.map(m =>
                        m.id === lastMsg.id ? { ...m, sources, suggestions } : m
                    ));
                }
            }
        }
    }, [streamError, useStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [displayMessages, isLoading]);

    // Scroll button visibility handler
    useEffect(() => {
        const handleScroll = () => {
            if (messagesContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
                setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
            }
        };

        const container = messagesContainerRef.current;
        container?.addEventListener('scroll', handleScroll);
        return () => container?.removeEventListener('scroll', handleScroll);
    }, []);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
    }, []);

    const handleNewConversation = useCallback(() => {
        if (displayMessages.length > 0) {
            const confirmed = window.confirm('Start a new conversation? Your current conversation will be cleared.');
            if (confirmed) {
                setDisplayMessages([]);
                setStreamMessages([]);
                setSessionStats({
                    queries: 0,
                    indicesSearched: 7,
                    componentsFound: 0,
                    screenshotsAnalyzed: 0
                });
                localStorage.removeItem('componentcompass_messages');
                localStorage.removeItem('componentcompass_stats');
                agentClient.resetSession();
                showToast('New conversation started', 'success');
            }
        }
    }, [displayMessages.length, setStreamMessages, showToast]);

    const exportConversation = useCallback(() => {
        const markdown = displayMessages.map(msg => {
            const timestamp = msg.timestamp.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const role = msg.role === 'user' ? 'USER' : 'COMPASS';
            return `## ${role} · ${timestamp}\n\n${msg.content}\n\n---\n`;
        }).join('\n');

        const header = `# ComponentCompass Session Map\n\nExported: ${new Date().toLocaleString()}\n\n**Session Statistics:**\n- Queries: ${sessionStats.queries}\n- Indices Searched: ${sessionStats.indicesSearched}\n- Components Found: ${sessionStats.componentsFound}\n- Screenshots Analyzed: ${sessionStats.screenshotsAnalyzed}\n\n---\n\n`;

        const fullContent = header + markdown;

        const blob = new Blob([fullContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `component-compass-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Conversation exported successfully!', 'success');
    }, [displayMessages, sessionStats, showToast]);

    // Keyboard shortcuts handler
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                handleNewConversation();
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 'e' && displayMessages.length > 0) {
                e.preventDefault();
                exportConversation();
            }

            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                setShowStats(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyboard);
        return () => window.removeEventListener('keydown', handleKeyboard);
    }, [displayMessages.length, handleNewConversation, exportConversation]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setAttachedFile(file);
        }
    };

    const handleRemoveFile = () => {
        setAttachedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFallbackSend = useCallback(async (messageContent: string, file: File | null) => {
        setIsFallbackLoading(true);
        try {
            const response = await agentClient.sendMessage(messageContent);
            const sources = getSourceBadges(response);
            const suggestions = generateSuggestions(response);

            const assistantMessage: LocalMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                sources,
                suggestions,
            };
            setDisplayMessages(prev => [...prev, assistantMessage]);

            setSessionStats(prev => ({
                ...prev,
                queries: prev.queries + 1,
                componentsFound: prev.componentsFound + (messageContent.match(/\b(Button|Card|Modal|Input|Select|Dialog|Checkbox|Badge|Toast|Accordion|Alert|Nav|Tab)\b/gi) || [messageContent]).length,
                screenshotsAnalyzed: file?.type.startsWith('image/') ? prev.screenshotsAnalyzed + 1 : prev.screenshotsAnalyzed
            }));
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: LocalMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I encountered an issue searching the design system. This could be due to:\n\n- **Algolia Agent Studio configuration** — Check your \`.env\` file\n- **Network connectivity** — Verify your internet connection\n- **API rate limits** — You may have exceeded quota\n\n**Quick fixes:**\n1. Verify your \`VITE_ALGOLIA_AGENT_ID\` is correct\n2. Check that indices are properly configured\n3. Try again in a moment`,
                timestamp: new Date(),
            };
            setDisplayMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsFallbackLoading(false);
        }
    }, []);

    const handleSend = async () => {
        if ((!input.trim() && !attachedFile) || isLoading) return;

        let messageContent = input;
        let imageUrl: string | undefined;
        let fileName: string | undefined;

        if (attachedFile) {
            fileName = attachedFile.name;
            if (attachedFile.type.startsWith('image/')) {
                imageUrl = URL.createObjectURL(attachedFile);
                messageContent = input || `[Uploaded image: ${fileName}]`;
            } else {
                messageContent = input || `[Uploaded file: ${fileName}]`;
            }
        }

        const userMessage: LocalMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
            imageUrl,
            fileName,
        };

        setDisplayMessages(prev => [...prev, userMessage]);
        setInput('');
        const currentFile = attachedFile;
        setAttachedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (useStreaming) {
            try {
                await sendStreamMessage({ text: messageContent });
                setSessionStats(prev => ({
                    ...prev,
                    queries: prev.queries + 1,
                    componentsFound: prev.componentsFound + (messageContent.match(/\b(Button|Card|Modal|Input|Select|Dialog|Checkbox|Badge|Toast|Accordion|Alert|Nav|Tab)\b/gi) || [messageContent]).length,
                    screenshotsAnalyzed: currentFile?.type.startsWith('image/') ? prev.screenshotsAnalyzed + 1 : prev.screenshotsAnalyzed
                }));
            } catch (error) {
                console.error('Streaming send failed, trying fallback:', error);
                await handleFallbackSend(messageContent, currentFile);
            }
        } else {
            await handleFallbackSend(messageContent, currentFile);
        }
    };

    const handleExampleQuery = (query: string) => {
        setInput(query);
        setTimeout(() => {
            const textarea = document.querySelector('textarea');
            if (textarea) {
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    bubbles: true
                });
                textarea.dispatchEvent(enterEvent);
            }
        }, 300);
    };

    const handleSuggestionSelect = (query: string) => {
        trackSuggestionClick(query, []);
        setInput(query);
        setTimeout(() => {
            const textarea = document.querySelector('textarea');
            if (textarea) {
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    bubbles: true
                });
                textarea.dispatchEvent(enterEvent);
            }
        }, 150);
    };

    const detectComponents = (text: string): string[] => {
        const found: string[] = [];
        for (const name of KNOWN_COMPONENTS) {
            const regex = new RegExp(`\\b${name}\\b`, 'i');
            if (regex.test(text)) {
                found.push(name);
            }
        }
        return found.slice(0, 2); // max 2 per message
    };

    return (
        <div className="flex flex-col h-screen h-[100dvh] bg-parchment topo-background relative overflow-hidden">
            {/* Toast Notifications */}
            {toast && (
                <ToastNotification
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Decorative Compass Rose - Background (hidden on mobile) */}
            <div className="absolute top-20 right-10 w-32 h-32 opacity-5 pointer-events-none compass-spin hidden md:block">
                <Compass className="w-full h-full text-ink" />
            </div>

            {/* Header */}
            <header className="bg-warm-white border-b border-ink/15 px-4 py-4 md:px-6 shadow-sm relative z-10 safe-pt">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4">
                    <div className="flex items-center gap-3 md:gap-4 flex-shrink-0 min-w-0">
                        <div
                            className={cn(
                                "relative w-9 h-9 md:w-11 md:h-11 wax-seal rounded-full flex items-center justify-center flex-shrink-0 transition-transform",
                                isLoading && "scale-105"
                            )}
                            title={isLoading ? "Charting territories..." : "ComponentCompass"}
                        >
                            <Compass
                                className={cn(
                                    "w-4.5 h-4.5 md:w-5 md:h-5 text-white transition-transform",
                                    isLoading && "compass-spin"
                                )}
                            />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-h1 text-ink tracking-tight font-display truncate">
                                ComponentCompass
                            </h1>
                            <p className="text-caption text-muted tracking-wide uppercase">
                                Navigate Your Design System
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-2.5 flex-shrink-0">
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className="px-3 py-2 text-small text-ink border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors focus-ring"
                            title="Toggle Session Statistics"
                        >
                            <Map className="w-4 h-4 inline mr-1.5 opacity-60" />
                            <span className="hidden sm:inline">Stats</span>
                        </button>
                        {displayMessages.length > 0 && (
                            <>
                                <button
                                    onClick={exportConversation}
                                    className="px-3 py-2 text-small text-ink border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors focus-ring"
                                    title="Export Conversation"
                                >
                                    <Download className="w-4 h-4 inline mr-1.5 opacity-60" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                                <button
                                    onClick={handleNewConversation}
                                    className="px-3 py-2 text-small bg-compass text-white rounded-lg hover:bg-compass-dark transition-colors shadow-sm focus-ring"
                                    title="New Conversation"
                                >
                                    <RotateCw className="w-4 h-4 inline mr-1.5" />
                                    <span className="hidden sm:inline">New</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Session Statistics Panel */}
                {showStats && (
                    <div className="max-w-7xl mx-auto mt-4 p-4 bg-white border border-ink/10 rounded-lg shadow-sm animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-h2 text-compass font-display">
                                    {sessionStats.queries}
                                </div>
                                <div className="text-caption text-muted uppercase tracking-wide">Queries</div>
                            </div>
                            <div>
                                <div className="text-h2 text-ocean font-display">
                                    {sessionStats.indicesSearched}
                                </div>
                                <div className="text-caption text-muted uppercase tracking-wide">Indices</div>
                            </div>
                            <div>
                                <div className="text-h2 text-terrain font-display">
                                    {sessionStats.componentsFound}
                                </div>
                                <div className="text-caption text-muted uppercase tracking-wide">Components</div>
                            </div>
                            <div>
                                <div className="text-h2 text-gold font-display">
                                    {sessionStats.screenshotsAnalyzed}
                                </div>
                                <div className="text-caption text-muted uppercase tracking-wide">Screenshots</div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Messages Container */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-8">
                <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                    {/* Welcome Screen */}
                    {displayMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in px-4">
                            <div className="relative w-16 h-16 md:w-20 md:h-20 wax-seal rounded-full mb-6 flex items-center justify-center">
                                <Compass className="w-8 h-8 md:w-10 md:h-10 text-white" />
                            </div>
                            <h2 className="text-display text-ink tracking-tight font-display mb-3">
                                Chart Your Course
                            </h2>
                            <p className="max-w-xl text-body text-terrain mb-2">
                                Navigate your design system with an intelligent AI assistant.
                            </p>
                            <p className="max-w-lg text-small text-muted mb-10">
                                Discover components, explore implementations, and find accessibility guidelines.
                            </p>

                            {/* Suggested Prompts */}
                            <div className="w-full max-w-3xl">
                                <p className="text-caption text-muted uppercase tracking-wider mb-4">
                                    Try asking about
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { icon: <Navigation className="w-4 h-4" />, text: 'Show me accessible buttons', desc: 'WCAG compliant variants' },
                                        { icon: <Map className="w-4 h-4" />, text: 'Card component implementation', desc: 'Code examples' },
                                        { icon: <Image className="w-4 h-4" />, text: 'Analyze this design mockup', desc: 'Vision analysis' },
                                        { icon: <Compass className="w-4 h-4" />, text: 'Design tokens for spacing', desc: 'System foundations' }
                                    ].map((prompt) => (
                                        <button
                                            key={prompt.text}
                                            onClick={() => handleExampleQuery(prompt.text)}
                                            className="group p-4 bg-white border border-ink/10 rounded-lg text-left hover:border-compass/40 hover:shadow-sm transition-all focus-ring"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center text-ink/50 group-hover:bg-compass/10 group-hover:text-compass transition-colors">
                                                    {prompt.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-small font-medium text-ink group-hover:text-compass transition-colors truncate">
                                                        {prompt.text}
                                                    </div>
                                                    <div className="text-caption text-muted">
                                                        {prompt.desc}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Message List */}
                    {displayMessages.map((msg, index) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-2",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[90%] md:max-w-[80%] rounded-lg p-4 md:p-5",
                                    msg.role === 'user'
                                        ? "bg-ocean text-white shadow-sm"
                                        : "bg-white border border-ink/10 text-ink shadow-sm"
                                )}
                            >
                                {/* Timestamp */}
                                <div className={cn(
                                    "text-caption font-mono mb-2 tracking-wider uppercase",
                                    msg.role === 'user' ? "text-white/50" : "text-muted"
                                )}>
                                    {msg.role === 'user' ? 'You' : 'Compass'} · {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    {msg.role === 'assistant' && isStreaming && index === displayMessages.length - 1 && (
                                        <span className="ml-2 text-compass/70">●</span>
                                    )}
                                </div>

                                {msg.imageUrl && (
                                    <div className="mb-4 md:mb-5 p-2 bg-ink/5 rounded border border-ink/10">
                                        <img
                                            src={msg.imageUrl}
                                            alt="Uploaded screenshot"
                                            className="max-w-full rounded shadow-lg"
                                        />
                                        <p className="text-xs text-terrain mt-2 italic">Screenshot Analysis</p>
                                    </div>
                                )}

                                <div className={cn(
                                    "prose prose-sm max-w-none",
                                    msg.role === 'user'
                                        ? "prose-invert [&>p]:text-white [&>ul]:text-white [&>ol]:text-white"
                                        : "[&>p]:text-ink [&>ul]:text-ink [&>ol]:text-ink [&>h1]:font-display [&>h2]:font-display [&>h3]:font-display [&>strong]:text-compass"
                                )}>
                                    <ReactMarkdown
                                        components={{
                                            code({ className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                const codeString = String(children).replace(/\n$/, '');
                                                const isInline = !match && !codeString.includes('\n');

                                                if (!isInline && match) {
return <CodeBlock code={codeString} language={match[1]} />;
                                                }

                                                return (
                                                    <code className={cn(
                                                        "rounded px-1.5 py-0.5 text-sm font-mono border",
                                                        msg.role === 'user'
                                                            ? "bg-white/20 border-white/30"
                                                            : "bg-ink/10 border-ink/20 text-compass",
                                                        className
                                                    )} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            },
                                            a({ children, href }) {
                                                return (
                                                    <a
                                                        href={href}
                                                        className="text-compass underline decoration-compass/40 hover:decoration-compass font-semibold transition-all"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {children}
                                                    </a>
                                                );
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Feedback Buttons */}
                                {msg.role === 'assistant' && !(isStreaming && index === displayMessages.length - 1) && (
                                    <FeedbackButtons messageId={msg.id} />
                                )}

                                {/* Component Cards */}
                                {msg.role === 'assistant' && !(isStreaming && index === displayMessages.length - 1) && (
                                    (() => {
                                        const detected = detectComponents(msg.content);
                                        return detected.length > 0 ? (
                                            <div className="mt-2">
                                                {detected.map(name => (
                                                    <ComponentCard
                                                        key={name}
                                                        componentName={name}
                                                        onAction={handleSuggestionSelect}
                                                    />
                                                ))}
                                            </div>
                                        ) : null;
                                    })()
                                )}

                                {/* Source Badges */}
                                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                                    <SourceBadges sources={msg.sources} />
                                )}

                                {/* Follow-up Suggestion Chips */}
                                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !isLoading && (
                                    <SuggestionChips suggestions={msg.suggestions} onSelect={handleSuggestionSelect} />
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Loading State */}
                    {isLoading && (displayMessages.length === 0 || displayMessages[displayMessages.length - 1]?.role !== 'assistant') && (
                        <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2">
                            <div className="max-w-[90%] md:max-w-[80%] bg-white border border-ink/10 rounded-lg p-4 md:p-5 shadow-sm">
                                <div className="text-caption font-mono mb-3 tracking-wider uppercase text-muted">
                                    Compass
                                </div>

                                <div className="flex items-center gap-3 mb-4">
                                    <Compass className="w-5 h-5 text-compass/60 compass-spin flex-shrink-0" />
                                    <span className="text-small text-ink">Searching design system...</span>
                                </div>

                                {/* Skeleton content */}
                                <div className="space-y-2">
                                    <div className="h-3 bg-ink/5 rounded-lg animate-pulse"></div>
                                    <div className="h-3 bg-ink/5 rounded-lg animate-pulse w-3/4"></div>
                                    <div className="h-3 bg-ink/5 rounded-lg animate-pulse w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-ink/10 bg-warm-white px-4 py-4 md:px-6 md:py-5 safe-pb">
                <div className="max-w-4xl mx-auto">
                    {/* File Attachment Preview */}
                    {attachedFile && (
                        <div className="mb-3 p-3 bg-gold/5 border border-gold/30 rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {attachedFile.type.startsWith('image/') ? (
                                    <Image className="w-4 h-4 text-gold flex-shrink-0" />
                                ) : (
                                    <Paperclip className="w-4 h-4 text-gold flex-shrink-0" />
                                )}
                                <span className="text-small text-ink truncate">{attachedFile.name}</span>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="p-1 text-ink/40 hover:text-ink transition-colors flex-shrink-0 ml-2 focus-ring rounded"
                                aria-label="Remove attached file"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Input Box */}
                    <div className="flex items-end gap-2 p-2 bg-white border border-ink/15 rounded-lg focus-within:border-compass/50 focus-within:shadow-sm transition-all">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="screenshot-upload"
                            aria-label="Upload screenshot for AI analysis"
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-ink/40 hover:text-compass hover:bg-compass/5 rounded-lg transition-colors flex-shrink-0 focus-ring"
                            title="Upload image"
                            aria-label="Upload screenshot for AI analysis"
                        >
                            <Image className="w-5 h-5" />
                        </button>

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask about components, accessibility, tokens..."
                            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-32 py-2.5 text-body text-ink placeholder-muted"
                            rows={1}
                            style={{ minHeight: '44px' }}
                        />

                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !attachedFile) || isLoading}
                            className={cn(
                                "p-2.5 rounded-lg transition-all flex-shrink-0 focus-ring",
                                (input.trim() || attachedFile) && !isLoading
                                    ? "bg-compass text-white hover:bg-compass-dark shadow-sm"
                                    : "bg-ink/5 text-ink/30 cursor-not-allowed"
                            )}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-3 text-center text-caption text-muted flex items-center justify-center gap-3">
                        <span>Powered by Algolia</span>
                        <span className="hidden sm:inline text-ink/20">·</span>
                        <span className="hidden sm:inline">⏎ send</span>
                        <span className="hidden md:inline text-ink/20">·</span>
                        <span className="hidden md:inline">⇧⏎ new line</span>
                    </div>
                </div>
            </div>

            {/* Scroll-to-Bottom FAB */}
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    className="fixed bottom-24 md:bottom-32 right-4 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-compass text-white rounded-full shadow-xl hover:bg-compass-dark transition-all hover:scale-110 z-20 flex items-center justify-center wax-seal"
                    aria-label="Scroll to bottom"
                >
                    <Navigation className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
                </button>
            )}
        </div>
    );
}
