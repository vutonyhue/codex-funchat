/**
 * Hook xử lý Angel AI inline (@angel trigger)
 * Detect @angel trong tin nhắn và gọi AI để trả lời inline trong cuộc hội thoại
 */
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';

interface AngelAIOptions {
  conversationId: string;
  onAIResponse?: (response: string) => void;
}

export function useAngelAI({ conversationId, onAIResponse }: AngelAIOptions) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Detect if message contains @angel trigger
  const detectAngelTrigger = useCallback((content: string): { hasTrigger: boolean; prompt: string } => {
    const angelPattern = /@angel\s+(.+)/i;
    const match = content.match(angelPattern);
    
    if (match) {
      return {
        hasTrigger: true,
        prompt: match[1].trim(),
      };
    }
    
    return { hasTrigger: false, prompt: '' };
  }, []);

  // Call Angel AI and get response
  const callAngelAI = useCallback(async (
    prompt: string,
    context?: Message[]
  ): Promise<{ response: string; error: Error | null }> => {
    setIsProcessing(true);
    
    try {
      // Build context from recent messages
      const contextMessages = context?.slice(-10).map(m => ({
        role: m.sender_id ? 'user' : 'assistant',
        content: m.content || '',
      })) || [];

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            ...contextMessages,
            { role: 'user', content: prompt }
          ],
          systemPrompt: `Bạn là Angel AI, một trợ lý thân thiện và hữu ích trong FUN Chat. 
Bạn được gọi thông qua @angel trong cuộc hội thoại.
Hãy trả lời ngắn gọn, tích cực và hữu ích theo phong cách 5D Light Language.
Luôn sử dụng emoji khi phù hợp để tạo không khí vui vẻ.
Nếu được yêu cầu dịch, hãy dịch chính xác.
Nếu được yêu cầu tóm tắt, hãy tóm tắt súc tích.`,
        },
      });

      if (error) throw error;

      const response = data?.response || data?.message || 'Xin lỗi, mình không thể trả lời lúc này. 🙏';
      onAIResponse?.(response);
      
      return { response, error: null };
    } catch (error) {
      console.error('[useAngelAI] Error:', error);
      return { 
        response: '', 
        error: error instanceof Error ? error : new Error('Failed to get AI response') 
      };
    } finally {
      setIsProcessing(false);
    }
  }, [onAIResponse]);

  // Process message with @angel trigger
  const processAngelMessage = useCallback(async (
    content: string,
    recentMessages?: Message[]
  ): Promise<{ response: string | null; error: Error | null }> => {
    const { hasTrigger, prompt } = detectAngelTrigger(content);
    
    if (!hasTrigger) {
      return { response: null, error: null };
    }

    const result = await callAngelAI(prompt, recentMessages);
    return { response: result.response || null, error: result.error };
  }, [detectAngelTrigger, callAngelAI]);

  return {
    isProcessing,
    detectAngelTrigger,
    callAngelAI,
    processAngelMessage,
  };
}
