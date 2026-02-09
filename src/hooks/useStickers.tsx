import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StickerPack, Sticker, UserStickerPack } from '@/types/stickers';

// localStorage cache keys and duration
const CACHE_KEY = 'sticker_packs_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  packs: StickerPack[];
  timestamp: number;
}

function getCachedPacks(): StickerPack[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data.packs;
  } catch {
    return null;
  }
}

function setCachedPacks(packs: StickerPack[]) {
  try {
    const data: CachedData = { packs, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded, silently fail
  }
}

export function useStickers() {
  const { user } = useAuth();
  const [packs, setPacks] = useState<StickerPack[]>(() => getCachedPacks() || []);
  const [userPacks, setUserPacks] = useState<UserStickerPack[]>([]);
  const [stickers, setStickers] = useState<Record<string, Sticker[]>>({});
  const [loading, setLoading] = useState(true);

  // Fetch all active sticker packs (with cache)
  const fetchPacks = useCallback(async () => {
    // Try cache first
    const cached = getCachedPacks();
    if (cached && cached.length > 0) {
      setPacks(cached);
      return;
    }

    const { data, error } = await supabase
      .from('sticker_packs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching sticker packs:', error);
      return;
    }

    const fetchedPacks = data || [];
    setPacks(fetchedPacks);
    setCachedPacks(fetchedPacks);
  }, []);

  // Fetch user's owned sticker packs
  const fetchUserPacks = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_sticker_packs')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user sticker packs:', error);
      return;
    }

    setUserPacks(data || []);
  }, [user]);

  // Fetch stickers for a specific pack
  const fetchStickersForPack = useCallback(async (packId: string) => {
    if (stickers[packId]) return; // Already loaded

    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('pack_id', packId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stickers:', error);
      return;
    }

    setStickers(prev => ({
      ...prev,
      [packId]: data || [],
    }));
  }, [stickers]);

  // Acquire a free sticker pack
  const acquirePack = useCallback(async (packId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const pack = packs.find(p => p.id === packId);
    if (!pack) return { error: new Error('Pack not found') };

    // Check if user already owns this pack
    if (userPacks.some(up => up.pack_id === packId)) {
      return { error: new Error('Already owned') };
    }

    // For premium packs, check payment (placeholder for now)
    if (pack.is_premium && pack.price > 0) {
      // TODO: Implement payment flow
      return { error: new Error('Premium pack - payment required') };
    }

    const { data, error } = await supabase
      .from('user_sticker_packs')
      .insert({
        user_id: user.id,
        pack_id: packId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error acquiring pack:', error);
      return { error };
    }

    setUserPacks(prev => [...prev, data]);
    return { data };
  }, [user, packs, userPacks]);

  // Remove a sticker pack from user's collection
  const removePack = useCallback(async (packId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('user_sticker_packs')
      .delete()
      .eq('user_id', user.id)
      .eq('pack_id', packId);

    if (error) {
      console.error('Error removing pack:', error);
      return { error };
    }

    setUserPacks(prev => prev.filter(up => up.pack_id !== packId));
    return { error: null };
  }, [user]);

  // Check if user owns a pack
  const ownsPack = useCallback((packId: string) => {
    return userPacks.some(up => up.pack_id === packId);
  }, [userPacks]);

  // Get owned packs
  const ownedPacks = packs.filter(p => ownsPack(p.id));

  // Get stickers for owned packs
  const getStickersForPack = useCallback((packId: string): Sticker[] => {
    return stickers[packId] || [];
  }, [stickers]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPacks(), fetchUserPacks()]);
      setLoading(false);
    };
    load();
  }, [fetchPacks, fetchUserPacks]);

  // Auto-acquire free packs for new users
  useEffect(() => {
    if (!user || loading || packs.length === 0) return;

    const autoAcquireFreePacks = async () => {
      const freePacks = packs.filter(p => !p.is_premium && p.price === 0);
      for (const pack of freePacks) {
        if (!ownsPack(pack.id)) {
          await acquirePack(pack.id);
        }
      }
    };

    autoAcquireFreePacks();
  }, [user, loading, packs, ownsPack, acquirePack]);

  return {
    packs,
    userPacks,
    ownedPacks,
    stickers,
    loading,
    fetchPacks,
    fetchUserPacks,
    fetchStickersForPack,
    acquirePack,
    removePack,
    ownsPack,
    getStickersForPack,
  };
}
