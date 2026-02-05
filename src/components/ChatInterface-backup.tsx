
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { SendIcon as Send, ImageIcon as Image, PaperclipIcon as Paperclip, LoadingIcon as Loader2 } from './Icons';
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

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

        // Handle file attachment
        if (attachedFile) {
            fileName = attachedFile.name;
            // Create preview URL for images
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
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error connecting to the design system. Please check your configuration.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 text-gray-900 font-sans">
            {/* Enhanced Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-6 py-4 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                            <span className="text-2xl">🧭</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                ComponentCompass
                            </h1>
                            <p className="text-xs text-gray-500">AI-Powered Design System Navigator</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium border border-blue-100">
                            ✨ Powered by Algolia
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 flex items-center justify-center shadow-xl">
                            <span className="text-4xl">🧭</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                            Welcome to ComponentCompass
                        </h2>
                        <p className="max-w-lg text-gray-600 mb-8 text-lg">
                            Your AI assistant for discovering, understanding, and implementing design system components
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                            {[
                                { icon: '🎨', text: 'Show me accessible buttons', color: 'blue' },
                                { icon: '📝', text: 'Input field with error state', color: 'purple' },
                                { icon: '📷', text: 'Analyze this screenshot', color: 'green' },
                                { icon: '💡', text: 'How do I use the Card component?', color: 'orange' }
                            ].map((q) => (
                                <button 
                                    key={q.text} 
                                    onClick={() => setInput(q.text)} 
                                    className="group p-4 bg-white border border-gray-200 rounded-xl text-sm hover:border-blue-400 hover:shadow-md transition-all text-left flex items-center gap-3"
                                >
                                    <span className="text-2xl">{q.icon}</span>
                                    <span className="text-gray-700 group-hover:text-gray-900 font-medium">{q.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex w-full mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[85%] rounded-2xl px-6 py-4 shadow-md",
                                msg.role === 'user'
                                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm"
                                    : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm"
                            )}
                        >
                            {msg.imageUrl && (
                                <div className="mb-3">
                                    <img 
                                        src={msg.imageUrl} 
                                        alt="Uploaded screenshot" 
                                        className="max-w-full rounded-xl border-2 border-white/20 shadow-lg"
                                    />
                                </div>
                            )}
                            <div className={cn(
                                "prose prose-sm max-w-none",
                                msg.role === 'user' ? "prose-invert" : ""
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
                                                <code className={cn("bg-black/10 rounded px-1 py-0.5", className)} {...props}>
                                                    {children}
                                                </code>
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
                {isLoading && (
                    <div className="flex w-full justify-start mb-4">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            <span className="text">
                    {attachedFile && (
                        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {attachedFile.type.startsWith('image/') ? (
                                    <>
                                        <Image className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm text-blue-900">{attachedFile.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Paperclip className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm text-blue-900">{attachedFile.name}</span>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                Remove
                            </button>
                        </div>
                    )}
                    <div className="relative flex items-end gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            classN(!input.trim() && !attachedFile) || isLoading}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            (input.trim() || attachedFile) && !isLoading
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <div className="mt-2 text-center text-xs text-gray-400">
                    Powered by Algolia Agent Studio • Flo Labs Design System
                </div>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Attach File">
                        <Paperclip className="w-5 h-5" />
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
                        placeholder="Ask anything about the design system..."
                        className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 py-3 text-sm"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />

                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            input.trim() && !isLoading
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <div className="mt-2 text-center text-xs text-gray-400">
                    Powered by Algolia Agent Studio • Flo Labs Design System
                </div>
            </div>
        </div>
    );
}
