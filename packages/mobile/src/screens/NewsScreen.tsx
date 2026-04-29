import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNews, NEWS_CATEGORIES } from '@shadowfield/shared/src/hooks/useNews';
import type { NewsPost } from '@shadowfield/shared/src/hooks/useNews';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { format } from 'date-fns';
import { colors, spacing, radius, typography, shadow } from '../theme';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  announcement: { bg: '#dbeafe', text: '#1e40af' },
  update: { bg: '#dcfce7', text: '#166534' },
  policy: { bg: '#f3e8ff', text: '#6b21a8' },
  training: { bg: '#e0e7ff', text: '#3730a3' },
  safety: { bg: '#fee2e2', text: '#991b1b' },
  event: { bg: '#fef3c7', text: '#92400e' },
  general: { bg: '#f1f5f9', text: '#475569' },
};

export default function NewsScreen() {
  const { member } = useAuth();
  const { posts, loading, fetchPosts, createPost, deletePost, incrementViewCount } = useNews();
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';

  const filtered = posts.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
    const matchesCat = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const openPost = (post: NewsPost) => {
    setSelectedPost(post);
    incrementViewCount(post.id);
  };

  const renderPost = ({ item: post }: { item: NewsPost }) => {
    const cat = CATEGORY_COLORS[post.category] || CATEGORY_COLORS.general;
    return (
      <TouchableOpacity
        style={[styles.postCard, shadow.sm, post.is_pinned && styles.postPinned]}
        activeOpacity={0.7}
        onPress={() => openPost(post)}
      >
        {post.is_pinned && (
          <View style={styles.pinBadge}>
            <Ionicons name="pin" size={10} color="#f59e0b" />
            <Text style={styles.pinText}>Pinned</Text>
          </View>
        )}
        <View style={styles.postHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.categoryText, { color: cat.text }]}>
              {NEWS_CATEGORIES.find(c => c.value === post.category)?.label || post.category}
            </Text>
          </View>
          {post.priority === 'urgent' && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
        <View style={styles.postFooter}>
          <Text style={styles.postAuthor}>{post.author_name}</Text>
          <View style={styles.postMeta}>
            <Ionicons name="eye-outline" size={12} color={colors.textTertiary} />
            <Text style={styles.postMetaText}>{post.view_count}</Text>
            <Text style={styles.postDate}>
              {format(new Date(post.publish_at), 'MMM d')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Updates</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={22} color={colors.textInverse} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterChip, !filterCategory && styles.filterChipActive]}
          onPress={() => setFilterCategory('')}
        >
          <Text style={[styles.filterText, !filterCategory && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {NEWS_CATEGORIES.map(c => {
          const active = filterCategory === c.value;
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilterCategory(active ? '' : c.value)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Posts List */}
      {loading && posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
            </View>
          }
        />
      )}

      {/* Post Detail Modal */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPost(null)}
      >
        {selectedPost && (
          <SafeAreaView style={styles.modalContainer} edges={['top']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedPost(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => {
                      deletePost(selectedPost.id);
                      setSelectedPost(null);
                    }}
                    style={styles.modalAction}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalMeta}>
                <View style={[styles.categoryBadge, { backgroundColor: (CATEGORY_COLORS[selectedPost.category] || CATEGORY_COLORS.general).bg }]}>
                  <Text style={[styles.categoryText, { color: (CATEGORY_COLORS[selectedPost.category] || CATEGORY_COLORS.general).text }]}>
                    {NEWS_CATEGORIES.find(c => c.value === selectedPost.category)?.label}
                  </Text>
                </View>
                <Text style={styles.modalDate}>
                  {format(new Date(selectedPost.publish_at), 'MMMM d, yyyy')}
                </Text>
              </View>
              <Text style={styles.modalTitle}>{selectedPost.title}</Text>
              <Text style={styles.modalAuthor}>By {selectedPost.author_name}</Text>
              <View style={styles.modalDivider} />
              <Text style={styles.modalBody}>{selectedPost.content}</Text>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  filterRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.headerBg,
    borderColor: colors.headerBg,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: 100,
    gap: spacing.md,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  postPinned: {
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  pinText: {
    ...typography.caption,
    color: '#f59e0b',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  categoryText: {
    ...typography.caption,
    fontSize: 10,
  },
  urgentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: '#fee2e2',
  },
  urgentText: {
    ...typography.caption,
    fontSize: 10,
    color: '#991b1b',
  },
  postTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  postContent: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postAuthor: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postMetaText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginRight: spacing.sm,
  },
  postDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalAction: {
    padding: spacing.sm,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.xl,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  modalTitle: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalAuthor: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xl,
  },
  modalBody: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
});
