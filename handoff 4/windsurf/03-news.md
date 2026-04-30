# Convert NewsScreen.tsx

You are working in `packages/mobile/src/screens/NewsScreen.tsx`. Foundation files are in place.

## Goal

Restyle the news/posts list and the post-detail modal. Keep `useNews`, `createPost`, `deletePost`, `incrementViewCount`, search, category filter — **all unchanged**.

## Visual spec

1. **Header:** "NEWS & UPDATES" title, `typography.h1`. If admin, show a small `<GradientButton variant="primary">+</GradientButton>` (icon-only, 36×36) on the right.
2. **Search bar:** Use `<GlassCard padding={0}>` wrapping a flex row: search icon (`Ionicons name="search"`), `<TextInput>` (placeholder "Search posts…", color `colors.textTertiary`), close-x button if there's text. Height 48, padding 14.
3. **Category filter chips:** horizontal ScrollView with chips. Active chip uses `gradients.brand` gradient background. Inactive chips use `colors.surface` with hairline border. Gap 8.
4. **Post card** (each FlatList row):
   - `<GlassCard>` with marginBottom `spacing.md`
   - **Pin badge** (if pinned): top row, `<Ionicons name="pin" color={colors.warning}>` + "PINNED" in `MonoLabel` color `colors.warning`
   - **Top row:** category badge (small pill, background = category color + '22', text = category color, uppercase, mono caption), spacer, urgent badge if `priority === 'urgent'` (background `colors.criticalBg`, text `colors.critical`)
   - Title `typography.h3`, color `colors.text`, 2 lines max
   - Content snippet `typography.bodySmall`, `colors.textSecondary`, 2 lines max
   - **Footer row:** `<MonoLabel>{author_name}</MonoLabel>` left; right side: eye icon + view count + date (date in `colors.textTertiary`, mono)
   - Add `useFadeUp(index, 50)` per row
5. **Modal** (when post selected):
   - Background `colors.background` (full sheet)
   - Header bar: close X left, delete (admin) right. Hairline border bottom (`colors.borderLight`).
   - Body scroll: category badge + date row, then title `typography.h1`, then "By {author_name}" in `MonoLabel`, hairline divider, then content body in `typography.body` color `colors.text`, lineHeight 26.

## Category color map

```ts
const CATEGORY_COLORS: Record<string, string> = {
  announcement: colors.accent,        // cyan
  update:       colors.success,       // green
  policy:       colors.primary,       // violet
  training:     colors.high,          // pink
  safety:       colors.critical,      // red/rose
  event:        colors.warning,       // amber
  general:      colors.textSecondary,
};
```

Helper for badge background: `categoryColor + '22'` (alpha hex append).

## Code requirements

- `useThemeColors()` / `useMemo(() => makeStyles(colors), [colors])`
- Keep `Modal animationType="slide" presentationStyle="pageSheet"`
- Keep `format(new Date(post.publish_at), 'MMM d')` for short dates, `'MMMM d, yyyy'` for modal
- Search input clears on x tap (existing behavior)
- All Ionicons names from existing code retained

## Acceptance

- Tapping a post opens the modal and increments view count (existing `incrementViewCount` still called)
- Admin delete still works inside modal
- Pull-to-refresh still fetches posts
- Pinned posts get the pin badge and a 1px gold border

## Do NOT

- Touch `@shadowfield/shared/src/hooks/useNews`
- Add post creation modal (existing button is just a stub — leave it that way)
- Add new categories
