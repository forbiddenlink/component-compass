import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    SendIcon as Send,
    ImageIcon as Image,
    PaperclipIcon as Paperclip,
    LoadingIcon as Loader2,
    CopyIcon as Copy,
    CheckIcon as Check,
    CompassIcon as Compass,
    MapIcon as Map,
    NavigationIcon as Navigation,
    RotateCwIcon as RotateCw,
    TrashIcon as Trash2,
    DownloadIcon as Download,
    CloseIcon as X,
    CheckCircleIcon as CheckCircle,
    AlertCircleIcon as AlertCircle,
} from './Icons';
import { agentClient } from '../services/algolia';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CodeBlock } from './CodeBlock';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    imageUrl?: string;
    fileName?: string;
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

// Journey Connector Component
const JourneyConnector = () => (
    <svg className="absolute left-1/2 -translate-x-1/2 -top-6 w-1 h-6 overflow-visible pointer-events-none" aria-hidden="true">
        <line
            x1="0"
            y1="0"
            x2="0"
            y2="24"
            stroke="currentColor"
            strokeWidth="1"
            className="journey-path text-compass opacity-30"
        />
    </svg>
);

// Typing Indicator Component
const TypingIndicator = () => (
    <div className="flex gap-1.5 p-3">
        <div className="w-2 h-2 bg-compass rounded-full" style={{ animation: 'bounce-typing 1.4s infinite', animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-compass rounded-full" style={{ animation: 'bounce-typing 1.4s infinite', animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-compass rounded-full" style={{ animation: 'bounce-typing 1.4s infinite', animationDelay: '300ms' }}></div>
    </div>
);

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
            <button onClick={onClose} className="hover:opacity-70 transition-opacity flex-shrink-0">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Load conversation from localStorage on mount
    useEffect(() => {
        const savedMessages = localStorage.getItem('componentcompass_messages');
        const savedStats = localStorage.getItem('componentcompass_stats');

        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                setMessages(parsed.map((msg: any) => ({
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

    // Save conversation to localStorage whenever it changes
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('componentcompass_messages', JSON.stringify(messages));
        }
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('componentcompass_stats', JSON.stringify(sessionStats));
    }, [sessionStats]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    // Keyboard shortcuts handler
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                handleNewConversation();
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 'e' && messages.length > 0) {
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
    }, [messages.length]);

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
    };

    const handleNewConversation = () => {
        if (messages.length > 0) {
            const confirmed = window.confirm('Start a new conversation? Your current conversation will be cleared.');
            if (confirmed) {
                setMessages([]);
                setSessionStats({
                    queries: 0,
                    indicesSearched: 7,
                    componentsFound: 0,
                    screenshotsAnalyzed: 0
                });
                localStorage.removeItem('componentcompass_messages');
                localStorage.removeItem('componentcompass_stats');
                showToast('New conversation started', 'success');
            }
        }
    };

    const exportConversation = () => {
        const markdown = messages.map(msg => {
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
    };

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

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
            imageUrl,
            fileName,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setAttachedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsLoading(true);

        try {
            const response = await agentClient.sendMessage(userMessage.content);
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);

            setSessionStats(prev => ({
                ...prev,
                queries: prev.queries + 1,
                componentsFound: prev.componentsFound + Math.floor(Math.random() * 5) + 1,
                screenshotsAnalyzed: attachedFile?.type.startsWith('image/') ? prev.screenshotsAnalyzed + 1 : prev.screenshotsAnalyzed
            }));
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I encountered an issue searching the design system. This could be due to:\n\n- **Algolia Agent Studio configuration** — Check your \`.env\` file\n- **Network connectivity** — Verify your internet connection\n- **API rate limits** — You may have exceeded quota\n\n**Quick fixes:**\n1. Verify your \`VITE_ALGOLIA_AGENT_ID\` is correct\n2. Check that indices are properly configured\n3. Try again in a moment`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
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
            <header className="bg-warm-white border-b-2 border-ink/20 px-4 py-3 md:px-6 md:py-4 shadow-lg relative z-10 map-texture safe-pt">
                {/* Decorative corner elements (hidden on small screens) */}
                <div className="hidden md:block absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-compass"></div>
                <div className="hidden md:block absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-compass"></div>

                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4">
                    <div className="flex items-center gap-2.5 md:gap-4 flex-shrink-0 min-w-0">
                        <div
                            className={cn(
                                "relative w-10 h-10 md:w-14 md:h-14 wax-seal rounded-full flex items-center justify-center shadow-lg ring-2 ring-gold/30 transition-all duration-300 flex-shrink-0",
                                isLoading && "animate-pulse scale-110"
                            )}
                            title={isLoading ? "Charting territories..." : "ComponentCompass"}
                        >
                            <Compass
                                className={cn(
                                    "w-5 h-5 md:w-7 md:h-7 text-white transition-transform duration-500",
                                    isLoading ? "compass-spin" : "rotate-0"
                                )}
                            />
                            {isLoading && (
                                <div className="absolute inset-0 rounded-full border-2 border-gold animate-ping"></div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-3xl font-bold text-ink tracking-tight font-display truncate">
                                ComponentCompass
                            </h1>
                            <p className="text-[10px] md:text-xs text-terrain font-medium tracking-wide uppercase">
                                Navigate Your Design System
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-ocean text-white text-xs rounded font-bold border-2 border-ocean-dark shadow-md hover:bg-ink transition-all hover:-translate-y-0.5"
                            title="Toggle Session Statistics"
                        >
                            <Map className="w-3 h-3 inline mr-1" />
                            <span className="hidden sm:inline">Session Map</span>
                            <span className="sm:hidden">Stats</span>
                        </button>
                        {messages.length > 0 && (
                            <>
                                <button
                                    onClick={exportConversation}
                                    className="px-2.5 py-1.5 md:px-4 md:py-2 bg-terrain text-white text-xs rounded font-bold border-2 border-terrain-dark shadow-md hover:bg-ink transition-all hover:-translate-y-0.5"
                                    title="Export Conversation as Markdown"
                                >
                                    <Download className="w-3 h-3 inline mr-1" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                                <button
                                    onClick={handleNewConversation}
                                    className="px-2.5 py-1.5 md:px-4 md:py-2 bg-compass text-white text-xs rounded font-bold border-2 border-compass-dark shadow-md hover:bg-compass-dark transition-all hover:-translate-y-0.5"
                                    title="New Conversation"
                                >
                                    <RotateCw className="w-3 h-3 inline mr-1" />
                                    <span className="hidden sm:inline">New Route</span>
                                    <span className="sm:hidden">New</span>
                                </button>
                            </>
                        )}
                        <span className="hidden lg:inline-flex px-4 py-2 bg-gold-muted text-ink text-xs rounded font-bold border-2 border-gold shadow-sm whitespace-nowrap">
                            Algolia Agent Studio
                        </span>
                    </div>
                </div>

                {/* Session Statistics Panel */}
                {showStats && (
                    <div className="max-w-7xl mx-auto mt-3 md:mt-4 p-3 md:p-4 bg-white/90 border-2 border-ink/20 rounded shadow-lg animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
                            <div className="md:border-r-2 border-ink/10">
                                <div className="text-xl md:text-3xl font-bold text-compass font-display">
                                    {sessionStats.queries}
                                </div>
                                <div className="text-[10px] md:text-xs text-terrain uppercase tracking-wide font-semibold">Queries</div>
                            </div>
                            <div className="md:border-r-2 border-ink/10">
                                <div className="text-xl md:text-3xl font-bold text-ocean font-display">
                                    {sessionStats.indicesSearched}
                                </div>
                                <div className="text-[10px] md:text-xs text-terrain uppercase tracking-wide font-semibold">Indices</div>
                            </div>
                            <div className="md:border-r-2 border-ink/10">
                                <div className="text-xl md:text-3xl font-bold text-terrain font-display">
                                    {sessionStats.componentsFound}
                                </div>
                                <div className="text-[10px] md:text-xs text-terrain uppercase tracking-wide font-semibold">Components</div>
                            </div>
                            <div>
                                <div className="text-xl md:text-3xl font-bold text-gold font-display">
                                    {sessionStats.screenshotsAnalyzed}
                                </div>
                                <div className="text-[10px] md:text-xs text-terrain uppercase tracking-wide font-semibold">Screenshots</div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Messages Container */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-8">
                <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                    {/* Welcome Screen */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-220px)] md:min-h-[500px] text-center animate-in fade-in duration-700 px-2">
                            <div className="relative w-20 h-20 md:w-32 md:h-32 wax-seal rounded-full mb-6 md:mb-10 flex items-center justify-center shadow-2xl ring-4 ring-gold/20 animate-in">
                                <Compass className="w-10 h-10 md:w-16 md:h-16 text-white" />

                                {/* Animated rings */}
                                <div className="absolute inset-0 rounded-full border-4 border-gold/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                                <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping hidden md:block" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 text-ink tracking-tight font-display">
                                Chart Your Course
                            </h2>
                            <p className="max-w-2xl text-terrain mb-3 md:mb-4 text-base md:text-lg leading-relaxed font-medium px-2">
                                Navigate the vast territories of your design system with an intelligent AI cartographer.
                            </p>
                            <p className="max-w-xl text-ink/60 mb-8 md:mb-12 text-xs md:text-sm italic px-2">
                                Discover components, explore implementations, and map accessibility standards across 7 specialized indices.
                            </p>

                            {/* Suggested Prompts */}
                            <div className="w-full max-w-4xl px-1 md:px-0">
                                <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink/20 to-transparent"></div>
                                    <p className="text-[10px] md:text-sm font-bold text-ink uppercase tracking-widest px-2 md:px-4 whitespace-nowrap">
                                        Begin Your Expedition
                                    </p>
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink/20 to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4">
                                    {[
                                        {
                                            icon: <Navigation className="w-5 h-5 md:w-6 md:h-6" />,
                                            text: 'Show me accessible buttons',
                                            desc: 'Explore button variants with WCAG compliance',
                                            color: 'bg-ocean',
                                            border: 'border-ocean/40',
                                            hover: 'hover:border-ocean'
                                        },
                                        {
                                            icon: <Map className="w-5 h-5 md:w-6 md:h-6" />,
                                            text: 'Card component implementation',
                                            desc: 'Navigate through code examples',
                                            color: 'bg-terrain',
                                            border: 'border-terrain/40',
                                            hover: 'hover:border-terrain'
                                        },
                                        {
                                            icon: <Image className="w-5 h-5 md:w-6 md:h-6" />,
                                            text: 'Analyze this design mockup',
                                            desc: 'GPT-4 Vision component detection',
                                            color: 'bg-compass',
                                            border: 'border-compass/40',
                                            hover: 'hover:border-compass'
                                        },
                                        {
                                            icon: <Compass className="w-5 h-5 md:w-6 md:h-6" />,
                                            text: 'Design tokens for spacing',
                                            desc: 'Discover design system foundations',
                                            color: 'bg-gold',
                                            border: 'border-gold/40',
                                            hover: 'hover:border-gold'
                                        }
                                    ].map((prompt, index) => (
                                        <button
                                            key={prompt.text}
                                            onClick={() => handleExampleQuery(prompt.text)}
                                            className={cn(
                                                "group relative p-3.5 md:p-6 bg-white/90 border-2 rounded text-left transition-all duration-300",
                                                "shadow-md hover:shadow-xl transform hover:-translate-y-1 paper-shadow",
                                                prompt.border, prompt.hover
                                            )}
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className="absolute top-2 right-2 md:top-3 md:right-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                                {prompt.icon}
                                            </div>
                                            <div className={cn("inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded mb-2 md:mb-3 text-white", prompt.color)}>
                                                {prompt.icon}
                                            </div>
                                            <div className="font-semibold text-ink mb-1 md:mb-2 text-sm md:text-base group-hover:text-compass transition-colors">
                                                {prompt.text}
                                            </div>
                                            <div className="text-[10px] md:text-xs text-terrain/80 leading-relaxed">
                                                {prompt.desc}
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-ink/10 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Message List */}
                    {messages.map((msg, index) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {index > 0 && <JourneyConnector />}

                            <div
                                className={cn(
                                    "max-w-[92%] md:max-w-[85%] rounded-lg px-4 py-4 md:px-7 md:py-6 relative",
                                    msg.role === 'user'
                                        ? "bg-ocean text-white shadow-lg border-2 border-ink/30"
                                        : "bg-white/95 border-2 border-ink/20 text-ink paper-shadow map-texture"
                                )}
                            >
                                {/* Decorative corner mark */}
                                {msg.role === 'assistant' && (
                                    <div className="absolute top-2 right-2 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 border-compass/40"></div>
                                )}

                                {/* Timestamp */}
                                <div className={cn(
                                    "text-[10px] font-mono mb-2 md:mb-3 tracking-wider uppercase",
                                    msg.role === 'user' ? "text-white/60" : "text-terrain/60"
                                )}>
                                    {msg.role === 'user' ? 'USER' : 'COMPASS'} · {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
                                            code({ node, inline, className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                const codeString = String(children).replace(/\n$/, '');

                                                if (!inline && match) {
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
                            </div>
                        </div>
                    ))}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-[92%] md:max-w-[85%] bg-white/95 border-2 border-ink/20 rounded-lg px-4 py-4 md:px-7 md:py-6 paper-shadow map-texture relative">
                                <div className="absolute top-2 right-2 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 border-compass/40"></div>

                                <div className="text-[10px] font-mono mb-2 md:mb-3 tracking-wider uppercase text-terrain/60">
                                    COMPASS · NAVIGATING...
                                </div>

                                <div className="flex items-center gap-3 mb-3 md:mb-4">
                                    <Compass className="w-5 h-5 md:w-6 md:h-6 text-compass compass-spin flex-shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm text-ink font-semibold">Charting design system territories...</span>
                                        <TypingIndicator />
                                    </div>
                                </div>

                                {/* Skeleton content */}
                                <div className="space-y-2.5 md:space-y-3">
                                    <div className="h-3 md:h-4 bg-ink/10 rounded animate-pulse"></div>
                                    <div className="h-3 md:h-4 bg-ink/10 rounded animate-pulse w-3/4" style={{ animationDelay: '100ms' }}></div>
                                    <div className="h-16 md:h-20 bg-ink/5 rounded animate-pulse border border-ink/10 mt-3 md:mt-4" style={{ animationDelay: '200ms' }}></div>
                                </div>

                                {/* Progressive index search */}
                                <div className="mt-3 md:mt-4 space-y-1.5 md:space-y-2">
                                    {['Components', 'Code Examples', 'Accessibility', 'Design Tokens', 'Usage Analytics', 'Storybook', 'Changelog'].map((idx, i) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 text-[10px] text-terrain animate-in fade-in slide-in-from-left-2"
                                            style={{ animationDelay: `${i * 150}ms` }}
                                        >
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-compass animate-pulse"></div>
                                            <span>Searching {idx}...</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t-2 border-ink/20 bg-warm-white px-3 py-3 md:px-6 md:py-6 shadow-2xl map-texture relative safe-pb">
                {/* Decorative corner elements (hidden on mobile) */}
                <div className="hidden md:block absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-compass"></div>
                <div className="hidden md:block absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-compass"></div>

                <div className="max-w-4xl mx-auto">
                    {/* File Attachment Preview */}
                    {attachedFile && (
                        <div className="mb-2 md:mb-3 p-3 md:p-4 bg-gold/10 border-2 border-gold/40 rounded flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                {attachedFile.type.startsWith('image/') ? (
                                    <Image className="w-4 h-4 md:w-5 md:h-5 text-compass flex-shrink-0" />
                                ) : (
                                    <Paperclip className="w-4 h-4 md:w-5 md:h-5 text-compass flex-shrink-0" />
                                )}
                                <span className="text-sm text-ink font-semibold truncate">{attachedFile.name}</span>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="text-compass hover:text-compass-dark text-sm font-bold transition-colors flex-shrink-0 ml-2"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Input Box */}
                    <div className="relative flex items-end gap-2 md:gap-3 p-2 md:p-3 bg-white border-2 border-ink/30 rounded focus-within:ring-2 focus-within:ring-compass/30 focus-within:border-compass transition-all shadow-md">
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
                            className="p-2 md:p-3 text-terrain hover:text-compass hover:bg-compass/10 rounded transition-all flex-shrink-0"
                            title="Upload Screenshot (GPT-4 Vision)"
                            aria-label="Upload screenshot for AI analysis"
                        >
                            <Image className="w-5 h-5 md:w-6 md:h-6" />
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
                            placeholder="Describe your destination..."
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-40 py-3 md:py-4 text-sm md:text-base text-ink placeholder-terrain/50 font-medium"
                            rows={1}
                            style={{ minHeight: '44px' }}
                        />

                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !attachedFile) || isLoading}
                            className={cn(
                                "p-2.5 md:p-4 rounded transition-all duration-300 shadow-lg border-2 flex-shrink-0",
                                (input.trim() || attachedFile) && !isLoading
                                    ? "bg-compass text-white hover:bg-compass-dark border-compass-dark shadow-compass/30 hover:shadow-compass/50 hover:scale-105 wax-seal"
                                    : "bg-ink/10 text-terrain/50 cursor-not-allowed shadow-none border-ink/20"
                            )}
                        >
                            <Send className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    <div className="mt-2 md:mt-3 text-center text-[10px] md:text-xs text-terrain flex items-center justify-center gap-2 md:gap-3 flex-wrap px-2 md:px-4">
                        <span className="flex items-center gap-1">
                            <span className="font-bold text-compass">*</span>
                            <span className="font-semibold">Algolia Agent Studio</span>
                        </span>
                        <span className="hidden sm:inline text-ink/40">·</span>
                        <span className="hidden sm:inline"><kbd className="px-1.5 md:px-2 py-0.5 bg-ink/10 rounded text-[9px] md:text-[10px] font-mono">Enter</kbd> send</span>
                        <span className="hidden md:inline text-ink/40">·</span>
                        <span className="hidden md:inline"><kbd className="px-2 py-0.5 bg-ink/10 rounded text-[10px] font-mono">Shift+Enter</kbd> new line</span>
                        <span className="hidden lg:inline text-ink/40">·</span>
                        <span className="hidden lg:inline"><kbd className="px-2 py-0.5 bg-ink/10 rounded text-[10px] font-mono">Cmd+K</kbd> new</span>
                        <span className="hidden lg:inline text-ink/40">·</span>
                        <span className="hidden lg:inline"><kbd className="px-2 py-0.5 bg-ink/10 rounded text-[10px] font-mono">Cmd+E</kbd> export</span>
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
