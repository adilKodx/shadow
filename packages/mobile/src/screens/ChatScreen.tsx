// ChatScreen.tsx — NEW
// Two views in one file: thread list (default) + thread detail (when one is selected).
// Mock data for now — wire to your messaging backend later.

import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { spacing, radius, typography, gradients, type ThemeColors } from '../theme';
import { useThemeColors } from '../context/ThemeContext';
import { useFadeUp, useTypingDots } from '../animations';
import { GlowDot, MonoLabel } from '../components/ui';

type Thread = {
  id: string;
  name: string;
  role: string;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
  initial: string;
  accent: string;
};

type Msg = {
  id: string;
  text: string;
  time: string;
  fromMe: boolean;
  status?: 'sent' | 'delivered' | 'read';
};

const MOCK_THREADS = (colors: ThemeColors): Thread[] => [
  { id: '1', name: 'Dispatch Central', role: 'Command', lastMsg: 'Copy that, units en route to Zone A', time: 'now', unread: 2, online: true, initial: 'D', accent: colors.primary },
  { id: '2', name: 'Officer Reyes', role: 'Field · Zone A', lastMsg: 'Suspect cleared, returning to post', time: '2m', unread: 0, online: true, initial: 'R', accent: colors.accent },
  { id: '3', name: 'Officer Chen', role: 'Field · Zone B', lastMsg: 'All quiet on the east perimeter', time: '12m', unread: 0, online: true, initial: 'C', accent: colors.success },
  { id: '4', name: 'Night Shift Group', role: '6 members', lastMsg: 'Williams: shift change at 0600', time: '1h', unread: 5, online: false, initial: 'N', accent: colors.warning },
  { id: '5', name: 'Manager Patel', role: 'Operations', lastMsg: 'Incident report needed by EOD', time: '3h', unread: 0, online: false, initial: 'P', accent: colors.high },
];

const MOCK_MESSAGES: Msg[] = [
  { id: '1', text: 'Suspicious individual reported near loading dock', time: '14:22', fromMe: false },
  { id: '2', text: 'Copy. Dispatching unit to investigate.', time: '14:22', fromMe: true, status: 'read' },
  { id: '3', text: 'Description: male, dark jacket, approx 6ft', time: '14:23', fromMe: false },
  { id: '4', text: 'On approach. Maintaining visual.', time: '14:25', fromMe: true, status: 'read' },
  { id: '5', text: 'Suspect cleared — was a delivery driver checking address', time: '14:28', fromMe: false },
  { id: '6', text: 'Good copy. Stand down. Resume normal patrol.', time: '14:28', fromMe: true, status: 'delivered' },
];

export default function ChatScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const threads = MOCK_THREADS(colors);

  if (activeThread) {
    return <ThreadDetail thread={activeThread} onBack={() => setActiveThread(null)} colors={colors} styles={styles} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.openDrawer?.()} style={styles.iconBtn}>
          <Ionicons name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.headerTitle}>DISPATCH</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <GlowDot color={colors.success} size={5} />
            <MonoLabel>4 ONLINE · 2 UNREAD</MonoLabel>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="search" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Thread list */}
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        renderItem={({ item, index }) => (
          <ThreadRow thread={item} index={index} onPress={() => setActiveThread(item)} colors={colors} styles={styles} />
        )}
      />
    </SafeAreaView>
  );
}

function ThreadRow({ thread, index, onPress, colors, styles }: any) {
  const fade = useFadeUp(index, 60);
  return (
    <Animated.View style={fade}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.threadRow}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={[thread.accent + 'AA', thread.accent + '44']} style={styles.avatar}>
            <Text style={styles.avatarText}>{thread.initial}</Text>
          </LinearGradient>
          {thread.online && <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.background }]} />}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.threadName}>{thread.name}</Text>
            <MonoLabel>{thread.time}</MonoLabel>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <MonoLabel color={thread.accent}>{thread.role.toUpperCase()}</MonoLabel>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={styles.threadMsg} numberOfLines={1}>{thread.lastMsg}</Text>
            {thread.unread > 0 && (
              <LinearGradient colors={gradients.brand as any} style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{thread.unread}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ThreadDetail({ thread, onBack, colors, styles }: any) {
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState<Msg[]>(MOCK_MESSAGES);
  const dots = useTypingDots();
  const send = () => {
    if (!msg.trim()) return;
    setMessages([...messages, { id: String(Date.now()), text: msg, time: 'now', fromMe: true, status: 'sent' }]);
    setMsg('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatarWrapSmall}>
          <LinearGradient colors={[thread.accent + 'AA', thread.accent + '44']} style={styles.avatarSmall}>
            <Text style={styles.avatarTextSmall}>{thread.initial}</Text>
          </LinearGradient>
          {thread.online && <View style={[styles.onlineDotSmall, { backgroundColor: colors.success, borderColor: colors.background }]} />}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.threadName}>{thread.name}</Text>
          <MonoLabel color={colors.success}>● ONLINE · {thread.role.toUpperCase()}</MonoLabel>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="call-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => <Bubble msg={item} accent={thread.accent} colors={colors} styles={styles} />}
        />

        {/* Typing indicator */}
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MonoLabel>{thread.name.split(' ')[0]} is typing</MonoLabel>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {dots.map((s, i) => (
              <Animated.View key={i} style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary }, s]} />
            ))}
          </View>
        </View>

        {/* Composer */}
        <View style={styles.composer}>
          <TouchableOpacity style={styles.composerIcon}>
            <Ionicons name="add" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="Send message…"
            placeholderTextColor={colors.textMute}
            style={styles.composerInput}
            multiline
          />
          <TouchableOpacity onPress={send} disabled={!msg.trim()}>
            <LinearGradient
              colors={msg.trim() ? gradients.brand as any : [colors.surfaceMute, colors.surfaceMute]}
              style={styles.sendBtn}
            >
              <Ionicons name="send" size={16} color={msg.trim() ? '#0A0A14' : colors.textMute} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, accent, colors, styles }: any) {
  if (msg.fromMe) {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <LinearGradient colors={gradients.brand as any} style={[styles.bubble, styles.bubbleMe]}>
          <Text style={[styles.bubbleText, { color: '#0A0A14' }]}>{msg.text}</Text>
        </LinearGradient>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          <MonoLabel>{msg.time}</MonoLabel>
          {msg.status === 'read' && <Ionicons name="checkmark-done" size={12} color={colors.accent} />}
          {msg.status === 'delivered' && <Ionicons name="checkmark-done" size={12} color={colors.textTertiary} />}
          {msg.status === 'sent' && <Ionicons name="checkmark" size={12} color={colors.textTertiary} />}
        </View>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-start', maxWidth: '78%' }}>
      <View style={[styles.bubble, styles.bubbleThem]}>
        <Text style={[styles.bubbleText, { color: colors.text }]}>{msg.text}</Text>
      </View>
      <MonoLabel style={{ marginTop: 4 }}>{msg.time}</MonoLabel>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  headerTitle: { ...typography.h2, color: colors.text, letterSpacing: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  threadRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.text },
  avatarWrapSmall: { position: 'relative', marginLeft: spacing.sm },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { fontSize: 14, fontWeight: '700', color: colors.text },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  onlineDotSmall: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
  },
  threadName: { ...typography.label, fontSize: 15, color: colors.text },
  threadMsg: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, marginRight: 8 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#0A0A14' },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '100%' },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.body, fontSize: 14 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surface,
  },
  composerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMute, justifyContent: 'center', alignItems: 'center',
  },
  composerInput: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: colors.surfaceMute, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: colors.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
});
