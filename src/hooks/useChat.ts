import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { encryptMessage, decryptMessage } from '../lib/encryption';

export interface ChatChannel {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  channel_type: 'general' | 'team' | 'direct' | 'alert' | 'command';
  is_private: boolean;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  topic: string | null;
  icon: string | null;
  pinned_message_ids: string[];
  unread_count?: number;
  last_message?: ChatMessage | null;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'alert' | 'system' | 'location';
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  metadata: any;
  is_pinned: boolean;
  is_deleted: boolean;
  is_encrypted: boolean;
  edited_at: string | null;
  created_at: string;
  reply_to_id: string | null;
  reply_to_preview: string | null;
  reply_to_sender: string | null;
  reactions: Record<string, string[]>;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
}

export interface TypingUser {
  user_id: string;
  user_name: string;
}

export interface PresenceUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  custom_status: string | null;
  last_seen_at: string;
}

export const CHANNEL_TYPES = [
  { value: 'general', label: 'General', icon: '💬', color: 'blue' },
  { value: 'team', label: 'Team', icon: '👥', color: 'green' },
  { value: 'direct', label: 'Direct Message', icon: '✉️', color: 'purple' },
  { value: 'alert', label: 'Alert Channel', icon: '🚨', color: 'red' },
  { value: 'command', label: 'Command', icon: '📡', color: 'amber' },
] as const;

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '👀', '✅', '🚨', '🙏'];

export function useChat() {
  const { user, tenant, member } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const subscriptionRef = useRef<any>(null);
  const typingSubRef = useRef<any>(null);
  const encKeyRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Encryption ───
  useEffect(() => {
    async function loadKey() {
      if (!tenant) return;
      const { data } = await supabase
        .from('tenant_encryption_keys')
        .select('encryption_key')
        .eq('tenant_id', tenant.id)
        .eq('key_name', 'chat')
        .eq('is_active', true)
        .maybeSingle();
      if (data?.encryption_key) {
        encKeyRef.current = data.encryption_key;
        setEncryptionReady(true);
      }
    }
    loadKey();
  }, [tenant]);

  const decryptMsg = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    if (!msg.is_encrypted || !encKeyRef.current) return msg;
    const plaintext = await decryptMessage(msg.content, encKeyRef.current);
    return { ...msg, content: plaintext };
  }, []);

  const decryptAll = useCallback(async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    return Promise.all(msgs.map(m => decryptMsg(m)));
  }, [decryptMsg]);

  // ─── Channels ───
  const fetchChannels = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_archived', false)
      .order('name');
    if (data) setChannels(data);
  }, [tenant]);

  const createChannel = useCallback(async (name: string, description: string, channelType: string, isPrivate: boolean, icon?: string) => {
    if (!tenant || !user) return;
    const { data, error } = await supabase
      .from('chat_channels')
      .insert({ tenant_id: tenant.id, name, description, channel_type: channelType, is_private: isPrivate, created_by: user.id, icon: icon || null })
      .select().single();
    if (data) {
      await supabase.from('chat_channel_members').insert({ channel_id: data.id, user_id: user.id, role: 'admin' });
      await fetchChannels();
    }
    return { data, error };
  }, [tenant, user, fetchChannels]);

  const deleteChannel = useCallback(async (channelId: string) => {
    await supabase.from('chat_channels').update({ is_archived: true }).eq('id', channelId);
    await fetchChannels();
    if (activeChannel?.id === channelId) setActiveChannel(null);
  }, [fetchChannels, activeChannel]);

  const updateChannelTopic = useCallback(async (channelId: string, topic: string) => {
    await supabase.from('chat_channels').update({ topic }).eq('id', channelId);
    await fetchChannels();
  }, [fetchChannels]);

  // ─── Messages ───
  const fetchMessages = useCallback(async (channelId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      const decrypted = await decryptAll(data);
      // Load reactions for these messages
      const msgIds = data.map(m => m.id);
      if (msgIds.length > 0) {
        const { data: rxns } = await supabase.from('chat_reactions').select('*').in('message_id', msgIds);
        if (rxns) {
          const rxnMap: Record<string, Record<string, string[]>> = {};
          rxns.forEach((r: ChatReaction) => {
            if (!rxnMap[r.message_id]) rxnMap[r.message_id] = {};
            if (!rxnMap[r.message_id][r.emoji]) rxnMap[r.message_id][r.emoji] = [];
            rxnMap[r.message_id][r.emoji].push(r.user_name);
          });
          decrypted.forEach(m => { m.reactions = rxnMap[m.id] || {}; });
        }
      }
      setMessages(decrypted);
    }
    setLoading(false);
  }, [decryptAll]);

  const sendMessage = useCallback(async (
    channelId: string, content: string, messageType: string = 'text',
    fileUrl?: string, fileName?: string, fileType?: string,
    replyTo?: ChatMessage | null
  ) => {
    if (!user || !member) return;
    let finalContent = content;
    let encrypted = false;
    if (encKeyRef.current && messageType === 'text') {
      finalContent = await encryptMessage(content, encKeyRef.current);
      encrypted = true;
    }
    const { error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: user.id,
      sender_name: member.display_name,
      content: finalContent,
      message_type: messageType,
      is_encrypted: encrypted,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      reply_to_id: replyTo?.id || null,
      reply_to_preview: replyTo ? replyTo.content.slice(0, 100) : null,
      reply_to_sender: replyTo?.sender_name || null,
    });
    // Clear typing indicator
    if (user) {
      await supabase.from('chat_typing').delete().eq('channel_id', channelId).eq('user_id', user.id);
    }
    return { error };
  }, [user, member]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    let finalContent = newContent;
    if (encKeyRef.current) finalContent = await encryptMessage(newContent, encKeyRef.current);
    await supabase.from('chat_messages').update({ content: finalContent, edited_at: new Date().toISOString() }).eq('id', messageId);
    if (activeChannel) await fetchMessages(activeChannel.id);
  }, [activeChannel, fetchMessages]);

  const deleteMessage = useCallback(async (messageId: string) => {
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const pinMessage = useCallback(async (messageId: string) => {
    await supabase.from('chat_messages').update({ is_pinned: true }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: true } : m));
  }, []);

  const unpinMessage = useCallback(async (messageId: string) => {
    await supabase.from('chat_messages').update({ is_pinned: false }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: false } : m));
  }, []);

  // ─── Reactions ───
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !member) return;
    await supabase.from('chat_reactions').upsert({
      message_id: messageId, user_id: user.id, user_name: member.display_name, emoji,
    }, { onConflict: 'message_id,user_id,emoji' });
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const rxn = { ...m.reactions };
      if (!rxn[emoji]) rxn[emoji] = [];
      if (!rxn[emoji].includes(member.display_name)) rxn[emoji].push(member.display_name);
      return { ...m, reactions: rxn };
    }));
  }, [user, member]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !member) return;
    await supabase.from('chat_reactions').delete()
      .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const rxn = { ...m.reactions };
      if (rxn[emoji]) {
        rxn[emoji] = rxn[emoji].filter(n => n !== member.display_name);
        if (rxn[emoji].length === 0) delete rxn[emoji];
      }
      return { ...m, reactions: rxn };
    }));
  }, [user, member]);

  // ─── Typing Indicators ───
  const sendTyping = useCallback(async (channelId: string) => {
    if (!user || !member) return;
    await supabase.from('chat_typing').upsert(
      { channel_id: channelId, user_id: user.id, user_name: member.display_name, started_at: new Date().toISOString() },
      { onConflict: 'channel_id,user_id' }
    );
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await supabase.from('chat_typing').delete().eq('channel_id', channelId).eq('user_id', user.id);
    }, 4000);
  }, [user, member]);

  // ─── Presence ───
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user || !member) return;
    await supabase.from('chat_presence').upsert({
      user_id: user.id, display_name: member.display_name, avatar_url: member.avatar_url,
      status, last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [user, member]);

  const fetchPresence = useCallback(async () => {
    if (!tenant) return;
    // Get all tenant member user IDs then fetch their presence
    const { data: members } = await supabase.from('tenant_members').select('user_id').eq('tenant_id', tenant.id).eq('is_active', true);
    if (!members) return;
    const uids = members.map(m => m.user_id);
    const { data } = await supabase.from('chat_presence').select('*').in('user_id', uids);
    if (data) setOnlineUsers(data);
  }, [tenant]);

  // ─── File Upload ───
  const uploadFile = useCallback(async (channelId: string, file: File) => {
    if (!tenant || !user) return;
    const path = `${tenant.id}/${channelId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('chat-files').upload(path, file);
    if (uploadErr) return { error: uploadErr };
    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path);
    const isImage = file.type.startsWith('image/');
    await sendMessage(channelId, file.name, isImage ? 'image' : 'file', publicUrl, file.name, file.type);
    return { error: null };
  }, [tenant, user, sendMessage]);

  // ─── Search ───
  const searchMessages = useCallback(async (query: string) => {
    if (!activeChannel || !query.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from('chat_messages').select('*')
      .eq('channel_id', activeChannel.id).eq('is_deleted', false)
      .ilike('content', `%${query}%`).order('created_at', { ascending: false }).limit(50);
    if (data) {
      const decrypted = await decryptAll(data);
      setSearchResults(decrypted);
    }
  }, [activeChannel, decryptAll]);

  // ─── Realtime Subscriptions ───
  useEffect(() => {
    if (!activeChannel) return;
    fetchMessages(activeChannel.id);

    // Mark as read
    if (user) {
      supabase.from('chat_read_receipts').upsert(
        { channel_id: activeChannel.id, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'channel_id,user_id' }
      );
    }

    const channelSub = supabase
      .channel(`chat-${activeChannel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}` },
        async (payload) => {
          const msg = payload.new as ChatMessage;
          const decrypted = await decryptMsg(msg);
          decrypted.reactions = {};
          setMessages(prev => [...prev, decrypted]);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing', filter: `channel_id=eq.${activeChannel.id}` },
        async () => {
          const { data } = await supabase.from('chat_typing').select('user_id, user_name')
            .eq('channel_id', activeChannel.id).neq('user_id', user?.id || '');
          setTypingUsers(data || []);
        })
      .subscribe();

    subscriptionRef.current = channelSub;

    return () => {
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current);
      // Clear own typing when leaving channel
      if (user && activeChannel) {
        supabase.from('chat_typing').delete().eq('channel_id', activeChannel.id).eq('user_id', user.id);
      }
    };
  }, [activeChannel, fetchMessages, user]);

  // Set presence on mount, heartbeat
  useEffect(() => {
    if (!user || !member) return;
    updatePresence('online');
    fetchPresence();
    const interval = setInterval(() => {
      updatePresence('online');
      fetchPresence();
    }, 30000);
    const handleBeforeUnload = () => { updatePresence('offline'); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence('offline');
    };
  }, [user, member, updatePresence, fetchPresence]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const pinnedMessages = messages.filter(m => m.is_pinned);

  return {
    channels, messages, pinnedMessages, activeChannel, setActiveChannel,
    loading, encryptionReady, typingUsers, onlineUsers, searchResults,
    fetchChannels, fetchMessages, sendMessage, editMessage, deleteMessage,
    pinMessage, unpinMessage, addReaction, removeReaction,
    sendTyping, updatePresence, uploadFile, searchMessages,
    createChannel, deleteChannel, updateChannelTopic,
  };
}
