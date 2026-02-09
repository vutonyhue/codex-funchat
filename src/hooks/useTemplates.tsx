import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  shortcut: string | null;
  category: string;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateParams {
  name: string;
  content: string;
  shortcut?: string;
  category?: string;
}

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('use_count', { ascending: false });

      if (error) throw error;
      setTemplates((data as MessageTemplate[]) || []);
    } catch (err) {
      console.error('[useTemplates] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (params: CreateTemplateParams) => {
      if (!user) return { error: new Error('Not logged in') };

      try {
        const { data, error } = await supabase
          .from('message_templates')
          .insert({
            user_id: user.id,
            name: params.name,
            content: params.content,
            shortcut: params.shortcut || null,
            category: params.category || 'general',
          })
          .select()
          .single();

        if (error) throw error;
        
        setTemplates((prev) => [data as MessageTemplate, ...prev]);
        toast({ title: 'Đã tạo mẫu tin nhắn' });
        return { data: data as MessageTemplate, error: null };
      } catch (err) {
        console.error('[useTemplates] create error:', err);
        toast({ title: 'Lỗi tạo mẫu', variant: 'destructive' });
        return { data: null, error: err as Error };
      }
    },
    [user]
  );

  const updateTemplate = useCallback(
    async (id: string, updates: Partial<CreateTemplateParams>) => {
      if (!user) return { error: new Error('Not logged in') };

      try {
        const { data, error } = await supabase
          .from('message_templates')
          .update(updates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? (data as MessageTemplate) : t))
        );
        toast({ title: 'Đã cập nhật mẫu' });
        return { data: data as MessageTemplate, error: null };
      } catch (err) {
        console.error('[useTemplates] update error:', err);
        toast({ title: 'Lỗi cập nhật', variant: 'destructive' });
        return { data: null, error: err as Error };
      }
    },
    [user]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!user) return { error: new Error('Not logged in') };

      try {
        const { error } = await supabase
          .from('message_templates')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast({ title: 'Đã xóa mẫu tin nhắn' });
        return { error: null };
      } catch (err) {
        console.error('[useTemplates] delete error:', err);
        toast({ title: 'Lỗi xóa mẫu', variant: 'destructive' });
        return { error: err as Error };
      }
    },
    [user]
  );

  const incrementUseCount = useCallback(
    async (id: string) => {
      if (!user) return;

      try {
        const template = templates.find((t) => t.id === id);
        if (!template) return;

        await supabase
          .from('message_templates')
          .update({ use_count: template.use_count + 1 })
          .eq('id', id)
          .eq('user_id', user.id);

        setTemplates((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, use_count: t.use_count + 1 } : t
          )
        );
      } catch (err) {
        console.error('[useTemplates] increment error:', err);
      }
    },
    [user, templates]
  );

  const searchTemplates = useCallback(
    (query: string): MessageTemplate[] => {
      if (!query) return templates;
      
      const lowerQuery = query.toLowerCase();
      return templates.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.content.toLowerCase().includes(lowerQuery) ||
          (t.shortcut && t.shortcut.toLowerCase().includes(lowerQuery))
      );
    },
    [templates]
  );

  const findByShortcut = useCallback(
    (shortcut: string): MessageTemplate | undefined => {
      return templates.find(
        (t) => t.shortcut?.toLowerCase() === shortcut.toLowerCase()
      );
    },
    [templates]
  );

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    incrementUseCount,
    searchTemplates,
    findByShortcut,
  };
}
