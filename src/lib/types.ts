export type Role = "user" | "moderator" | "admin";

export interface Me {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  role: Role;
  mfaEnabled: boolean;
  isVerified: boolean;
  /** What this staff member may do (admins: everything). */
  permissions?: Permission[];
}

export type Permission =
  | "dashboard.view" | "reports.view" | "reports.resolve" | "posts.view" | "posts.moderate" | "comments.view" | "comments.moderate"
  | "abuse.view" | "feedback.view" | "users.view" | "users.ban" | "users.manage" | "media.view" | "media.delete" | "audit.view" | "settings.manage";

export interface PermissionInfo { key: Permission; group: string; label: string; desc: string; default: boolean }

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  isVerified: boolean;
  isBanned: boolean;
  banReason: string | null;
  bannedUntil: string | null;
  abuseScore: number;
  postCount: number;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions?: Permission[];
  customPermissions?: boolean;
}

export interface AdminUserDetail extends AdminUser {
  stats: { comments: number; sessions: number; reports_filed: number; devices: number };
  recentPosts: { id: string; content: string; likes_count: number; comments_count: number; is_removed: boolean; created_at: string }[];
}

export interface AdminPost {
  id: string;
  content: string;
  media: { url: string; type: "image" | "video" }[];
  visibility: "identity" | "anonymous";
  likesCount: number;
  commentsCount: number;
  reportsCount: number;
  isRemoved: boolean;
  removedReason: string | null;
  abuseFlags: string[];
  createdAt: string;
  author: { username: string; displayName: string } | null;
}

export interface AdminComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: string;
  likesCount: number;
  isRemoved: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  targetType: "post" | "comment" | "message" | "user";
  targetId: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  resolutionNote: string | null;
  reporter: string;
  reviewer: string | null;
  reviewedAt: string | null;
  createdAt: string;
  target: {
    content: string | null;
    isRemoved: boolean | null;
    author: string | null;
    visibility?: "identity" | "anonymous";
    reportsCount?: number;
    postId?: string;
    profile?: string; // reported profile's username
    media?: { url: string; type: string }[];
  };
}

export interface AuditLog {
  id: number;
  actorId: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  signatureValid: boolean;
}

export interface MediaItem {
  id: string;
  url: string;
  kind: "image" | "video";
  mime: string;
  size: number;
  status: string;
  purpose: string;
  storage: "r2" | "local";
  createdAt: string;
  postId: string | null;
  ownerId: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface Settings {
  site: {
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    footerText: string;
    announcement: { enabled: boolean; text: string; variant: "info" | "success" | "warning" | "danger"; link: string | null };
  };
  features: {
    registrationEnabled: boolean;
    anonymousPostingEnabled: boolean;
    commentsEnabled: boolean;
    mediaUploadsEnabled: boolean;
    messagingEnabled: boolean;
    videoUploadsEnabled: boolean;
    requireEmailVerification: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  limits: {
    maxPostLength: number;
    maxCommentLength: number;
    maxMediaPerPost: number;
    maxImageMb: number;
    maxVideoMb: number;
    anonAccountAgeHours: number;
    globalRequestsPer15Min: number;
    postsPerHour: number;
    anonPostsPerHour: number;
    commentsPerHour: number;
    messagesPerMinute: number;
    maxFriends: number;
  };
  moderation: {
    bannedWords: string[];
    autoHideReportThreshold: number;
    duplicateWindowMinutes: number;
    similarityThreshold: number;
    requireMfaForIdentityLookup: boolean;
  };
}
