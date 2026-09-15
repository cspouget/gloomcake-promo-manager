export type ReleaseStatus =
  | 'draft'
  | 'creative-directing'
  | 'awaiting-artwork-approval'
  | 'branding'
  | 'analyzing-audio'
  | 'rendering'
  | 'awaiting-campaign-approval'
  | 'approved-for-publishing'
  | 'scheduled'
  | 'published'
  | 'blocked'
  | 'error';

export type ClipJob = {
  id: string;
  start: number;
  duration: number;
  score?: number | null;
  label: string;
  format: '9:16';
  renderMode: 'wave' | 'bars' | 'ring';
  videoUrl?: string | null;
};

export type CreativeDirection = {
  emotionalCore: string;
  concepts: string[];
  rejectedConcept: number;
  selectedConcept: number;
  artworkPrompt: string;
  socialAngle: string;
};

export type ReleaseSocial = {
  tiktok: string;
  instagram: string;
  youtubeShortTitle: string;
  youtubeShortDescription: string;
  soundcloudDescription: string;
  soundcloudTags: string[];
};

export type ReleaseApprovals = {
  artworkApprovedAt?: string | null;
  campaignApprovedAt?: string | null;
  publishApprovedAt?: string | null;
};

export type ReleaseRecord = {
  id: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  status: ReleaseStatus;
  trackTitle: string;
  catalog: string;
  lyrics?: string;
  durationSec?: number | null;
  audioUrl: string;
  creative?: CreativeDirection | null;
  artOnlyUrl?: string | null;
  brandedArtworkUrl?: string | null;
  clips: ClipJob[];
  social?: ReleaseSocial | null;
  approvals: ReleaseApprovals;
  publish?: {
    metricoolBrandId?: string | null;
    scheduledPostIds?: string[];
    scheduledAt?: string | null;
  };
  error?: string | null;
};

export type ReleasePatch = Partial<Omit<ReleaseRecord, 'id' | 'createdAt' | 'version'>>;
