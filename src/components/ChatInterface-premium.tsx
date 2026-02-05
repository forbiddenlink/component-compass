import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { agentClient } from '../services/algolia';
import { analyzeDesignScreenshot, imageToBase64 } from '../services/vision';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CodeBlock } from './CodeBlock';
import { CompassIcon, SparklesIcon, ImageUploadIcon, SendIcon, LoadingIcon, CloseIcon, PaletteIcon, DocumentIcon, LightbulbIcon, NavigationIcon } from './Icons';

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

const suggestedPrompts = [
    {
        Icon: PaletteIcon,
        title: 'Show me accessible buttons',
        description: 'Learn about button variants and ARIA attributes',
        gradient: 'from-violet-500 to-purple-500',
        iconGradient: 'from-violet-600 to-purple-600'
    },
    {
        Icon: DocumentIcon,
        title: 'Input field with error state',
        description: 'Form validation patterns and examples',
        gradient: 'from-blue-500 to-cyan-500',
        iconGradient: 'from-blue-600 to-cyan-600'
    },
    {
        Icon: ImageUploadIcon,
        title: 'Upload design mockup',
        description: 'AI analyzes screenshots to identify components',
        gradient: 'from-emerald-500 to-teal-500',
        iconGradient: 'from-emerald-600 to-teal-600'
    },
    {
        Icon: LightbulbIcon,
        title: 'How do I use the Card component?',
        description: 'Usage guidelines and code examples',
        gradient: 'from-orange-500 to-amber-500',
        iconGradient: 'from-orange-600 to-amber-600'
    }
];

const loadingMessages = [
    { main: 'Searching components...', sub: 'Querying components_index' },
    { main: 'Checking accessibility patterns...', sub: 'Searching accessibility_index' },
    { main: 'Finding code examples...', sub: 'Looking in code_implementations_index' },
    { main: 'Reviewing design tokens...', sub: 'Checking design_tokens_index' },
    { main: 'Analyzing usage patterns...', sub: 'Querying usage_analytics_index' },
    { main: 'Generating response...', sub: 'Synthesizing results from 7 indices' },
];

const getFollowUpSuggestions = (lastMessage: string) => {
    const lower = lastMessage.toLowerCase();
    if (lower.includes('button')) {
        return [
            'Show me the accessible version',
            'How is this used in production?',
            'What are the available variants?',
            'Show me the Figma component'
        ];
    }
    if (lower.includes('input') || lower.includes('form')) {
        return [
            'How do I add validation?',
            'Show me error states',
            'What ARIA attributes are needed?',
            'Show me a complete form example'
        ];
    }
    if (lower.includes('color') || lower.includes('token')) {
        return [
            'Show all color tokens',
            'What about dark mode?',
            'Show spacing tokens',
            'How do I use these in code?'
        ];
    }
    return [
        'Show me related components',
        'How do I use this accessibly?',
        'Where is this used?',
        'Show me code examples'
    ];
};

const mockSources = [
    { name: 'Components', color: 'violet', count: 3 },
    { name: 'Code Examples', color: 'blue', count: 5 },
    { name: 'Accessibility', color: 'emerald', count: 2 },
    { name: 'Design Tokens', color: 'orange', count: 8 },
];

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Load persisted conversation on mount
    useEffect(() => {
        try {
            const savedMessages = localStorage.getItem('componentcompass_messages');
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                setMessages(parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                })));
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    }, []);

    // Save conversation to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            try {
                localStorage.setItem('componentcompass_messages', JSON.stringify(messages));
            } catch (error) {
                console.error('Failed to save conversation:', error);
            }
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle scroll button visibility
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollButton(!isNearBottom && messages.length > 0);
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [messages.length]);

    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ⌘K or Ctrl+K to clear conversation
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                clearConversation();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [messages.length]);

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

    const clearConversation = () => {
        if (messages.length === 0) return;
        if (window.confirm('Clear conversation history? This cannot be undone.')) {
            setMessages([]);
            localStorage.removeItem('componentcompass_messages');
        }
    };

    const tryExample = (query: string) => {
        setInput(query);
        setTimeout(() => {
            handleSend();
        }, 100);
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
                messageContent = input || `Analyze this design screenshot`;
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
        const fileToAnalyze = attachedFile;
        setAttachedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsLoading(true);

        try {
            let queryToSend = messageContent;

            // If image is attached, analyze it first with GPT-4 Vision
            if (fileToAnalyze && fileToAnalyze.type.startsWith('image/')) {
                setIsAnalyzingImage(true);
                try {
                    const base64Image = await imageToBase64(fileToAnalyze);
                    const visionResult = await analyzeDesignScreenshot(base64Image);
                    
                    // Create enhanced query with vision analysis
                    const componentsList = visionResult.components
                        .map((c: { name: string; description: string }) => `${c.name} (${c.description})`)
                        .join(', ');
                    
                    queryToSend = `I've analyzed a design screenshot that contains these UI components: ${componentsList}. ${visionResult.layout ? `Layout: ${visionResult.layout}.` : ''} ${visionResult.designStyle ? `Design style: ${visionResult.designStyle}.` : ''} ${input || 'Please provide detailed information about these components, including code examples and accessibility guidelines.'}`;
                    
                    // Add vision analysis as system context
                    const visionMessage: Message = {
                        id: (Date.now() + 0.5).toString(),
                        role: 'assistant',
                        content: `🔍 **Vision Analysis Complete**\n\n**Detected Components:** ${visionResult.components.map((c: { name: string }) => `${c.name}`).join(', ')}\n\n**Layout:** ${visionResult.layout}\n\n**Design Style:** ${visionResult.designStyle}\n\nNow searching our component library for matches...`,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, visionMessage]);
                } catch (visionError) {
                    console.error('Vision analysis failed:', visionError);
                    const errorMsg = visionError instanceof Error ? visionError.message : 'Unknown error';
                    
                    // Check if it's an API key error
                    if (errorMsg.includes('API key')) {
                        const configMessage: Message = {
                            id: (Date.now() + 0.5).toString(),
                            role: 'assistant',
                            content: '⚠️ **OpenAI API Key Required**\n\nTo use screenshot analysis, add your OpenAI API key to `.env`:\n\n```\nVITE_OPENAI_API_KEY=your_key_here\n```\n\nFor now, I\'ll search based on your text query.',
                            timestamp: new Date(),
                        };
                        setMessages((prev) => [...prev, configMessage]);
                    } else {
                        const errorMessage: Message = {
                            id: (Date.now() + 0.5).toString(),
                            role: 'assistant',
                            content: `⚠️ Image analysis failed: ${errorMsg}\n\nContinuing with text search...`,
                            timestamp: new Date(),
                        };
                        setMessages((prev) => [...prev, errorMessage]);
                    }
                } finally {
                    setIsAnalyzingImage(false);
                }
            }

            const response = await agentClient.sendMessage(queryToSend);
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            let helpfulMessage = '❌ **Something went wrong**\n\n';
            
            if (errorMsg.includes('API') || errorMsg.includes('key')) {
                helpfulMessage += '**Issue**: API configuration error\n\n';
                helpfulMessage += '**Solution**:\n';
                helpfulMessage += '1. Check your `.env` file\n';
                helpfulMessage += '2. Verify your API keys are correct\n';
                helpfulMessage += '3. Make sure VITE_ALGOLIA_APP_ID, VITE_ALGOLIA_SEARCH_API_KEY, and VITE_ALGOLIA_AGENT_ID are set\n\n';
                helpfulMessage += '[View Setup Guide →](https://github.com)';
            } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
                helpfulMessage += '**Issue**: Network connection error\n\n';
                helpfulMessage += '**Solution**:\n';
                helpfulMessage += '1. Check your internet connection\n';
                helpfulMessage += '2. Try again in a moment\n';
                helpfulMessage += '3. If the issue persists, check Algolia service status';
            } else {
                helpfulMessage += '**Issue**: Unexpected error occurred\n\n';
                helpfulMessage += '**Solution**:\n';
                helpfulMessage += '1. Try your query again\n';
                helpfulMessage += '2. Simplify your request\n';
                helpfulMessage += '3. Check the browser console for details\n\n';
                helpfulMessage += `**Error details**: ${errorMsg}`;
            }
            
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: helpfulMessage,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setIsAnalyzingImage(false);
        }
    };

    return (
        <div className="flex flex-col h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-gradient-bg"></div>
                <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl animate-gradient-bg" style={{ animationDelay: '4s' }}></div>
            </div>

            {/* Header */}
            <header className="relative z-10 glass border-b border-white/20 shadow-lg shadow-black/5">
                <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl blur-lg sm:blur-xl group-hover:blur-2xl transition-all opacity-70"></div>
                            <div className="relative w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl transform group-hover:scale-105 transition-transform">
                                <CompassIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                                ComponentCompass
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:block md:block">AI Design System Navigator</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        {messages.length > 0 && (
                            <button
                                onClick={clearConversation}
                                className="px-3 py-1.5 glass rounded-full text-xs font-medium text-slate-700 border border-white/40 hover:bg-white/60 transition-colors"
                                title="New conversation"
                            >
                                <span className="hidden sm:inline">New Chat</span>
                                <span className="sm:hidden">+</span>
                            </button>
                        )}
                        <span className="hidden sm:flex px-3 sm:px-4 py-1.5 sm:py-2 glass rounded-full text-xs font-semibold text-slate-700 border border-white/40 shadow-sm items-center gap-2">
                            <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                            <span className="hidden lg:inline">Powered by Algolia</span>
                        </span>
                        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 glass-dark rounded-full text-[10px] sm:text-xs text-white/90 border border-white/20">
                            <div className="flex -space-x-1">
                                <div className="w-5 h-5 rounded-full bg-violet-500 border-2 border-white flex items-center justify-center text-[8px] font-bold">7</div>
                            </div>
                            <span className="font-medium">Multi-Index AI</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Messages Container */}
            <main ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-8 relative z-10">
                <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)] sm:min-h-[calc(100vh-300px)] animate-in fade-in duration-1000 px-4">
                            <div className="relative mb-4 sm:mb-6">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl sm:rounded-[1.5rem] blur-2xl sm:blur-3xl opacity-30 animate-pulse"></div>
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center shadow-2xl">
                                    <CompassIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                </div>
                            </div>
                            
                            <h2 className="text-2xl sm:text-4xl md:text-4xl font-bold mb-2 sm:mb-3 tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent text-center">
                                Welcome to ComponentCompass
                            </h2>
                            <p className="text-sm sm:text-base text-slate-600 max-w-2xl text-center mb-6 sm:mb-8 leading-relaxed">
                                Your intelligent AI assistant for discovering components, understanding implementations,
                                and building accessible interfaces with confidence.
                            </p>

                            <div className="w-full max-w-4xl">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 sm:mb-6 text-center">
                                    Try asking
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    {suggestedPrompts.map((prompt, index) => (
                                        <div key={prompt.title} className="relative">
                                            <button
                                                onClick={() => setInput(prompt.title)}
                                                className="w-full group relative overflow-hidden glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/40 shadow-lg hover:shadow-2xl transition-all duration-300 text-left transform hover:-translate-y-1"
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                            <div className={cn(
                                                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300",
                                                prompt.gradient
                                            )}></div>
                                            <div className="relative flex items-start gap-3 sm:gap-4">
                                                <div className={cn(
                                                    "flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-all duration-300",
                                                    prompt.iconGradient
                                                )}>
                                                    <prompt.Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm sm:text-base text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
                                                        {prompt.title}
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-slate-600">
                                                        {prompt.description}
                                                    </div>
                                                </div>
                                            </div>
                                            </button>
                                            <button
                                                onClick={() => tryExample(prompt.title)}
                                                className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] sm:text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                title="Try this example"
                                            >
                                                Try →
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, index) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-500",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[95%] sm:max-w-[85%] rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 shadow-lg backdrop-blur-sm border",
                                            msg.role === 'user'
                                                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-white/20"
                                                : "glass border-white/40 text-slate-900"
                                        )}
                                    >
                                        {msg.imageUrl && (
                                            <div className="mb-4 -mx-2">
                                                <img
                                                    src={msg.imageUrl}
                                                    alt="Uploaded"
                                                    className="max-w-full rounded-2xl shadow-xl border-2 border-white/30"
                                                />
                                            </div>
                                        )}
                                        <div className={cn(
                                            "prose prose-sm max-w-none",
                                            msg.role === 'user' ? "prose-invert" : "prose-slate"
                                        )}>
                                            <ReactMarkdown
                                                components={{
                                                    code({ className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        const codeString = String(children).replace(/\n$/, '');
                                                        const isInline = !match;

                                                        if (!isInline && match) {
                                                            return <CodeBlock code={codeString} language={match[1]} />;
                                                        }

                                                        return (
                                                            <code className={cn("px-2 py-1 rounded-lg text-sm font-mono", 
                                                                msg.role === 'user' ? "bg-white/20" : "bg-slate-800/10"
                                                            )} {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                        
                                        {/* Sources Section - Only for assistant messages */}
                                        {msg.role === 'assistant' && (
                                            <>
                                                <div className="mt-5 pt-5 border-t border-white/30">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <SparklesIcon className="w-4 h-4 text-blue-600" />
                                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                            Sources from Multi-Index Search
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {mockSources.map((source) => (
                                                            <span
                                                                key={source.name}
                                                                className={cn(
                                                                    "text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 shadow-sm",
                                                                    source.color === 'violet' && "bg-violet-100 text-violet-700",
                                                                    source.color === 'blue' && "bg-blue-100 text-blue-700",
                                                                    source.color === 'emerald' && "bg-emerald-100 text-emerald-700",
                                                                    source.color === 'orange' && "bg-orange-100 text-orange-700"
                                                                )}
                                                            >
                                                                📚 {source.name}
                                                                <span className="opacity-75">({source.count})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2 italic">
                                                        💡 Used in 47 places across the codebase
                                                    </p>
                                                </div>

                                                {/* Follow-up Suggestions */}
                                                <div className="mt-5 pt-5 border-t border-white/30">
                                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                                                        You might also want to know:
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {getFollowUpSuggestions(msg.content).map((suggestion, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setInput(suggestion)}
                                                                className="text-xs px-3 py-2 glass rounded-full hover:bg-white/60 transition-colors border border-white/40 text-slate-700 font-medium"
                                                            >
                                                                {suggestion} →
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2">
                                    <div className="max-w-[95%] sm:max-w-[85%] space-y-3">
                                        {/* Loading message */}
                                        <div className="glass rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 border border-white/40 shadow-lg">
                                            <div className="flex items-center gap-3 mb-3">
                                                <LoadingIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 animate-spin flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {isAnalyzingImage ? '🔍 Analyzing screenshot with AI...' : loadingMessages[loadingMessageIndex].main}
                                                    </p>
                                                    <p className="text-xs text-slate-600">
                                                        {isAnalyzingImage ? 'GPT-4 Vision identifying UI components' : loadingMessages[loadingMessageIndex].sub}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                                                <span className="text-xs text-slate-500">
                                                    {isAnalyzingImage ? 'Processing image with multimodal AI' : 'Searching across 7 specialized indices'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Skeleton preview */}
                                        <div className="glass rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 border border-white/40 shadow-lg animate-pulse">
                                            <div className="space-y-3">
                                                <div className="h-4 bg-slate-300/50 rounded w-3/4"></div>
                                                <div className="h-4 bg-slate-300/50 rounded w-full"></div>
                                                <div className="h-4 bg-slate-300/50 rounded w-5/6"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Scroll to Bottom Button */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 p-3 sm:p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 z-20"
                        title="Scroll to bottom"
                    >
                        <NavigationIcon className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
                    </button>
                )}
            </main>

            {/* Input Area */}
            <footer className="relative z-10 glass border-t border-white/20 shadow-2xl">
                <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
                    {attachedFile && (
                        <div className="mb-3 sm:mb-4 glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 flex items-center justify-between animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                                    <ImageUploadIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">{attachedFile.name}</span>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            >
                                <CloseIcon className="w-5 h-5 text-red-600" />
                            </button>
                        </div>
                    )}

                    <div className="relative flex items-end gap-2 sm:gap-3 glass rounded-2xl sm:rounded-3xl p-2 sm:p-3 border border-white/40 focus-within:border-blue-500/50 focus-within:ring-2 sm:focus-within:ring-4 focus-within:ring-blue-500/20 transition-all shadow-lg">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            aria-label="Upload image file"
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 p-2 sm:p-3 hover:bg-white/60 rounded-xl sm:rounded-2xl transition-all group"
                            title="Upload image"
                            aria-label="Upload image"
                        >
                            <ImageUploadIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 group-hover:text-blue-600 transition-colors" />
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask about components..."
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 sm:max-h-40 py-2 sm:py-3 text-sm sm:text-base text-slate-900 placeholder-slate-500 font-medium"
                            rows={1}
                            aria-label="Message input"
                        />

                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !attachedFile) || isLoading}
                            className={cn(
                                "flex-shrink-0 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-lg",
                                (input.trim() || attachedFile) && !isLoading
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/50 hover:shadow-blue-500/70 hover:scale-105 active:scale-95"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                            aria-label="Send message"
                        >
                            <SendIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>

                    <p className="mt-2 sm:mt-3 text-center text-[10px] sm:text-xs text-slate-600">
                        <kbd className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/60 rounded text-slate-700 font-mono text-[9px] sm:text-xs">Enter</kbd> to send •{' '}
                        <kbd className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/60 rounded text-slate-700 font-mono text-[9px] sm:text-xs">Shift + Enter</kbd> for new line
                        {messages.length > 0 && (
                            <>
                                {' '}•{' '}
                                <kbd className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/60 rounded text-slate-700 font-mono text-[9px] sm:text-xs">⌘K</kbd> to clear
                            </>
                        )}
                    </p>
                </div>
            </footer>
        </div>
    );
}
