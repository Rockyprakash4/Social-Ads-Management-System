/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  User, 
  TargetAudience, 
  Campaign, 
  Advertisement, 
  AnalyticsDataPoint, 
  AdminActivity 
} from './types.js';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Memory cache to avoid constant disk access
let dbState: {
  users: Array<User & { passwordHash: string }>;
  audiences: TargetAudience[];
  campaigns: Campaign[];
  ads: Advertisement[];
  analytics: AnalyticsDataPoint[];
  activities: AdminActivity[];
} = {
  users: [],
  audiences: [],
  campaigns: [],
  ads: [],
  analytics: [],
  activities: []
};

// Simple helper to hash password using Node's standard crypto module
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate high quality, authentic metrics history for the last 30 days
function preseedAnalytics(campaigns: Campaign[], ads: Advertisement[]) {
  const dataPoints: AnalyticsDataPoint[] = [];
  const now = new Date();
  
  campaigns.forEach(campaign => {
    // Determine scaling metrics based on objective
    let objScaleImpressions = 2000;
    let objScaleClicks = 100;
    let objScaleConversions = 5;
    let clickRate = 0.05; // 5%
    let convRate = 0.05; // 5% of clicks
    let dailyCost = campaign.budget / 30;

    if (campaign.objective === 'Awareness') {
      objScaleImpressions = 5000;
      clickRate = 0.015; // 1.5%
      convRate = 0.01; // 1%
    } else if (campaign.objective === 'Traffic') {
      objScaleImpressions = 2500;
      clickRate = 0.07; // 7%
      convRate = 0.02; // 2%
    } else if (campaign.objective === 'Sales') {
      objScaleImpressions = 1500;
      clickRate = 0.04; // 4%
      convRate = 0.12; // 12%
    } else if (campaign.objective === 'Leads') {
      objScaleImpressions = 1800;
      clickRate = 0.05; // 5%
      convRate = 0.08; // 8%
    }

    // Daily historical points for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      
      // Introduce structural fluctuations (e.g. weekend dips)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dayFactor = isWeekend ? 0.75 : 1.1;
      const randomFactor = 0.85 + Math.random() * 0.3; // +-15%
      
      const impressions = Math.round(objScaleImpressions * dayFactor * randomFactor);
      const reach = Math.round(impressions * (0.75 + Math.random() * 0.1));
      const clicks = Math.round(impressions * clickRate * randomFactor);
      const conversions = Math.round(clicks * convRate * randomFactor);
      const spend = parseFloat((dailyCost * dayFactor * randomFactor).toFixed(2));

      // Find primary ad for this campaign to associate or keep general
      const assocAd = ads.find(a => a.campaignId === campaign.id);

      dataPoints.push({
        id: `analytic_${campaign.id}_${i}`,
        campaignId: campaign.id,
        adId: assocAd?.id,
        date: dateString,
        impressions,
        reach,
        clicks,
        conversions,
        spend
      });
    }
  });

  return dataPoints;
}

export function initDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw);
      // Double check structured models
      if (!dbState.users) dbState.users = [];
      if (!dbState.audiences) dbState.audiences = [];
      if (!dbState.campaigns) dbState.campaigns = [];
      if (!dbState.ads) dbState.ads = [];
      if (!dbState.analytics) dbState.analytics = [];
      if (!dbState.activities) dbState.activities = [];
      console.log('Database loaded successfully, existing records:', dbState.campaigns.length);
      return;
    }
  } catch (err) {
    console.error('Error reading database file, re-initializing...', err);
  }

  // Preseed default data
  const adminId = 'u_admin_101';
  const advertId = 'u_advertiser_202';

  dbState.users = [
    {
      id: adminId,
      name: 'Sarah Jenkins',
      email: 'admin@example.com',
      role: 'Admin',
      passwordHash: hashPassword('admin123'),
      createdAt: new Date().toISOString()
    },
    {
      id: advertId,
      name: 'Alex Rivera',
      email: 'advertiser@example.com',
      role: 'Advertiser',
      passwordHash: hashPassword('ads123'),
      createdAt: new Date().toISOString()
    }
  ];

  dbState.audiences = [
    {
      id: 'aud_millennials',
      name: 'Tech Savvy Millennials',
      minAge: 25,
      maxAge: 40,
      gender: 'All',
      locations: ['United States', 'United Kingdom', 'Canada', 'Germany'],
      interests: ['Technology', 'Gadgets', 'Startups', 'SaaS', 'Mobile Apps'],
      demographics: ['College Graduates', 'Employed', 'Urban Living'],
      createdBy: advertId
    },
    {
      id: 'aud_fitness',
      name: 'Active Fitness Enthusiasts',
      minAge: 18,
      maxAge: 45,
      gender: 'All',
      locations: ['Worldwide'],
      interests: ['Healthy Diet', 'Yoga', 'Gym Workout', 'Fitness Tracking', 'Supplements'],
      demographics: ['Health Conscious', 'Active Consumers'],
      createdBy: advertId
    },
    {
      id: 'aud_decision_makers',
      name: 'Corporate B2B Directors',
      minAge: 30,
      maxAge: 65,
      gender: 'All',
      locations: ['San Francisco', 'New York', 'London', 'Singapore', 'Toronto'],
      interests: ['Business Management', 'Enterprise Software', 'Digital Advertising', 'Strategy'],
      demographics: ['Executives', 'Senior Managers', 'Decision Makers'],
      createdBy: advertId
    }
  ];

  dbState.campaigns = [
    {
      id: 'camp_sports',
      name: 'Summer Sports Essentials Launch',
      objective: 'Sales',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: 5200,
      spendingLimit: 175,
      status: 'active',
      audienceId: 'aud_fitness',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'camp_saas',
      name: 'B2B Analytics SaaS Automation Program',
      objective: 'Leads',
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: 12000,
      spendingLimit: 400,
      status: 'active',
      audienceId: 'aud_decision_makers',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'camp_brand',
      name: 'Millennial Green Eco-friendly Drink Awareness',
      objective: 'Awareness',
      startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: 3500,
      spendingLimit: 120,
      status: 'completed',
      audienceId: 'aud_millennials',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'camp_gaming',
      name: 'Next-Gen Mobile Game Beta Release',
      objective: 'Traffic',
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: 6500,
      spendingLimit: 250,
      status: 'scheduled',
      audienceId: 'aud_millennials',
      createdBy: advertId,
      createdAt: new Date().toISOString()
    }
  ];

  dbState.ads = [
    {
      id: 'ad_fit_bundle',
      campaignId: 'camp_sports',
      title: 'Power Up Your Workouts This Summer - Outdoor Fit Bundle 15% Off',
      bodyText: 'Looking to double down on your fitness? Our premium athletic gear is built for high performance. Order today and get a free trial on our premium app coaching!',
      mediaUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=60',
      mediaType: 'image',
      cta: 'Shop Now',
      status: 'active',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad_saas_free_trial',
      campaignId: 'camp_saas',
      title: 'Automate Business Reporting Over 10 Hours a Week. Start Free.',
      bodyText: 'Stop dragging CSVs around. Let our integrated pipeline automate your metrics boards and alert you to anomalies in real-time. Full corporate security included.',
      mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=60',
      mediaType: 'image',
      cta: 'Sign Up',
      status: 'active',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad_green_drink',
      campaignId: 'camp_brand',
      title: 'Refresh Consciously. 100% Organic Eco-Drink by GreenBottle',
      bodyText: 'Delicious, guilt-free refreshing tea made with locally sourced organic herbs. Delivered in biodegradable paper cartons because we love the planet as much as you.',
      mediaUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=60',
      mediaType: 'image',
      cta: 'Learn More',
      status: 'active',
      createdBy: advertId,
      createdAt: new Date(Date.now() - 41 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad_gaming_beta',
      campaignId: 'camp_gaming',
      title: 'Mythic Sagas: Realm Wars - Mobile Closed Beta Invites Out!',
      bodyText: 'Claim your limited key to play our open-world dynamic PvP strategic simulator early. Exclusive in-game skin for the first 1,000 players!',
      mediaUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=60',
      mediaType: 'image',
      cta: 'Download',
      status: 'pending_approval',
      createdBy: advertId,
      createdAt: new Date().toISOString()
    }
  ];

  dbState.analytics = preseedAnalytics(dbState.campaigns, dbState.ads);

  dbState.activities = [
    {
      id: 'act_1',
      userId: advertId,
      userName: 'Alex Rivera',
      action: 'Campaign Creation',
      details: 'Created "SaaS Analytics Automation Program" Campaign',
      timestamp: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'act_2',
      userId: adminId,
      userName: 'Sarah Jenkins',
      action: 'Ad Approval',
      details: 'Approved advertisement: "Automate Business Reporting"',
      timestamp: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  saveDatabase();
  console.log('Database pre-seeded with rich history data successfully.');
}

export function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file', err);
  }
}

// Global Database API exposed to the server
export const db = {
  saveDatabase,
  getUsers: () => dbState.users,
  addUser: (user: User & { passwordHash: string }) => {
    dbState.users.push(user);
    saveDatabase();
  },
  findUserByEmail: (email: string) => {
    return dbState.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserById: (id: string) => {
    return dbState.users.find(u => u.id === id);
  },

  getAudiences: (userId?: string) => {
    if (userId) {
      return dbState.audiences.filter(a => a.createdBy === userId);
    }
    return dbState.audiences;
  },
  addAudience: (audience: TargetAudience) => {
    dbState.audiences.push(audience);
    saveDatabase();
    return audience;
  },
  deleteAudience: (id: string, userId: string) => {
    const idx = dbState.audiences.findIndex(a => a.id === id && a.createdBy === userId);
    if (idx !== -1) {
      dbState.audiences.splice(idx, 1);
      saveDatabase();
      return true;
    }
    return false;
  },

  getCampaigns: (userId?: string) => {
    // Automatically update campaigns whose statuses should change due to dates
    const today = new Date().toISOString().split('T')[0];
    let changed = false;
    dbState.campaigns.forEach(c => {
      if (c.status === 'scheduled' && c.startDate <= today && c.endDate >= today) {
        c.status = 'active';
        changed = true;
      } else if (c.status === 'active' && c.endDate < today) {
        c.status = 'completed';
        changed = true;
      }
    });
    if (changed) {
      saveDatabase();
    }

    if (userId) {
      return dbState.campaigns.filter(c => c.createdBy === userId);
    }
    return dbState.campaigns;
  },
  addCampaign: (campaign: Campaign) => {
    dbState.campaigns.push(campaign);
    
    // Seed blank analytical placeholders for this new campaign
    const daysHistorical = 1;
    const now = new Date();
    dbState.analytics.push({
      id: `analytic_${campaign.id}_today`,
      campaignId: campaign.id,
      date: now.toISOString().split('T')[0],
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      spend: 0
    });

    saveDatabase();
    return campaign;
  },
  updateCampaign: (campaign: Campaign) => {
    const idx = dbState.campaigns.findIndex(c => c.id === campaign.id);
    if (idx !== -1) {
      dbState.campaigns[idx] = campaign;
      saveDatabase();
      return true;
    }
    return false;
  },
  deleteCampaign: (id: string, userId: string) => {
    const idx = dbState.campaigns.findIndex(c => c.id === id && c.createdBy === userId);
    if (idx !== -1) {
      dbState.campaigns.splice(idx, 1);
      // Delete associated ads and analytics
      dbState.ads = dbState.ads.filter(a => a.campaignId !== id);
      dbState.analytics = dbState.analytics.filter(an => an.campaignId !== id);
      saveDatabase();
      return true;
    }
    return false;
  },

  getAds: (userId?: string) => {
    if (userId) {
      return dbState.ads.filter(a => a.createdBy === userId);
    }
    return dbState.ads;
  },
  addAd: (ad: Advertisement) => {
    dbState.ads.push(ad);
    saveDatabase();
    return ad;
  },
  updateAd: (ad: Advertisement) => {
    const idx = dbState.ads.findIndex(a => a.id === ad.id);
    if (idx !== -1) {
      dbState.ads[idx] = { ...dbState.ads[idx], ...ad };
      saveDatabase();
      return true;
    }
    return false;
  },
  deleteAd: (id: string, userId: string) => {
    const idx = dbState.ads.findIndex(a => a.id === id && (a.createdBy === userId || dbState.users.find(u => u.id === userId)?.role === 'Admin'));
    if (idx !== -1) {
      dbState.ads.splice(idx, 1);
      saveDatabase();
      return true;
    }
    return false;
  },

  getAnalytics: (userId?: string) => {
    if (userId) {
      const userCampaignIds = dbState.campaigns.filter(c => c.createdBy === userId).map(c => c.id);
      return dbState.analytics.filter(an => userCampaignIds.includes(an.campaignId));
    }
    return dbState.analytics;
  },

  getActivities: () => {
    return dbState.activities;
  },
  addActivity: (userId: string, userName: string, action: string, details: string) => {
    const activity: AdminActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    dbState.activities.unshift(activity);
    
    // limit activity records length to prevent unbounded growth of file
    if (dbState.activities.length > 200) {
      dbState.activities.pop();
    }
    
    saveDatabase();
    return activity;
  },

  // Generates randomized/progressive live stats for newly active campaigns daily
  tickAnalytics: () => {
    const campaigns = dbState.campaigns.filter(c => c.status === 'active');
    const today = new Date().toISOString().split('T')[0];
    let updated = false;

    campaigns.forEach(camp => {
      // Check if we already added a point for today
      let todayEntryIdx = dbState.analytics.findIndex(an => an.campaignId === camp.id && an.date === today);
      
      const rate = camp.objective === 'Sales' ? 0.05 : camp.objective === 'Traffic' ? 0.08 : 0.02;
      const progressFactor = Math.random() * 25 + 5; // progressive ticks
      
      const newImp = Math.round(progressFactor * 30);
      const newCls = Math.round(newImp * (rate + Math.random() * 0.02));
      const newConv = Math.round(newCls * (0.08 + Math.random() * 0.05));
      const newSpd = parseFloat((newCls * (0.15 + Math.random() * 0.45)).toFixed(2));

      if (todayEntryIdx !== -1) {
        dbState.analytics[todayEntryIdx].impressions += newImp;
        dbState.analytics[todayEntryIdx].reach += Math.round(newImp * 0.85);
        dbState.analytics[todayEntryIdx].clicks += newCls;
        dbState.analytics[todayEntryIdx].conversions += newConv;
        dbState.analytics[todayEntryIdx].spend = parseFloat((dbState.analytics[todayEntryIdx].spend + newSpd).toFixed(2));
      } else {
        dbState.analytics.push({
          id: `analytic_${camp.id}_today_${Date.now()}`,
          campaignId: camp.id,
          date: today,
          impressions: newImp,
          reach: Math.round(newImp * 0.85),
          clicks: newCls,
          conversions: newConv,
          spend: newSpd
        });
      }
      updated = true;
    });

    if (updated) {
      saveDatabase();
    }
  }
};
