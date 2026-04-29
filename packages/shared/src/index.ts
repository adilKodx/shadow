// ─── Supabase Client ───
export { supabase, initSupabase } from './lib/supabase';

// ─── Encryption ───
export { encryptMessage, decryptMessage, generateEncryptionKey, isEncrypted } from './lib/encryption';

// ─── Auth Context ───
export { AuthProvider, useAuth } from './context/AuthContext';
export type { Tenant, TenantMember } from './context/AuthContext';

// ─── Types ───
export type * from './types';

// ─── Hooks ───
export { useAlerts, ALERT_TYPES } from './hooks/useAlerts';
export { useAttendance, CHECKIN_STATUSES, EVENT_TYPES, RECURRENCE_OPTIONS } from './hooks/useAttendance';
export { useChat, CHANNEL_TYPES, QUICK_REACTIONS } from './hooks/useChat';
export { useIncidents, SEVERITY_LEVELS, INCIDENT_STATUSES, INCIDENT_TYPES } from './hooks/useIncidents';
export { useMap, ZONE_TYPES } from './hooks/useMap';
export { useNews, NEWS_CATEGORIES } from './hooks/useNews';
export { useNotifications } from './hooks/useNotifications';
export { usePOI, THREAT_LEVELS, POI_STATUSES, POI_CATEGORIES } from './hooks/usePOI';
export { useSOPs, SOP_CATEGORIES, PRIORITY_OPTIONS } from './hooks/useSOPs';
export { useTeam, MEMBER_ROLES, PLAN_TIERS } from './hooks/useTeam';
export { useVideoFeeds, FEED_TYPES, FEED_STATUSES } from './hooks/useVideoFeeds';
export { useWhiteLabel } from './hooks/useWhiteLabel';

// ─── Hook Types (re-export) ───
export type { Alert, AlertAcknowledgment } from './hooks/useAlerts';
export type { ChatChannel, ChatMessage, TypingUser, PresenceUser } from './hooks/useChat';
export type { Incident, IncidentUpdate } from './hooks/useIncidents';
export type { POIRecord, POIPhoto, POISighting } from './hooks/usePOI';
export type { VideoFeed } from './hooks/useVideoFeeds';
export type { SOP, SOPStep, ActionPlan, ActionPlanStep } from './hooks/useSOPs';
export type { NewsPost } from './hooks/useNews';
export type { TenantInvite } from './hooks/useTeam';
export type { WhiteLabelPartner, PricingTier, Subscription, BillingEvent, PartnerPayout } from './hooks/useWhiteLabel';
export type { AttendanceEvent, AttendanceSchedule, AttendanceCheckin } from './hooks/useAttendance';
