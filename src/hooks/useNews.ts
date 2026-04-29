import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface NewsPost {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string;
  priority: 'normal' | 'important' | 'urgent';
  is_pinned: boolean;
  is_published: boolean;
  publish_at: string;
  author_id: string | null;
  author_name: string | null;
  view_count: number;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export const NEWS_CATEGORIES = [
  { value: 'announcement', label: 'Announcement', color: 'bg-blue-100 text-blue-800' },
  { value: 'update', label: 'Update', color: 'bg-green-100 text-green-800' },
  { value: 'policy', label: 'Policy', color: 'bg-purple-100 text-purple-800' },
  { value: 'training', label: 'Training', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'safety', label: 'Safety', color: 'bg-red-100 text-red-800' },
  { value: 'event', label: 'Event', color: 'bg-amber-100 text-amber-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
] as const;

export function useNews() {
  const { tenant, user, member } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('news_posts')
      .select('*')
      .or(`tenant_id.eq.${tenant.id},is_global.eq.true`)
      .order('is_pinned', { ascending: false })
      .order('publish_at', { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  }, [tenant]);

  const createPost = useCallback(async (post: Partial<NewsPost>) => {
    if (!tenant || !user || !member) return;
    const { data, error } = await supabase
      .from('news_posts')
      .insert({
        ...post,
        tenant_id: tenant.id,
        author_id: user.id,
        author_name: member.display_name,
      })
      .select()
      .single();
    if (data) await fetchPosts();
    return { data, error };
  }, [tenant, user, member, fetchPosts]);

  const updatePost = useCallback(async (id: string, updates: Partial<NewsPost>) => {
    const { error } = await supabase
      .from('news_posts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchPosts();
    return { error };
  }, [fetchPosts]);

  const deletePost = useCallback(async (id: string) => {
    await supabase.from('news_posts').delete().eq('id', id);
    await fetchPosts();
  }, [fetchPosts]);

  const incrementViewCount = useCallback(async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (post) {
      await supabase.from('news_posts')
        .update({ view_count: (post.view_count || 0) + 1 })
        .eq('id', id);
    }
  }, [posts]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return {
    posts,
    loading,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    incrementViewCount,
  };
}
