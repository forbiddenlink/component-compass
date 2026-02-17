/**
 * GPT-4 Vision integration for analyzing design screenshots
 * and extracting component descriptions
 */

interface VisionAnalysisResult {
  components: Array<{
    name: string;
    description: string;
    confidence: number;
  }>;
  layout: string;
  designStyle: string;
  suggestions: string[];
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

export async function analyzeDesignScreenshot(
  imageUrl: string
): Promise<VisionAnalysisResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert UI/UX designer analyzing design screenshots to identify React components. 
Analyze the image and identify all UI components present. For each component, provide:
1. Component name (e.g., Button, Card, Input, Dialog, etc.)
2. Detailed description including variants, states, and properties
3. Confidence level (0-1) that this component exists

Also describe the overall layout and design style.

Respond in JSON format:
{
  "components": [
    {
      "name": "Button",
      "description": "Primary button with rounded corners, gradient background, medium size",
      "confidence": 0.95
    }
  ],
  "layout": "Card layout with header, content, and footer sections",
  "designStyle": "Modern, minimalist with soft shadows and rounded corners",
  "suggestions": ["Consider using shadcn/ui Button component", "Add hover states for better interactivity"]
}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this design and identify all UI components. Be specific about variants, sizes, and states.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const result = JSON.parse(content) as VisionAnalysisResult;
    return result;
  } catch (error) {
    console.error('Vision analysis error:', error);
    throw error;
  }
}

export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
