
// Algolia Agent Studio Client

interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface AgentCompletionRequest {
    messages: AgentMessage[];
    sessionId?: string;
    context?: Record<string, any>;
}

interface AgentCompletionResponse {
    content: Array<{
        type: string;
        value: string;
    }>;
    sessionId?: string;
    sources?: Array<{
        title: string;
        url: string;
        snippet?: string;
    }>;
}

export class AgentStudioClient {
    private appId: string;
    private apiKey: string;
    private agentId: string;
    private endpoint: string;
    private sessionId?: string;

    constructor(appId: string, apiKey: string, agentId: string) {
        this.appId = appId;
        this.apiKey = apiKey;
        this.agentId = agentId;
        this.endpoint = `https://${appId}-dsn.algolia.net/1/agents`;
    }

    async sendMessage(
        message: string,
        context?: Record<string, any>
    ): Promise<string> {
        try {
            const requestBody: AgentCompletionRequest = {
                messages: [
                    {
                        role: 'user',
                        content: message,
                    },
                ],
                context: context || {},
            };

            // Include session ID if we have one
            if (this.sessionId) {
                requestBody.sessionId = this.sessionId;
            }

            const response = await fetch(
                `${this.endpoint}/${this.agentId}/completions`,
                {
                    method: 'POST',
                    headers: {
                        'X-Algolia-Application-Id': this.appId,
                        'X-Algolia-API-Key': this.apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Agent Studio error (${response.status}): ${errorText}`);
            }

            const data: AgentCompletionResponse = await response.json();

            // Store session ID for context continuity
            if (data.sessionId) {
                this.sessionId = data.sessionId;
            }

            // Extract text content from response
            if (data.content && Array.isArray(data.content)) {
                return data.content
                    .filter((item) => item.type === 'text')
                    .map((item) => item.value)
                    .join('\n\n');
            }

            return 'Sorry, I received an unexpected response format.';
        } catch (error) {
            console.error('Agent Studio API error:', error);
            throw error;
        }
    }

    resetSession() {
        this.sessionId = undefined;
    }
}

// Initialize the agent client with environment variables
const appId = import.meta.env.VITE_ALGOLIA_APP_ID || '';
const apiKey = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || '';
const agentId = import.meta.env.VITE_ALGOLIA_AGENT_ID || '';

if (!appId || !apiKey || !agentId) {
    console.warn('Algolia credentials not configured. Please set environment variables.');
}

export const agentClient = new AgentStudioClient(appId, apiKey, agentId);
