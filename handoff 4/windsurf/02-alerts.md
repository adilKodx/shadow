# Convert AlertsScreen.tsx

You are working in `packages/mobile/src/screens/AlertsScreen.tsx`. Foundation files are in place.

## Goal

Restyle the alerts list with the new tactical dark/light system. Keep `useAlerts`, `acknowledgeAlert`, filter logic, refresh control — **identical**.

## Visual spec

1. **Header:** Title "ALERTS" in `typography.h1`, with a `<SevChip>` next to it showing the active count (use `level="critical"` if count > 0, `level="resolved"` if 0).
2. **Filter tabs** (`all` / `active` / `acknowledged`): segmented row of pills. Active pill uses `gradients.brand` LinearGradient background; inactive pills use `colors.surface` with `colors.border`. Padding 8×16, radius `radius.full`. Caption text uppercase, letter-spacing 1.
3. **Alert card** (each FlatList row):
   - Use `<GlassCard>` from `../components/ui`, marginBottom `spacing.md`
   - **Severity icon** left: 44×44 rounded square. Background = severity color + '22' alpha. Icon = matching `<Ionicons>` (alert-circle / warning / information-circle / chevron-down-circle) in severity color.
   - For `severity === 'critical'` AND `status === 'active'`: wrap the icon in a relative container and add `<PulseRing color={colors.critical} size={56} />` from `../components/ui` for the live pulse effect.
   - **Body** (flex 1): title (`typography.label`, 14, color `colors.text`), then message (`typography.bodySmall`, `colors.textSecondary`, 2 lines max), then footer row.
   - **Footer row:** `<SevChip level={...}>` (use the alert's severity), spacer, then if status is 'active': a `<GradientButton title="ACK" full={false} variant="ghost" />` style mini-button. Otherwise show `<MonoLabel>{formatDistanceToNow(alert.created_at)}</MonoLabel>`.
   - Add `useFadeUp(index, 60)` for staggered entrance — wrap each row in `<Animated.View>`.
4. **Empty state:** centered `<Ionicons name="shield-checkmark-outline" size={48} color={colors.success}>`, "ALL CLEAR" in display font, "No active alerts" subtitle.
5. **Loading state:** keep `ActivityIndicator` but use `colors.primary`.

## Severity → color map

```ts
const sev = {
  critical: colors.critical,  // FB4D6E (dark) / E11D48 (light)
  high:     colors.high,      // F472B6 / DB2777
  medium:   colors.medium,    // FBBF24 / D97706
  low:      colors.low,       // 22D3EE / 0891B2
};
```

## Code requirements

- `useThemeColors()` instead of static `colors`
- `useMemo(() => makeStyles(colors), [colors])` pattern
- Keep `RefreshControl`, `keyExtractor`, all FlatList props
- `acknowledgeAlert(alert.id)` wired identically
- Use `date-fns` `formatDistanceToNow` instead of `toLocaleDateString` for the relative time
- No new emoji; all icons via `@expo/vector-icons` Ionicons

## Acceptance

- Tapping ACK still calls `acknowledgeAlert`
- Filter tabs filter the list correctly
- Pull-to-refresh still hits `fetchAlerts`
- Critical active alerts show a pulsing ring around the icon
- List items fade up sequentially on mount

## Do NOT

- Touch `@shadowfield/shared/src/hooks/useAlerts`
- Add new actions or filters
- Modify navigation
