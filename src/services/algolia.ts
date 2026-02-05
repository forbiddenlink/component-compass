
// Algolia Agent Studio Client
// Supports both streaming (via AI SDK) and non-streaming (SSE fallback) modes

import { getEnv } from '../lib/env';

// --- Environment ---

const env = getEnv();
const appId = env.VITE_ALGOLIA_APP_ID;
const apiKey = env.VITE_ALGOLIA_SEARCH_API_KEY;
const agentId = env.VITE_ALGOLIA_AGENT_ID;

// --- Streaming transport config (for useChat from @ai-sdk/react) ---

export const ALGOLIA_STREAM_URL = `https://${appId}.algolia.net/agent-studio/1/agents/${agentId}/completions?stream=true&compatibilityMode=ai-sdk-5`;

export const ALGOLIA_HEADERS = {
    'X-Algolia-Application-Id': appId,
    'X-Algolia-API-Key': apiKey,
};

// --- Non-streaming client (fallback) ---

export class AgentStudioClient {
    private appId: string;
    private apiKey: string;
    private endpoint: string;
    private sessionId?: string;

    constructor(appId: string, apiKey: string, agentId: string) {
        this.appId = appId;
        this.apiKey = apiKey;
        this.endpoint = `https://${appId}.algolia.net/agent-studio/1/agents/${agentId}/completions?compatibilityMode=ai-sdk-5`;
    }

    async sendMessage(message: string): Promise<string> {
        try {
            const requestBody: Record<string, unknown> = {
                messages: [
                    {
                        role: 'user',
                        parts: [{ type: 'text', text: message }],
                    },
                ],
            };

            if (this.sessionId) {
                requestBody.sessionId = this.sessionId;
            }

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'X-Algolia-Application-Id': this.appId,
                    'X-Algolia-API-Key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Agent Studio error (${response.status}): ${errorText}`);
            }

            // The endpoint with compatibilityMode=ai-sdk-5 returns SSE format,
            // not JSON. Each line is prefixed with "data: " followed by a JSON
            // payload (or "[DONE]" to signal the end of the stream).
            const rawText = await response.text();
            const lines = rawText.split('\n');

            let textContent = '';

            for (const line of lines) {
                const trimmed = line.trim();

                // Skip empty lines and the terminal [DONE] marker
                if (!trimmed || !trimmed.startsWith('data: ')) {
                    continue;
                }

                const payload = trimmed.slice('data: '.length);

                // The final SSE message is "data: [DONE]"
                if (payload === '[DONE]') {
                    break;
                }

                let event: { type: string; messageId?: string; delta?: string; errorText?: string };
                try {
                    event = JSON.parse(payload);
                } catch {
                    // Skip malformed lines
                    continue;
                }

                // Store session context from the start event
                if (event.type === 'start' && event.messageId) {
                    // messageId format is "alg_msg_xxx" -- not a session ID,
                    // but we preserve sessionId logic if the API ever adds it.
                }

                // Handle error events — return partial text if we have some
                if (event.type === 'error') {
                    if (textContent) {
                        // Got partial response before error (e.g. max_output_tokens)
                        // Return what we have rather than failing completely
                        console.warn('Agent Studio: partial response due to:', event.errorText);
                        return textContent;
                    }
                    throw new Error(
                        `Agent Studio error: ${event.errorText || 'Unknown error from agent'}`
                    );
                }

                // Accumulate text from text-delta events
                if (event.type === 'text-delta' && event.delta) {
                    textContent += event.delta;
                }
            }

            if (!textContent) {
                return 'Sorry, I received an empty response from the agent.';
            }

            return textContent;
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
export const agentClient = new AgentStudioClient(appId, apiKey, agentId);
