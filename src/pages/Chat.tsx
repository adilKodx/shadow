import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react';
import {
  Hash, Lock, Plus, Send, Search, Users, X,
  MessageSquare, AlertTriangle, Radio, ShieldCheck,
  Smile, Paperclip, Pin, Reply, Trash2, Edit3,
  Image, FileText, Download, MoreHorizontal, ArrowDown,
  Circle, CheckCheck, SearchIcon,
} from 'lucide-react';
import { useChat, CHANNEL_TYPES, QUICK_REACTIONS, type ChatMessage } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

// ─── Helpers ───
function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

function dateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d, yyyy');
}

function needsDateSep(curr: string, prev: string | null) {
  if (!prev) return true;
  return !isSameDay(new Date(curr), new Date(prev));
}

// Avatar color from name
function avatarGradient(name: string) {
  const colors = [
    ['#6366F1','#8B5CF6'],['#EC4899','#F43F5E'],['#14B8A6','#06B6D4'],
    ['#F59E0B','#EF4444'],['#10B981','#3B82F6'],['#8B5CF6','#EC4899'],
    ['#3B82F6','#6366F1'],['#EF4444','#F59E0B'],
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

// Render message content with basic formatting
function renderContent(text: string) {
  // Bold: **text** → <strong>
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* → <em>
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Code: `text` → <code>
  html = html.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-black/10 rounded text-xs font-mono">$1</code>');
  // URLs
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline opacity-80 hover:opacity-100">$1</a>');
  return html;
}

export default function Chat() {
  const { user, member: authMember } = useAuth();
  const { primaryColor } = useBranding();
  const {
    channels, messages, pinnedMessages, activeChannel, setActiveChannel,
    loading, encryptionReady, typingUsers, onlineUsers, searchResults,
    sendMessage, editMessage, deleteMessage, pinMessage, unpinMessage,
    addReaction, removeReaction, sendTyping, uploadFile, searchMessages,
    createChannel, deleteChannel,
  } = useChat();

  const [messageInput, setMessageInput] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('general');
  const [channelSearch, setChannelSearch] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [showPresence, setShowPresence] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!showScrollDown) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showScrollDown]);

  // Detect scroll position
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 200);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  };

  // ─── Send / Edit ───
  const handleSend = async () => {
    if (!messageInput.trim() || !activeChannel) return;
    if (editingMsg) {
      await editMessage(editingMsg.id, messageInput.trim());
      setEditingMsg(null);
    } else {
      await sendMessage(activeChannel.id, messageInput.trim(), 'text', undefined, undefined, undefined, replyTo);
      setReplyTo(null);
    }
    setMessageInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setReplyTo(null);
      setEditingMsg(null);
      setMessageInput('');
    }
  };

  const handleTyping = () => {
    if (activeChannel) sendTyping(activeChannel.id);
  };

  // ─── File Upload ───
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !activeChannel) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(activeChannel.id, files[i]);
    }
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // ─── Channel Create ───
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    await createChannel(newChannelName.trim(), '', newChannelType, false);
    setNewChannelName('');
    setShowCreateChannel(false);
  };

  // ─── Reactions ───
  const toggleReaction = (msgId: string, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const myName = authMember?.display_name || '';
    if (msg.reactions?.[emoji]?.includes(myName)) {
      removeReaction(msgId, emoji);
    } else {
      addReaction(msgId, emoji);
    }
    setShowReactions(null);
  };

  // ─── Search ───
  useEffect(() => {
    const t = setTimeout(() => { if (showSearch) searchMessages(msgSearchQuery); }, 300);
    return () => clearTimeout(t);
  }, [msgSearchQuery, showSearch, searchMessages]);

  // ─── Filtered channels ───
  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const onlineCount = onlineUsers.filter(u => u.status === 'online').length;

  const channelIcon = (type: string, priv: boolean) => {
    if (priv) return <Lock className="w-3.5 h-3.5" />;
    switch (type) {
      case 'alert': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'command': return <Radio className="w-3.5 h-3.5" />;
      case 'team': return <Users className="w-3.5 h-3.5" />;
      default: return <Hash className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 to-gray-100">
      {/* ═══════ SIDEBAR ═══════ */}
      <div className="w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-300">Channels</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowPresence(!showPresence)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors relative" title="Online team">
                <Users className="w-4 h-4 text-slate-400" />
                {onlineCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 text-[9px] font-bold rounded-full flex items-center justify-center">{onlineCount}</span>
                )}
              </button>
              <button onClick={() => setShowCreateChannel(true)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="New channel">
                <Plus className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={channelSearch} onChange={e => setChannelSearch(e.target.value)}
              placeholder="Find a channel..."
              className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all" />
          </div>
        </div>

        {/* Online Presence Panel */}
        {showPresence && (
          <div className="mx-3 mb-2 p-3 bg-white/5 rounded-xl border border-white/10 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Team Online</p>
            <div className="space-y-1.5">
              {onlineUsers.filter(u => u.status !== 'offline').map(u => (
                <div key={u.user_id} className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: avatarGradient(u.display_name) }}>
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${
                      u.status === 'online' ? 'bg-green-400' : u.status === 'away' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                  </div>
                  <span className="text-xs text-slate-300 truncate">{u.display_name}</span>
                  <span className="text-[9px] text-slate-500 capitalize ml-auto">{u.status}</span>
                </div>
              ))}
              {onlineUsers.filter(u => u.status !== 'offline').length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">No one else online</p>
              )}
            </div>
          </div>
        )}

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {filteredChannels.map(ch => {
            const isActive = activeChannel?.id === ch.id;
            const ct = CHANNEL_TYPES.find(t => t.value === ch.channel_type);
            return (
              <button key={ch.id} onClick={() => { setActiveChannel(ch); setShowPinned(false); setShowSearch(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/30 to-blue-500/20 text-white shadow-lg shadow-blue-500/10 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}>
                <span className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}>
                  {channelIcon(ch.channel_type, ch.is_private)}
                </span>
                <span className="truncate flex-1 text-left">{ch.name}</span>
                {ch.icon && <span className="text-sm">{ch.icon}</span>}
              </button>
            );
          })}
          {filteredChannels.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-8">No channels found</p>
          )}
        </div>

        {/* Create Channel Panel */}
        {showCreateChannel && (
          <div className="mx-3 mb-3 p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
            <input type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
              placeholder="Channel name" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm text-white placeholder-slate-500 outline-none border border-white/10 focus:border-blue-500/50" />
            <select value={newChannelType} onChange={e => setNewChannelType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 rounded-lg text-sm text-white outline-none border border-white/10">
              {CHANNEL_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.icon} {ct.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleCreateChannel}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold transition-colors">Create</button>
              <button onClick={() => setShowCreateChannel(false)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-xs transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Encryption badge */}
        <div className="px-4 py-3 border-t border-white/5">
          {encryptionReady ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">AES-256 Encrypted</p>
                <p className="text-[9px] text-emerald-500/70">End-to-end · Zero-knowledge</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Lock className="w-4 h-4 text-amber-400" />
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">TLS Protected</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ MAIN CHAT AREA ═══════ */}
      <div className="flex-1 flex flex-col bg-white relative"
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {/* Drag overlay */}
        {isDragging && activeChannel && (
          <div className="absolute inset-0 z-50 bg-blue-600/10 border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <Image className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <p className="text-lg font-semibold text-blue-700">Drop files to upload</p>
              <p className="text-sm text-blue-500">Images, documents, and more</p>
            </div>
          </div>
        )}

        {activeChannel ? (
          <>
            {/* ─── Channel Header ─── */}
            <div className="h-14 px-5 flex items-center gap-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{channelIcon(activeChannel.channel_type, activeChannel.is_private)}</span>
                <h3 className="font-bold text-gray-900">{activeChannel.name}</h3>
              </div>
              {activeChannel.topic && (
                <span className="text-xs text-gray-400 border-l border-gray-200 pl-3 ml-1 truncate max-w-xs">{activeChannel.topic}</span>
              )}

              <div className="ml-auto flex items-center gap-1">
                {pinnedMessages.length > 0 && (
                  <button onClick={() => { setShowPinned(!showPinned); setShowSearch(false); }}
                    className={`p-2 rounded-lg transition-colors relative ${showPinned ? 'bg-amber-50 text-amber-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    title="Pinned messages">
                    <Pin className="w-4 h-4" />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {pinnedMessages.length}
                    </span>
                  </button>
                )}
                <button onClick={() => { setShowSearch(!showSearch); setShowPinned(false); }}
                  className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
                  title="Search messages">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ─── Pinned Messages Panel ─── */}
            {showPinned && pinnedMessages.length > 0 && (
              <div className="border-b border-gray-100 bg-amber-50/50 px-5 py-3 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Pin className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase">Pinned Messages</span>
                </div>
                <div className="space-y-2">
                  {pinnedMessages.map(pm => (
                    <div key={pm.id} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200/50">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                        style={{ background: avatarGradient(pm.sender_name) }}>
                        {pm.sender_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-900">{pm.sender_name}</span>
                        <p className="text-xs text-gray-600 truncate">{pm.content}</p>
                      </div>
                      <button onClick={() => unpinMessage(pm.id)} className="text-gray-400 hover:text-red-500 p-0.5" title="Unpin">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Search Panel ─── */}
            {showSearch && (
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={msgSearchQuery} onChange={e => setMsgSearchQuery(e.target.value)}
                    placeholder="Search messages in this channel..." autoFocus
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" />
                  {msgSearchQuery && (
                    <button onClick={() => { setMsgSearchQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {searchResults.map(sr => (
                      <div key={sr.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-xs">
                        <span className="font-medium text-gray-700">{sr.sender_name}</span>
                        <span className="text-gray-500 truncate flex-1">{sr.content}</span>
                        <span className="text-gray-400 flex-shrink-0">{format(new Date(sr.created_at), 'MMM d')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Messages ─── */}
            <div ref={messagesContainerRef} onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDate = needsDateSep(msg.created_at, prevMsg?.created_at || null);
                const isNewSender = !prevMsg || prevMsg.sender_id !== msg.sender_id || showDate;
                const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
                const isHovered = hoveredMsg === msg.id;

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{dateSeparator(msg.created_at)}</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}

                    {/* Message row */}
                    <div className={`group relative flex items-start gap-3 px-3 py-1 -mx-3 rounded-lg transition-colors ${
                      isHovered ? 'bg-gray-50' : 'hover:bg-gray-50/50'
                    }`} onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => { setHoveredMsg(null); if (showReactions === msg.id) setShowReactions(null); }}>

                      {/* Avatar */}
                      {isNewSender ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 shadow-sm"
                          style={{ background: avatarGradient(msg.sender_name) }}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-9 flex-shrink-0 flex items-center justify-center">
                          <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {format(new Date(msg.created_at), 'h:mm')}
                          </span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {isNewSender && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900">{msg.sender_name}</span>
                            <span className="text-[10px] text-gray-400">{formatMsgTime(msg.created_at)}</span>
                            {msg.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                            {msg.edited_at && <span className="text-[9px] text-gray-400">(edited)</span>}
                          </div>
                        )}

                        {/* Reply preview */}
                        {msg.reply_to_id && msg.reply_to_preview && (
                          <div className="flex items-center gap-2 mb-1 pl-3 border-l-2 border-blue-400 text-xs text-gray-500">
                            <Reply className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="font-medium text-blue-600">{msg.reply_to_sender}</span>
                            <span className="truncate">{msg.reply_to_preview}</span>
                          </div>
                        )}

                        {/* Message body */}
                        {msg.message_type === 'image' && msg.file_url ? (
                          <div className="mt-1">
                            <img src={msg.file_url} alt={msg.file_name || 'Image'} className="max-w-sm max-h-72 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => window.open(msg.file_url!, '_blank')} />
                          </div>
                        ) : msg.message_type === 'file' && msg.file_url ? (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{msg.file_name}</p>
                              <p className="text-[10px] text-gray-400">Click to download</p>
                            </div>
                            <Download className="w-4 h-4 text-gray-400 ml-2" />
                          </a>
                        ) : (
                          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                        )}

                        {/* Reactions */}
                        {hasReactions && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(msg.reactions).map(([emoji, users]) => {
                              const iMine = users.includes(authMember?.display_name || '');
                              return (
                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                    iMine
                                      ? 'bg-blue-100 border border-blue-300 text-blue-700 shadow-sm'
                                      : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                                  }`} title={users.join(', ')}>
                                  <span>{emoji}</span>
                                  <span className="font-medium">{users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* ─── Hover Action Bar ─── */}
                      {isHovered && (
                        <div className="absolute -top-3 right-2 flex items-center bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                          <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                            className="p-1.5 hover:bg-gray-100 transition-colors" title="React">
                            <Smile className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                            className="p-1.5 hover:bg-gray-100 transition-colors" title="Reply">
                            <Reply className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => msg.is_pinned ? unpinMessage(msg.id) : pinMessage(msg.id)}
                            className="p-1.5 hover:bg-gray-100 transition-colors" title={msg.is_pinned ? 'Unpin' : 'Pin'}>
                            <Pin className={`w-4 h-4 ${msg.is_pinned ? 'text-amber-500' : 'text-gray-500'}`} />
                          </button>
                          {isMe && (
                            <>
                              <button onClick={() => { setEditingMsg(msg); setMessageInput(msg.content); inputRef.current?.focus(); }}
                                className="p-1.5 hover:bg-gray-100 transition-colors" title="Edit">
                                <Edit3 className="w-4 h-4 text-gray-500" />
                              </button>
                              <button onClick={() => deleteMessage(msg.id)}
                                className="p-1.5 hover:bg-red-50 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Quick Reaction Picker */}
                      {showReactions === msg.id && (
                        <div className="absolute -top-10 right-2 flex items-center gap-0.5 bg-white border border-gray-200 rounded-full shadow-xl px-2 py-1 z-20">
                          {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-base transition-transform hover:scale-125">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom FAB */}
            {showScrollDown && (
              <button onClick={scrollToBottom}
                className="absolute bottom-24 right-6 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all hover:shadow-xl z-10">
                <ArrowDown className="w-5 h-5 text-gray-600" />
              </button>
            )}

            {/* ─── Typing Indicator ─── */}
            {typingUsers.length > 0 && (
              <div className="px-5 py-1.5 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-gray-500">
                    <strong>{typingUsers.map(t => t.user_name).join(', ')}</strong>
                    {typingUsers.length === 1 ? ' is typing...' : ' are typing...'}
                  </span>
                </div>
              </div>
            )}

            {/* ─── Reply / Edit Preview ─── */}
            {(replyTo || editingMsg) && (
              <div className="px-5 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
                <div className={`w-1 h-10 rounded-full ${editingMsg ? 'bg-amber-400' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase text-gray-400">{editingMsg ? 'Editing message' : `Replying to ${replyTo?.sender_name}`}</p>
                  <p className="text-xs text-gray-600 truncate">{editingMsg?.content || replyTo?.content}</p>
                </div>
                <button onClick={() => { setReplyTo(null); setEditingMsg(null); setMessageInput(''); }}
                  className="p-1 hover:bg-gray-200 rounded"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
            )}

            {/* ─── Input Area ─── */}
            <div className="px-4 pb-4 pt-2">
              <div className={`flex items-end gap-2 bg-gray-50 rounded-2xl border transition-all ${
                messageInput ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-gray-200'
              } px-3 py-2`}>
                {/* File upload */}
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors mb-0.5" title="Attach file">
                  <Paperclip className="w-5 h-5 text-gray-400" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }} />

                {encryptionReady && <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0 mb-1.5" />}

                <textarea ref={inputRef} value={messageInput}
                  onChange={e => { setMessageInput(e.target.value); handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={encryptionReady ? `Encrypted message in #${activeChannel.name}` : `Message #${activeChannel.name}...`}
                  className="flex-1 bg-transparent text-sm outline-none resize-none max-h-32 min-h-[24px] py-1"
                  rows={1} />

                <button onClick={handleSend} disabled={!messageInput.trim()}
                  className={`p-2 rounded-xl transition-all mb-0.5 ${
                    messageInput.trim()
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40'
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for new line · Drag & drop files · <strong>**bold**</strong> · <strong>*italic*</strong> · <strong>`code`</strong>
              </p>
            </div>
          </>
        ) : (
          /* ─── Empty State ─── */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <MessageSquare className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">ShadowField Chat</h2>
              <p className="text-sm text-gray-500 mb-1">End-to-end encrypted team communication</p>
              <p className="text-xs text-gray-400">Select a channel from the sidebar to start chatting</p>
              <div className="flex items-center justify-center gap-4 mt-6 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                <span className="flex items-center gap-1"><Smile className="w-3 h-3" /> Reactions</span>
                <span className="flex items-center gap-1"><Reply className="w-3 h-3" /> Replies</span>
                <span className="flex items-center gap-1"><Pin className="w-3 h-3" /> Pins</span>
                <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> Files</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
