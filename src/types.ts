/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Advertiser';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export type CampaignObjective = 'Awareness' | 'Traffic' | 'Engagement' | 'Leads' | 'Sales';
export type SocialPlatform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Twitter' | 'TikTok' | 'Pinterest' | 'YouTube';
export type CampaignStatus = 'active' | 'scheduled' | 'paused' | 'completed';

export interface TargetAudience {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  gender: 'All' | 'Male' | 'Female' | 'Other';
  locations: string[];
  interests: string[];
  demographics: string[];
  createdBy: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  platform: SocialPlatform;
  startDate: string;
  endDate: string;
  budget: number;
  spendingLimit: number;
  status: CampaignStatus;
  audienceId: string;
  createdBy: string;
  createdAt: string;
}

export type AdMediaType = 'image' | 'video' | 'carousel';
export type AdStatus = 'pending_approval' | 'active' | 'rejected' | 'paused';

export interface Advertisement {
  id: string;
  campaignId: string;
  title: string;
  bodyText: string;
  mediaUrl: string;
  mediaType: AdMediaType;
  cta: string;
  status: AdStatus;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface AnalyticsDataPoint {
  id: string;
  campaignId: string;
  adId?: string;
  date: string;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  spend: number;
}

export interface AdminActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface SystemMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCPC: number;
  avgCTR: number;
  avgEngagementRate: number;
}
