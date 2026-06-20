/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, db, hashPassword } from './src/dbStore.js';
import { Campaign, Advertisement, TargetAudience } from './src/types.js';

// Initialize our local persistent JSON-based database
initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json());

// Setup a routine to periodically increment metrics for active ads in-memory
// to simulate active real-time campaign execution!
setInterval(() => {
  try {
    db.tickAnalytics();
  } catch (err) {
    // Silent catch
  }
}, 30000); // ticks every 30 seconds

// Auxiliary server-side Lazy Gemini API instantiation
let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY not configured. Set your actual key in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// REST MIDDLEWARE: Authorization header check
function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized. Missing authentication token.' });
    return;
  }
  const userId = authHeader.split(' ')[1];
  const user = db.findUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired or user not found.' });
    return;
  }
  // Attach user to request
  (req as any).user = user;
  next();
}

// ---------------- USER REGISTRATION & AUTH ----------------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Please submit all required credentials.' });
    return;
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    res.status(400).json({ error: 'This email is already registered.' });
    return;
  }

  const selectedRole = (role === 'Admin' || role === 'Advertiser') ? role : 'Advertiser';
  const newUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name,
    email,
    role: selectedRole,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  db.addUser(newUser);
  db.addActivity(newUser.id, newUser.name, 'Account Registration', `Registered as ${selectedRole}`);

  // Return user omitting password hash
  const { passwordHash, ...userProfile } = newUser;
  res.status(251).json({ user: userProfile });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    res.status(400).json({ error: 'No account exists with this email address.' });
    return;
  }

  const hased = hashPassword(password);
  if (user.passwordHash !== hased) {
    res.status(400).json({ error: 'Incorrect password details.' });
    return;
  }

  db.addActivity(user.id, user.name, 'Account Login', 'Successfully logged in to platform');

  const { passwordHash, ...userProfile } = user;
  res.json({ token: user.id, user: userProfile });
});

app.get('/api/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user;
  res.json({ user });
});

// ---------------- CAMPAIGN MANAGEMENT ----------------

app.get('/api/campaigns', authenticateUser, (req, res) => {
  const user = (req as any).user;
  // Advertisers see only their campaigns, Admin sees everything
  const campaigns = user.role === 'Admin' ? db.getCampaigns() : db.getCampaigns(user.id);
  res.json({ campaigns });
});

app.post('/api/campaigns', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const { name, objective, platform, startDate, endDate, budget, spendingLimit, audienceId } = req.body;

  if (!name || !objective || !platform || !startDate || !endDate || !budget || !spendingLimit || !audienceId) {
    res.status(400).json({ error: 'Missing required campaign setup fields.' });
    return;
  }

  // Determine current status based on calendar dates
  const today = new Date().toISOString().split('T')[0];
  let status: any = 'active';
  if (startDate > today) {
    status = 'scheduled';
  } else if (endDate < today) {
    status = 'completed';
  }

  const newCampaign: Campaign = {
    id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name,
    objective,
    platform,
    startDate,
    endDate,
    budget: parseFloat(budget.toString()),
    spendingLimit: parseFloat(spendingLimit.toString()),
    status,
    audienceId,
    createdBy: user.id,
    createdAt: new Date().toISOString()
  };

  db.addCampaign(newCampaign);
  db.addActivity(user.id, user.name, 'Campaign Created', `Created campaign: "${name}" (${objective})`);
  res.status(201).json({ campaign: newCampaign });
});

app.put('/api/campaigns/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const campaignId = req.params.id;
  
  const existing = db.getCampaigns().find(c => c.id === campaignId);
  if (!existing) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }

  if (user.role !== 'Admin' && existing.createdBy !== user.id) {
    res.status(403).json({ error: 'Access forbidden. You do not own this campaign.' });
    return;
  }

  const { name, objective, platform, startDate, endDate, budget, spendingLimit, status, audienceId } = req.body;

  const updatedCampaign: Campaign = {
    ...existing,
    name: name || existing.name,
    objective: objective || existing.objective,
    platform: platform || existing.platform,
    startDate: startDate || existing.startDate,
    endDate: endDate || existing.endDate,
    budget: budget !== undefined ? parseFloat(budget.toString()) : existing.budget,
    spendingLimit: spendingLimit !== undefined ? parseFloat(spendingLimit.toString()) : existing.spendingLimit,
    status: status || existing.status,
    audienceId: audienceId || existing.audienceId
  };

  db.updateCampaign(updatedCampaign);
  db.addActivity(user.id, user.name, 'Campaign Updated', `Modified campaign: "${updatedCampaign.name}"`);
  res.json({ campaign: updatedCampaign });
});

app.delete('/api/campaigns/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const campaignId = req.params.id;

  const existing = db.getCampaigns().find(c => c.id === campaignId);
  if (!existing) {
    res.status(404).json({ error: 'Campaign does not exist' });
    return;
  }

  if (user.role !== 'Admin' && existing.createdBy !== user.id) {
    res.status(403).json({ error: 'Access forbidden.' });
    return;
  }

  db.deleteCampaign(campaignId, existing.createdBy);
  db.addActivity(user.id, user.name, 'Campaign Deleted', `Removed campaign: "${existing.name}"`);
  res.json({ success: true, message: 'Campaign deleted successfully.' });
});

// ---------------- ADVERTISEMENT MANAGEMENT ----------------

app.get('/api/ads', authenticateUser, (req, res) => {
  const user = (req as any).user;
  let ads = user.role === 'Admin' ? db.getAds() : db.getAds(user.id);

  // Extend ads with parent campaign objective and title
  const campaigns = db.getCampaigns();
  const audienceList = db.getAudiences();
  const adsWithDetails = ads.map(ad => {
    const parentCamp = campaigns.find(c => c.id === ad.campaignId);
    const parentAudience = parentCamp ? audienceList.find(a => a.id === parentCamp.audienceId) : null;
    return {
      ...ad,
      campaignName: parentCamp ? parentCamp.name : 'Unknown Campaign',
      campaignObjective: parentCamp ? parentCamp.objective : 'Awareness',
      campaignStatus: parentCamp ? parentCamp.status : 'active',
      audienceName: parentAudience ? parentAudience.name : 'Unfiltered'
    };
  });

  res.json({ ads: adsWithDetails });
});

app.post('/api/ads', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const { campaignId, title, bodyText, mediaUrl, mediaType, cta } = req.body;

  if (!campaignId || !title || !bodyText || !mediaType || !cta) {
    res.status(400).json({ error: 'Missing required ad material fields.' });
    return;
  }

  // Admin gets auto approval, Advertiser goes to 'pending_approval' queue
  const status = (user.role === 'Admin') ? 'active' : 'pending_approval';

  const newAd: Advertisement = {
    id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    campaignId,
    title,
    bodyText,
    mediaUrl: mediaUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=60',
    mediaType,
    cta,
    status,
    createdBy: user.id,
    createdAt: new Date().toISOString()
  };

  db.addAd(newAd);
  db.addActivity(
    user.id, 
    user.name, 
    'Ad Creation', 
    `Created ad: "${title}". Status: ${status === 'active' ? 'Approved' : 'Pending Verification'}`
  );
  res.status(251).json({ ad: newAd });
});

app.put('/api/ads/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const adId = req.params.id;

  const existing = db.getAds().find(a => a.id === adId);
  if (!existing) {
    res.status(404).json({ error: 'Ad not found' });
    return;
  }

  if (user.role !== 'Admin' && existing.createdBy !== user.id) {
    res.status(403).json({ error: 'Access forbidden. You do not own this ad draft.' });
    return;
  }

  const { title, bodyText, mediaUrl, mediaType, cta, status } = req.body;

  // If advertiser changes their rejected ad, set status back to pending_approval for review
  let finalStatus = status || existing.status;
  if (user.role === 'Advertiser' && existing.status === 'rejected') {
    finalStatus = 'pending_approval';
  }

  const updatedAd: Advertisement = {
    ...existing,
    title: title || existing.title,
    bodyText: bodyText || existing.bodyText,
    mediaUrl: mediaUrl !== undefined ? mediaUrl : existing.mediaUrl,
    mediaType: mediaType || existing.mediaType,
    cta: cta || existing.cta,
    status: finalStatus
  };

  db.updateAd(updatedAd);
  db.addActivity(user.id, user.name, 'Ad Modified', `Updated advertisement details for "${updatedAd.title}"`);
  res.json({ ad: updatedAd });
});

app.delete('/api/ads/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const adId = req.params.id;

  const existing = db.getAds().find(a => a.id === adId);
  if (!existing) {
    res.status(404).json({ error: 'Ad not found' });
    return;
  }

  if (user.role !== 'Admin' && existing.createdBy !== user.id) {
    res.status(403).json({ error: 'Access forbidden.' });
    return;
  }

  db.deleteAd(adId, user.id);
  db.addActivity(user.id, user.name, 'Ad Deleted', `Deleted ad: "${existing.title}"`);
  res.json({ success: true, message: 'Advertisement removed successfully.' });
});

// ---------------- TARGET AUDIENCE SEGMENTS ----------------

app.get('/api/audiences', authenticateUser, (req, res) => {
  const user = (req as any).user;
  let audiences = user.role === 'Admin' ? db.getAudiences() : db.getAudiences(user.id);
  if (user.role !== 'Admin' && audiences.length === 0) {
    audiences = db.getAudiences();
  }
  res.json({ audiences });
});

app.post('/api/audiences', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const { name, minAge, maxAge, gender, locations, interests, demographics } = req.body;

  if (!name || minAge === undefined || maxAge === undefined || !gender || !locations || !interests) {
    res.status(400).json({ error: 'Please submit complete demographic parameters.' });
    return;
  }

  const newAudience: TargetAudience = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name,
    minAge: parseInt(minAge.toString()),
    maxAge: parseInt(maxAge.toString()),
    gender,
    locations: Array.isArray(locations) ? locations : locations.split(',').map((x: string) => x.trim()),
    interests: Array.isArray(interests) ? interests : interests.split(',').map((x: string) => x.trim()),
    demographics: Array.isArray(demographics) ? demographics : (demographics ? demographics.split(',').map((x: string) => x.trim()) : []),
    createdBy: user.id
  };

  db.addAudience(newAudience);
  db.addActivity(user.id, user.name, 'Audience Saved', `Configured target demographic segment: "${name}"`);
  res.status(251).json({ audience: newAudience });
});

app.delete('/api/audiences/:id', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const audienceId = req.params.id;

  const success = db.deleteAudience(audienceId, user.id);
  if (!success) {
    res.status(400).json({ error: 'Could not delete audience. It might be owned by another user or does not exist.' });
    return;
  }

  db.addActivity(user.id, user.name, 'Audience Removed', `Deleted saved demographic layout`);
  res.json({ success: true, message: 'Audience segment deleted.' });
});

// ---------------- ANALYTICS LOGS AND REPORTS ----------------

app.get('/api/analytics', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const isAdvertiser = user.role === 'Advertiser';
  
  // Fetch lists
  const campaigns = isAdvertiser ? db.getCampaigns(user.id) : db.getCampaigns();
  const adList = isAdvertiser ? db.getAds(user.id) : db.getAds();
  const rawDataPoints = isAdvertiser ? db.getAnalytics(user.id) : db.getAnalytics();

  // Aggregate global campaign counts
  const adCount = adList.length;
  const campCount = campaigns.length;
  const activeCampCount = campaigns.filter(c => c.status === 'active').length;
  const scheduledCampCount = campaigns.filter(c => c.status === 'scheduled').length;
  const finishedCampCount = campaigns.filter(c => c.status === 'completed').length;
  const pausedCampCount = campaigns.filter(c => c.status === 'paused').length;

  // Sum up historic aggregates
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalReach = 0;

  rawDataPoints.forEach(pt => {
    totalSpend += pt.spend;
    totalImpressions += pt.impressions;
    totalClicks += pt.clicks;
    totalConversions += pt.conversions;
    totalReach += pt.reach || (pt.impressions * 0.83); // fallback reach
  });

  // Calculate dynamic click metrics
  const cpc = totalClicks > 0 ? parseFloat((totalSpend / totalClicks).toFixed(2)) : 0;
  const ctr = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const cpa = totalConversions > 0 ? parseFloat((totalSpend / totalConversions).toFixed(2)) : 0;
  const engagementRate = totalImpressions > 0 ? parseFloat((((totalClicks + totalConversions) / totalImpressions) * 100).toFixed(2)) : 0;

  // Build daily timeline representation
  const dailyTimelineMap: Record<string, {
    date: string, impressions: number, clicks: number, conversions: number, spend: number, reach: number
  }> = {};

  rawDataPoints.forEach(pt => {
    const d = pt.date;
    if (!dailyTimelineMap[d]) {
      dailyTimelineMap[d] = { date: d, impressions: 0, clicks: 0, conversions: 0, spend: 0, reach: 0 };
    }
    dailyTimelineMap[d].impressions += pt.impressions;
    dailyTimelineMap[d].clicks += pt.clicks;
    dailyTimelineMap[d].conversions += pt.conversions;
    dailyTimelineMap[d].spend += pt.spend;
    dailyTimelineMap[d].reach += pt.reach || (pt.impressions * 0.83);
  });

  // Turn into sorted array and calculate day CPC/CTR rates
  const chartData = Object.values(dailyTimelineMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(pt => ({
      ...pt,
      spend: parseFloat(pt.spend.toFixed(2)),
      ctr: pt.impressions > 0 ? parseFloat(((pt.clicks / pt.impressions) * 100).toFixed(2)) : 0,
      cpc: pt.clicks > 0 ? parseFloat((pt.spend / pt.clicks).toFixed(2)) : 0,
      cpa: pt.conversions > 0 ? parseFloat((pt.spend / pt.conversions).toFixed(2)) : 0
    }));

  // Build metrics categorized by campaign
  const campaignMetrics = campaigns.map(camp => {
    const cPoints = rawDataPoints.filter(p => p.campaignId === camp.id);
    let cSpend = 0, cImp = 0, cClk = 0, cConv = 0, cReach = 0;
    cPoints.forEach(pt => {
      cSpend += pt.spend;
      cImp += pt.impressions;
      cClk += pt.clicks;
      cConv += pt.conversions;
      cReach += pt.reach || (pt.impressions * 0.85);
    });

    const adDrafts = adList.filter(a => a.campaignId === camp.id);

    return {
      id: camp.id,
      name: camp.name,
      objective: camp.objective,
      status: camp.status,
      budget: camp.budget,
      adCount: adDrafts.length,
      spend: parseFloat(cSpend.toFixed(2)),
      impressions: cImp,
      clicks: cClk,
      conversions: cConv,
      reach: Math.round(cReach),
      ctr: cImp > 0 ? parseFloat(((cClk / cImp) * 100).toFixed(2)) : 0,
      cpc: cClk > 0 ? parseFloat((cSpend / cClk).toFixed(2)) : 0,
      cpa: cConv > 0 ? parseFloat((cSpend / cConv).toFixed(2)) : 0
    };
  });

  res.json({
    totals: {
      spend: parseFloat(totalSpend.toFixed(2)),
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      reach: Math.round(totalReach),
      cpc,
      ctr,
      cpa,
      engagementRate,
      campaigns: campCount,
      activeCampaigns: activeCampCount,
      scheduledCampaigns: scheduledCampCount,
      completedCampaigns: finishedCampCount,
      pausedCampaigns: pausedCampCount,
      adsCount: adCount
    },
    chartData,
    campaignMetrics
  });
});

// ---------------- ADMIN MODULE ACTIONS ----------------

// Verify Admin role middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'Admin') {
    res.status(403).json({ error: 'Access forbidden. This operation demands Administrator privilege.' });
    return;
  }
  next();
}

app.get('/api/admin/pending-ads', authenticateUser, requireAdmin, (req, res) => {
  const ads = db.getAds().filter(a => a.status === 'pending_approval');
  const campaigns = db.getCampaigns();
  
  const formatted = ads.map(a => {
    const parent = campaigns.find(c => c.id === a.campaignId);
    return {
      ...a,
      campaignName: parent ? parent.name : 'Independent ad draft'
    };
  });
  res.json({ ads: formatted });
});

app.post('/api/admin/verify-ad', authenticateUser, requireAdmin, (req, res) => {
  const { adId, decision, rejectionReason } = req.body;
  if (!adId || !decision) {
    res.status(400).json({ error: 'Missing parameters. Need adId and decision (approve/reject)' });
    return;
  }

  const ads = db.getAds();
  const ad = ads.find(a => a.id === adId);
  if (!ad) {
    res.status(404).json({ error: 'Ad draft not found for review.' });
    return;
  }

  const finalStatus = decision === 'approve' ? 'active' : 'rejected';
  const updatedAd: Advertisement = {
    ...ad,
    status: finalStatus,
    rejectionReason: decision === 'reject' ? (rejectionReason || 'Violates social media promotion guidelines') : undefined
  };

  db.updateAd(updatedAd);

  const admin = (req as any).user;
  db.addActivity(
    admin.id, 
    admin.name, 
    'Ad Verification Decision', 
    `Reviewed "${ad.title}". Made decision: ${decision.toUpperCase()}. Reason: ${rejectionReason || 'N/A'}`
  );

  res.json({ success: true, ad: updatedAd });
});

app.get('/api/admin/activities', authenticateUser, requireAdmin, (req, res) => {
  res.json({ activities: db.getActivities() });
});

app.get('/api/admin/users', authenticateUser, requireAdmin, (req, res) => {
  // Retract password hash details
  const users = db.getUsers().map(({ passwordHash, ...rest }) => rest);
  res.json({ users });
});

// Allow admin to change user roles or audit profiles
app.put('/api/admin/users/:id', authenticateUser, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;

  const user = db.getUsers().find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'User account not located.' });
    return;
  }

  if (role === 'Admin' || role === 'Advertiser') {
    user.role = role;
    db.saveDatabase();
    
    const admin = (req as any).user;
    db.addActivity(admin.id, admin.name, 'User Role Override', `Overrode user ${user.name}'s role to ${role}`);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid privilege specification.' });
  }
});

// ---------------- GEMINI ARTIFICIAL INTELLIGENCE SUGGESTIONS ----------------

app.post('/api/gemini/generate-ad', authenticateUser, async (req, res) => {
  const { campaignName, objective, productDescription, primaryKeywords, toneStyle } = req.body;
  
  if (!campaignName || !objective || !productDescription) {
    res.status(400).json({ error: 'Please enter Campaign target, core objective, and product description.' });
    return;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `
      You are an expert digital advertising copywriter and growth hacker.
      Generate 3 highly high-converting social media ad creatives based on these criteria:
      - Campaign Focus: "${campaignName}"
      - Ad Objective: "${objective}"
      - Product Description: "${productDescription}"
      - Brand Tone: "${toneStyle || 'Professional and engaging'}"
      - Anchor Keywords: "${primaryKeywords || 'None prescribed'}"

      Format response must be a strict JSON structure matching this TS system interface:
      {
        "suggestions": [
          {
            "headline": "Short punchy catchy click-worthy headline (max 80 chars)",
            "bodyText": "Persuasive ad copy with a Hook, Body highlighting pain point/benefits, and explicit urgency (approx 2 sentences)",
            "recommendedCTA": "Shop Now, Sign Up, Learn More, Join Now, etc.",
            "audienceHooks": "Short description of why this angle appeals to target market"
          }
        ],
        "targetingSuggestions": {
          "demographics": "Recommended age, gender, role constraints",
          "interestsKeywords": ["Interest 1", "Interest 2", "Interest 3"],
          "reasons": "Why these keywords fit"
        }
      }
      Do not include extra markdown comments, return ONLY the raw JSON block.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const cleanBody = response.text ? response.text.trim() : '';
    const parsed = JSON.parse(cleanBody);
    res.json(parsed);

  } catch (error: any) {
    console.error('Gemini ad generation failure:', error);
    
    // In case key is missing or failed, provide rich simulated fallback suggestion mock
    // to keep system operational with a clear tip!
    const keyMissing = error.message && error.message.includes("GEMINI_API_KEY");
    
    const fallbackMock = {
      suggestions: [
        {
          headline: `🔥 Discover ${campaignName}: Unleash Your Full Potential Today!`,
          bodyText: `Tired of slow progress and manual setups? ${productDescription} is built to streamline your workflow and save you up to 15 hours a week. Get started now and claim 20% off.`,
          recommendedCTA: objective === 'Sales' ? 'Shop Now' : objective === 'Leads' ? 'Sign Up' : 'Learn More',
          audienceHooks: "Highlights automated relief from pain points to captivate fast-moving users."
        },
        {
          headline: `💡 The Smarter Way to Handle ${campaignName}`,
          bodyText: `No more guessing. Experience why over 5,000 active professionals rely on our organic setup to accelerate growth. Zero risk. Full money-back guarantee.`,
          recommendedCTA: 'Learn More',
          audienceHooks: "Uses social validation to target premium high-tier shoppers."
        }
      ],
      targetingSuggestions: {
        demographics: "Target Age 25-54, All Genders, professional interest hubs.",
        interestsKeywords: ["Digital Marketing", "Workflow Efficiency", "Innovative Solutions"],
        reasons: "High intent keywords matching automated system metrics."
      },
      warning: keyMissing ? "GEMINI_API_KEY not configured. Set your actual key in Secrets panel. Showing highly relevant local templates." : error.message
    };

    res.json(fallbackMock);
  }
});

// Suggest audiences using Gemini helper
app.post('/api/gemini/suggest-audience', authenticateUser, async (req, res) => {
  const { audienceSegmentName, sectorDetails } = req.body;
  if (!audienceSegmentName) {
    res.status(400).json({ error: 'Please enter target segment target hook.' });
    return;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `
      You are an advertising reach strategist specializing in demographic media buying.
      Recommend granular audience parameters for:
      - Concept Hook: "${audienceSegmentName}"
      - Industry context: "${sectorDetails || 'General social consumers'}"

      Format response must be a strict JSON matching this structure:
      {
        "recommendedAudience": {
          "name": "Refined Segment Name",
          "minAge": 22,
          "maxAge": 55,
          "gender": "All" | "Male" | "Female",
          "locations": ["Country/City 1", "Country/City 2"],
          "interests": ["Interest 1", "Interest 2", "Interest 3", "Interest 4", "Interest 5"],
          "demographicsRefined": ["Demographic 1", "Demographic 2"]
        },
        "strategicAudienceRationale": "Explain why these specific interests and locations match the concept hook."
      }
      Do not include extra explanations, return ONLY the raw JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text.trim());
    res.json(parsed);

  } catch (error: any) {
    console.error('Gemini audience generation failure:', error);
    const keyMissing = error.message && error.message.includes("GEMINI_API_KEY");

    const fallbackMock = {
      recommendedAudience: {
        name: `Refined: ${audienceSegmentName} Segment`,
        minAge: 25,
        maxAge: 45,
        gender: "All",
        locations: ["United States", "United Kingdom", "Canada", "Australia", "Western Europe"],
        interests: ["Professional Development", "Technology Trends", "Social Innovation", "E-commerce"],
        demographicsRefined: ["Executive Management", "College Graduate", "Frequent Online Buyer"]
      },
      strategicAudienceRationale: "These demographics capture active online shoppers with professional disposable income.",
      warning: keyMissing ? "GEMINI_API_KEY not configured. Set your actual key in Secrets panel. Showing template suggestions." : error.message
    };
    res.json(fallbackMock);
  }
});


// Handle Vite / static assets at the end
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Server middleware mode integration
    // Ignore changes to server-side database file so backend writes don't trigger
    // client reloads (db.json is frequently updated by the server).
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          // Use a glob to ignore the database file and node_modules
          ignored: ['**/db.json', '**/node_modules/**']
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production client serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const host = 'localhost';
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Social Ads Management System running at http://${host}:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Express fails to initialize", err);
});
