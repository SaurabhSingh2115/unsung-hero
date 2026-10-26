/**
 * Centralized frontend constants for Unsung Hero.
 * Prevents magic strings and ensures consistent defaults across the client app.
 */
import { Category, Dimension, Role, AlertType } from './models';

// ---------------------------------------------------------------------------
// Demo Personas & Defaults
// ---------------------------------------------------------------------------
export const DEFAULT_HERO_ID = 'priya';
export const DEFAULT_MANAGER_ID = 'karan';
export const DEFAULT_UNBLOCKED_PEER_ID = 'arjun';
export const DEFAULT_TEAM_ID = 'payments';

// ---------------------------------------------------------------------------
// LocalStorage Keys
// ---------------------------------------------------------------------------
export const STORAGE_KEY_USER_ID = 'unsung.userId';
export const STORAGE_KEY_CHAT_USER_ID = 'unsung.chatUserId';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const CATEGORY_MENTORING: Category = 'mentoring';
export const CATEGORY_UNBLOCKING: Category = 'unblocking';
export const CATEGORY_REVIEW: Category = 'review';
export const CATEGORY_DOCUMENTATION: Category = 'documentation';
export const CATEGORY_ONBOARDING: Category = 'onboarding';
export const CATEGORY_FIREFIGHTING: Category = 'firefighting';
export const CATEGORY_CORE: Category = 'core';

export const ALL_CATEGORIES: readonly Category[] = [
  CATEGORY_UNBLOCKING,
  CATEGORY_REVIEW,
  CATEGORY_MENTORING,
  CATEGORY_DOCUMENTATION,
  CATEGORY_ONBOARDING,
  CATEGORY_FIREFIGHTING,
  CATEGORY_CORE,
];

export const GLUE_CATEGORIES: readonly Category[] = [
  CATEGORY_MENTORING,
  CATEGORY_UNBLOCKING,
  CATEGORY_REVIEW,
  CATEGORY_DOCUMENTATION,
  CATEGORY_ONBOARDING,
  CATEGORY_FIREFIGHTING,
];

export const CATEGORY_LABELS: Record<Category, string> = {
  mentoring: 'Mentoring & 1:1s',
  unblocking: 'Unblocking others',
  review: 'Code & design review',
  documentation: 'Documentation & runbooks',
  onboarding: 'New hire onboarding',
  firefighting: 'Incident triage & fixes',
  core: 'Core feature delivery',
};

// ---------------------------------------------------------------------------
// Dimensions (Contribution Radar)
// ---------------------------------------------------------------------------
export const DIMENSION_IMPACT: Dimension = 'Impact';
export const DIMENSION_COLLABORATION: Dimension = 'Collaboration';
export const DIMENSION_KNOWLEDGE: Dimension = 'Knowledge';
export const DIMENSION_QUALITY: Dimension = 'Quality';
export const DIMENSION_LEADERSHIP: Dimension = 'Leadership';
export const DIMENSION_GROWTH: Dimension = 'Growth';

export const DIMENSIONS: readonly Dimension[] = [
  DIMENSION_IMPACT,
  DIMENSION_COLLABORATION,
  DIMENSION_KNOWLEDGE,
  DIMENSION_QUALITY,
  DIMENSION_LEADERSHIP,
  DIMENSION_GROWTH,
];

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLE_EMPLOYEE: Role = 'employee';
export const ROLE_MANAGER: Role = 'manager';

// ---------------------------------------------------------------------------
// Alert Types
// ---------------------------------------------------------------------------
export const ALERT_TYPE_RECOGNITION_GAP: AlertType = 'recognition_gap';
export const ALERT_TYPE_LOAD_IMBALANCE: AlertType = 'load_imbalance';
export const ALERT_TYPE_BUS_FACTOR: AlertType = 'bus_factor';
export const ALERT_TYPE_GHOST_CREDIT: AlertType = 'ghost_credit';
export const ALERT_TYPE_BURNOUT: AlertType = 'burnout';
