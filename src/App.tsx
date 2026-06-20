/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  Image as ImageIcon, 
  Users, 
  BarChart3, 
  ShieldAlert, 
  Sparkles, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Edit, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Info, 
  Check, 
  RefreshCw,
  PlusCircle,
  HelpCircle,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

// Interfaces mapping directly to server-side types
import { 
  User, 
  Campaign, 
  Advertisement, 
  TargetAudience, 
  AdminActivity,
  CampaignObjective,
  SocialPlatform,
  UserRole
} from './types';

export default function App() {
  // Session & Authentication
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'Admin' | 'Advertiser'>('Advertiser');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Layout & Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campaigns' | 'ads' | 'audiences' | 'analytics' | 'admin' | 'docs'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalFilter, setGlobalFilter] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data Stores
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<(Advertisement & { campaignName?: string; campaignObjective?: string; campaignStatus?: string; audienceName?: string })[]>([]);
  const [audiences, setAudiences] = useState<TargetAudience[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [pendingAds, setPendingAds] = useState<(Advertisement & { campaignName?: string })[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0, cpc: 0, ctr: 0, cpa: 0, engagementRate: 0, campaigns: 0, activeCampaigns: 0, scheduledCampaigns: 0, completedCampaigns: 0, pausedCampaigns: 0, adsCount: 0 },
    chartData: [],
    campaignMetrics: []
  });

  // Modal / Form States
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // New entry form bindings
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    objective: 'Sales' as CampaignObjective,
    platform: 'Facebook' as SocialPlatform,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    budget: 2500,
    spendingLimit: 150,
    audienceId: ''
  });

  const [newAd, setNewAd] = useState({
    campaignId: '',
    title: '',
    bodyText: '',
    mediaUrl: '',
    mediaType: 'image' as 'image' | 'video' | 'carousel',
    cta: 'Learn More'
  });

  const [newAudience, setNewAudience] = useState({
    name: '',
    minAge: 18,
    maxAge: 65,
    gender: 'All' as 'All' | 'Male' | 'Female' | 'Other',
    locations: 'United States, Canada',
    interests: 'Marketing, Social Media, Retail',
    demographics: 'Professionals, Business Owners'
  });

  const [reviewAd, setReviewAd] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // AI assistant integration bindings
  const [isGeneratingAd, setIsGeneratingAd] = useState(false);
  const [aiProductDesc, setAiProductDesc] = useState('');
  const [aiTone, setAiTone] = useState('Professional and engaging');
  const [aiKeywords, setAiKeywords] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  const [isGeneratingAudience, setIsGeneratingAudience] = useState(false);
  const [aiAudienceConcept, setAiAudienceConcept] = useState('');
  const [aiAudienceContext, setAiAudienceContext] = useState('');

  const [loading, setLoading] = useState(false);

  // Auto-restore token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('ads_auth_token');
    if (savedToken) {
      setAuthToken(savedToken);
      fetchUserProfile(savedToken);
    }
  }, []);

  // Fetch full data suite when authenticated
  useEffect(() => {
    if (authToken) {
      fetchData();
      const interval = setInterval(fetchData, 15000); // Poll metrics & state changes every 15s
      return () => clearInterval(interval);
    }
  }, [authToken, activeTab]);

  useEffect(() => {
    if (audiences.length > 0 && !newCampaign.audienceId) {
      setNewCampaign(prev => ({ ...prev, audienceId: audiences[0].id }));
    }
  }, [audiences, newCampaign.audienceId]);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const fetchData = async () => {
    if (!authToken) return;
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      
      const [campRes, adsRes, audRes, analyticsRes] = await Promise.all([
        fetch('/api/campaigns', { headers }),
        fetch('/api/ads', { headers }),
        fetch('/api/audiences', { headers }),
        fetch('/api/analytics', { headers })
      ]);

      if (campRes.ok) {
        const d = await campRes.json();
        setCampaigns(d.campaigns);
        // auto-fill first available audience in form
        if (d.campaigns.length > 0 && !newAd.campaignId) {
          setNewAd(prev => ({ ...prev, campaignId: d.campaigns[0].id }));
        }
      }
      if (adsRes.ok) {
        const d = await adsRes.json();
        setAds(d.ads);
      }
      if (audRes.ok) {
        const d = await audRes.json();
        setAudiences(d.audiences);
        if (d.audiences.length > 0 && !newCampaign.audienceId) {
          setNewCampaign(prev => ({ ...prev, audienceId: d.audiences[0].id }));
        }
      }
      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setMetrics(d);
      }

      // If user is Admin, fetch system panels
      if (currentUser?.role === 'Admin') {
        const [pendingRes, usersRes, actRes] = await Promise.all([
          fetch('/api/admin/pending-ads', { headers }),
          fetch('/api/admin/users', { headers }),
          fetch('/api/admin/activities', { headers })
        ]);
        if (pendingRes.ok) {
          const d = await pendingRes.json();
          setPendingAds(d.ads);
        }
        if (usersRes.ok) {
          const d = await usersRes.json();
          setSystemUsers(d.users);
        }
        if (actRes.ok) {
          const d = await actRes.json();
          setActivities(d.activities);
        }
      }
    } catch (err) {
      console.error("Failed to load application data state", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('ads_auth_token', data.token);
        setAuthToken(data.token);
        setCurrentUser(data.user);
        triggerToast(`Welcome back, ${data.user.name}!`, 'success');
        setActiveTab('dashboard');
      } else {
        setAuthError(data.error || 'Authentication credentials unsuccessful.');
      }
    } catch {
      setAuthError('Connection server unreachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword, role: authRole })
      });
      const data = await res.json();
      if (res.status === 251 || res.status === 201) {
        triggerToast('Registration complete! Please log in to your new key dashboard.', 'success');
        setIsRegistering(false);
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Unable to complete registry.');
      }
    } catch {
      setAuthError('Registration request failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ads_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
    triggerToast('Logged out of system dashboard session safely.', 'info');
  };

  // ACTIONS: Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.audienceId) {
      triggerToast('Please select a target audience before creating a campaign.', 'error');
      return;
    }
    if (!newCampaign.platform) {
      triggerToast('Please select a platform for your campaign.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify(newCampaign)
      });
      if (res.ok) {
        triggerToast('Campaign scheduled successfully.', 'success');
        setShowCampaignModal(false);
        setNewCampaign({
          name: '',
          objective: 'Sales',
          platform: 'Facebook',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          budget: 2500,
          spendingLimit: 150,
          audienceId: audiences[0]?.id || ''
        });
        fetchData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to create campaign.', 'error');
      }
    } catch {
      triggerToast('Server transmission failed.', 'error');
    }
  };

  // ACTIONS: Delete Campaign
  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to delete this campaign? All matching analytics updates and published ad media variants will be shredded permanently.')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        triggerToast('Campaign deleted.', 'info');
        fetchData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Access denied.', 'error');
      }
    } catch {
      triggerToast('Request offline.', 'error');
    }
  };

  // ACTIONS: Toggle Campaign Status
  const handleToggleCampaignStatus = async (camp: Campaign) => {
    const nextStatus = camp.status === 'paused' ? 'active' : 'paused';
    try {
      const res = await fetch(`/api/campaigns/${camp.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify({ ...camp, status: nextStatus })
      });
      if (res.ok) {
        triggerToast(`Campaign status updated to ${nextStatus}`, 'success');
        fetchData();
      }
    } catch {
      triggerToast('Operation error.', 'error');
    }
  };

  // ACTIONS: Create Ad
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify(newAd)
      });
      if (res.ok) {
        const msg = currentUser?.role === 'Admin' ? 'Ad active instantly.' : 'Ad submitted to queue for admin verification.';
        triggerToast(msg, 'success');
        setShowAdModal(false);
        setNewAd({
          campaignId: campaigns[0]?.id || '',
          title: '',
          bodyText: '',
          mediaUrl: '',
          mediaType: 'image',
          cta: 'Learn More'
        });
        setAiSuggestions([]);
        fetchData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failure outputting ad record.', 'error');
      }
    } catch {
      triggerToast('Ad creative database disconnected.', 'error');
    }
  };

  // ACTIONS: Delete Ad
  const handleDeleteAd = async (id: string) => {
    if (!confirm('Shred this social advertisement blueprint?')) return;
    try {
      const res = await fetch(`/api/ads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        triggerToast('Ad copy shredded.', 'info');
        fetchData();
      }
    } catch {
      triggerToast('Request failed.', 'error');
    }
  };

  // ACTIONS: Save Audience
  const handleCreateAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedAudience = {
        ...newAudience,
        locations: typeof newAudience.locations === 'string' ? newAudience.locations.split(',').map((s: string) => s.trim()) : newAudience.locations,
        interests: typeof newAudience.interests === 'string' ? newAudience.interests.split(',').map((s: string) => s.trim()) : newAudience.interests,
        demographics: typeof newAudience.demographics === 'string' ? newAudience.demographics.split(',').map((s: string) => s.trim()) : newAudience.demographics,
      };

      const res = await fetch('/api/audiences', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify(parsedAudience)
      });
      if (res.ok) {
        triggerToast('Audience segment optimized and saved.', 'success');
        setShowAudienceModal(false);
        setNewAudience({
          name: '',
          minAge: 18,
          maxAge: 65,
          gender: 'All',
          locations: 'United States, United Canada',
          interests: 'Marketing, Ecommerce',
          demographics: 'Middle Income Class'
        });
        fetchData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed saving specifications.', 'error');
      }
    } catch {
      triggerToast('Internal saving error.', 'error');
    }
  };

  // ACTIONS: Delete Saved Audience
  const handleDeleteAudience = async (id: string) => {
    if (!confirm('Remove saved demographic layout subset?')) return;
    try {
      const res = await fetch(`/api/audiences/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        triggerToast('Saved cohort deleted.', 'info');
        fetchData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Access restrictive error.', 'error');
      }
    } catch {
      triggerToast('Operation unsuccessful.', 'error');
    }
  };

  // ACTIONS: AI copywriting assistant via backend proxy
  const handleAiCopywriter = async () => {
    if (!aiProductDesc) {
      triggerToast('Please write a brief description of the product or service first.', 'info');
      return;
    }
    setIsGeneratingAd(true);
    setAiSuggestions([]);
    try {
      const campaignName = campaigns.find(c => c.id === newAd.campaignId)?.name || 'New Launch Campaign';
      const objective = campaigns.find(c => c.id === newAd.campaignId)?.objective || 'Traffic';
      
      const res = await fetch('/api/gemini/generate-ad', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignName,
          objective,
          productDescription: aiProductDesc,
          primaryKeywords: aiKeywords,
          toneStyle: aiTone
        })
      });
      if (res.ok) {
        const result = await res.json();
        setAiSuggestions(result.suggestions || []);
        if (result.warning) {
          triggerToast(result.warning, 'info');
        } else {
          triggerToast('3 creative social formats customized with Gemini!', 'success');
        }
      } else {
        triggerToast('Failed querying AI service.', 'error');
      }
    } catch (err) {
      triggerToast('AI integration service offline.', 'error');
    } finally {
      setIsGeneratingAd(false);
    }
  };

  // ACTIONS: AI audience recommender via proxy
  const handleAiAudienceSuggest = async () => {
    if (!aiAudienceConcept) {
      triggerToast('Please type a descriptive hook (e.g. "Yoga lovers near Seattle")', 'info');
      return;
    }
    setIsGeneratingAudience(true);
    try {
      const res = await fetch('/api/gemini/suggest-audience', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          audienceSegmentName: aiAudienceConcept,
          sectorDetails: aiAudienceContext
        })
      });
      if (res.ok) {
        const data = await res.json();
        const aud = data.recommendedAudience;
        setNewAudience({
          name: aud.name || aiAudienceConcept,
          minAge: aud.minAge || 20,
          maxAge: aud.maxAge || 50,
          gender: aud.gender || 'All',
          locations: aud.locations?.join(', ') || 'Global',
          interests: aud.interests?.join(', ') || 'Interests list',
          demographics: aud.demographicsRefined?.join(', ') || 'Aesthetic audience'
        });
        triggerToast('Demographics matched! Rationale: ' + (data.strategicAudienceRationale || 'Fitted with target cohort.'), 'success');
      }
    } catch {
      triggerToast('AI assistance error.', 'error');
    } finally {
      setIsGeneratingAudience(false);
    }
  };

  // ACTIONS: Admin Review Decision
  const handleAdVerification = async (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !rejectionReason) {
      triggerToast('Please state a correction feedback reason for the rejection decision.', 'info');
      return;
    }
    try {
      const res = await fetch('/api/admin/verify-ad', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          adId: reviewAd.id,
          decision,
          rejectionReason: decision === 'reject' ? rejectionReason : undefined
        })
      });
      if (res.ok) {
        triggerToast(`Ad review complete. Action: ${decision.toUpperCase()}`, 'success');
        setShowReviewModal(false);
        setReviewAd(null);
        setRejectionReason('');
        fetchData();
      }
    } catch {
      triggerToast('Decision logging failed.', 'error');
    }
  };

  // ACTIONS: Admin user role toggle
  const handleToggleUserRole = async (targetUserId: string, currentRole: string) => {
    const nextRole = currentRole === 'Admin' ? 'Advertiser' : 'Admin';
    if (!confirm(`Are you sure you want to change user role to ${nextRole}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ role: nextRole })
      });
      if (res.ok) {
        triggerToast('User roles saved.', 'success');
        fetchData();
      }
    } catch {
      triggerToast('Action failed.', 'error');
    }
  };

  // Filter lists based on search bar and objective selector dropdowns
  const filteredCampaigns = campaigns.filter(c => {
    const term = searchQuery.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(term) || c.objective.toLowerCase().includes(term);
    
    if (globalFilter === 'all') return nameMatch;
    return nameMatch && c.status === globalFilter;
  });

  const filteredAds = ads.filter(a => {
    const term = searchQuery.toLowerCase();
    const adMatch = a.title.toLowerCase().includes(term) || a.bodyText.toLowerCase().includes(term) || a.cta.toLowerCase().includes(term);
    
    if (globalFilter === 'all') return adMatch;
    return adMatch && a.status === globalFilter;
  });

  // Render SVG interactive charts safely
  const renderInteractiveChart = () => {
    const data = metrics.chartData || [];
    if (data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-xs">Awaiting primary analytic timeline points to assemble visual index...</p>
        </div>
      );
    }

    const maxSpend = Math.max(...data.map((d: any) => d.spend), 100);
    const maxClicks = Math.max(...data.map((d: any) => d.clicks), 10);
    
    const width = 800;
    const height = 240;
    const padding = 40;
    
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = data.map((d: any, index: number) => {
      const x = padding + (index / (data.length - 1)) * chartW;
      const ySpend = height - padding - (d.spend / maxSpend) * chartH;
      const yClicks = height - padding - (d.clicks / maxClicks) * chartH;
      return { x, ySpend, yClicks, date: d.date, spend: d.spend, clicks: d.clicks };
    });

    const spendLinePath = points.map((p: any, i: number) => {
      return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.ySpend}`;
    }).join(' ');

    const clicksLinePath = points.map((p: any, i: number) => {
      return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yClicks}`;
    }).join(' ');

    return (
      <div className="bg-white p-4 border rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Campaign High Fidelity Performance Trends</h4>
            <p className="text-sm font-semibold text-gray-800">Operational Daily Cost (Indian Rupees) vs Interaction Count (Clicks)</p>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-[#2563EB]">
              <span className="w-3 h-3 bg-blue-600 rounded-full inline-block"></span> Daily Spend
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[#10B981]">
              <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block"></span> Daily Clicks
            </span>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          <svg className="w-full h-64" viewBox={`0 0 ${width} ${height}`}>
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding + ratio * chartH;
              return (
                <g key={`grid-${idx}`}>
                  <line 
                    x1={padding} 
                    y1={y} 
                    x2={width - padding} 
                    y2={y} 
                    stroke="#E5E7EB" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x={padding - 10} 
                    y={y + 4} 
                    className="text-[9px] fill-gray-400 font-mono" 
                    textAnchor="end"
                  >
                    ₹{Math.round((1 - ratio) * maxSpend)}
                  </text>
                </g>
              );
            })}

            {/* Timestamps X-Axis key frames */}
            {points.map((p: any, idx: number) => {
              if (idx % 5 === 0 || idx === points.length - 1) {
                const parts = p.date.split('-');
                const label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : p.date;
                return (
                  <text 
                    key={`label-${idx}`} 
                    x={p.x} 
                    y={height - padding + 15} 
                    className="text-[9px] fill-gray-400 font-mono" 
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                );
              }
              return null;
            })}

            {/* Line Plots */}
            <path 
              d={spendLinePath} 
              fill="none" 
              stroke="#2563EB" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d={clicksLinePath} 
              fill="none" 
              stroke="#10B981" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="1 1"
            />

            {/* Data point indicators */}
            {points.map((p: any, idx: number) => {
              // limit visual circle rendering for cleaner layout
              if (idx % 3 === 0 || idx === points.length - 1) {
                return (
                  <g key={`dot-${idx}`} className="group cursor-pointer">
                    <circle 
                      cx={p.x} 
                      cy={p.ySpend} 
                      r="4" 
                      fill="#2563EB" 
                      stroke="#FFFFFF" 
                      strokeWidth="1.5" 
                    />
                    <circle 
                      cx={p.x} 
                      cy={p.yClicks} 
                      r="3.5" 
                      fill="#10B981" 
                      stroke="#FFFFFF" 
                      strokeWidth="1.2" 
                    />
                  </g>
                );
              }
              return null;
            })}
          </svg>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mt-2 border-t pt-3 text-center text-xs">
          <div>
            <span className="text-gray-400 uppercase text-[10px]">Peak Spending Day</span>
            <p className="font-bold text-gray-800">₹{maxSpend.toFixed(2)} INR</p>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px]">Max Peak Activity</span>
            <p className="font-bold text-gray-800">{maxClicks} Hits/Day</p>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px]">Chronological Span</span>
            <p className="font-bold text-gray-800">30 Interlocking Days</p>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px]">Aggregates Status</span>
            <p className="font-bold text-green-600 block">✓ Synchronized Live</p>
          </div>
        </div>
      </div>
    );
  };

  // Login View Wrapper
  if (!authToken) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg ring-4 ring-blue-100">
              S
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-gray-900">
            Social Ads Management System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Secure Full-stack Enterprise Campaign Control Room.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 border border-gray-100 rounded-2xl shadow-xl sm:px-10">
            
            {/* Quick credentials helper alerts */}
            <div className="mb-6 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800">
              <p className="font-semibold mb-1">🔑 Quick Access Developer Credentials:</p>
              <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono">
                <div>
                  <span className="font-sans block text-[10px] text-gray-500 font-bold uppercase">Advertiser Profile</span>
                  <span>advertiser@example.com</span><br/>
                  <span className="text-gray-600">password: </span><strong>ads123</strong>
                </div>
                <div>
                  <span className="font-sans block text-[10px] text-gray-500 font-bold uppercase">Administrator Profile</span>
                  <span>admin@example.com</span><br/>
                  <span className="text-gray-600">password: </span><strong>admin123</strong>
                </div>
              </div>
            </div>

            {authError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={isRegistering ? handleRegister : handleLogin}>
              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Your Full Name</label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Sarah Connor"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide font-medium">Corporate Email Address</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide font-medium">Portal Security Password</label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide font-medium">Platform Account Role</label>
                  <select
                    id="reg-role"
                    value={authRole}
                    onChange={(e: any) => setAuthRole(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Advertiser">Advertiser (Create Campaigns & Creative Ads)</option>
                    <option value="Admin">Administrator (Approve Ads & Audit Logs)</option>
                  </select>
                </div>
              )}

              <button
                id="sumbit-auth-btn"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : isRegistering ? 'Register Advertiser' : 'Sign In to Dashboard'}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between text-xs text-gray-500">
              <button 
                id="toggle-register-view"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError(null);
                }} 
                className="text-blue-600 font-bold hover:underline"
              >
                {isRegistering ? 'Already have an account? Sign In' : 'Create new corporate account'}
              </button>
              <span className="text-gray-400 font-mono">Active Database: JSON-DB</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F3F4F6] text-[#111827] overflow-hidden font-sans">
      
      {/* Toast Notice alerts */}
      {notification && (
        <div id="alert-notification" className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border transition-all duration-300 transform translate-x-0 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
          {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
          <div className="text-xs font-semibold">{notification.message}</div>
        </div>
      )}

      {/* --- Sidebar (High Density Theme Specs) --- */}
      <aside className="w-60 bg-[#1F2937] text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shadow-md">
            S
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block">SocialAds Pro</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold block">{currentUser?.role} Mode</span>
          </div>
        </div>
        
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-4 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Main Panel</div>
          
          <button 
            id="nav-dashboard"
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard Overview</span>
          </button>

          <button 
            id="nav-campaigns"
            onClick={() => setActiveTab('campaigns')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'campaigns' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Target className="w-4 h-4" />
            <span>Campaigns</span>
            <span className="ml-auto bg-gray-700 text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
              {campaigns.length}
            </span>
          </button>

          <button 
            id="nav-ads"
            onClick={() => setActiveTab('ads')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'ads' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Ad Media Creative</span>
            <span className="ml-auto bg-gray-700 text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
              {ads.length}
            </span>
          </button>

          <button 
            id="nav-audiences"
            onClick={() => setActiveTab('audiences')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'audiences' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Users className="w-4 h-4" />
            <span>Saved Audiences</span>
          </button>

          <div className="px-4 mt-6 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Systems</div>
          
          <button 
            id="nav-analytics"
            onClick={() => setActiveTab('analytics')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'analytics' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Performance Charts</span>
          </button>

          {currentUser?.role === 'Admin' && (
            <button 
              id="nav-admin"
              onClick={() => setActiveTab('admin')} 
              className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'admin' ? 'bg-[#9333EA] text-white border-l-4 border-white' : 'text-purple-300 hover:bg-gray-800 hover:text-purple-100'}`}
            >
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>Admin Module</span>
              {pendingAds.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.1 animate-bounce rounded-full font-bold">
                  {pendingAds.length} Review
                </span>
              )}
            </button>
          )}

          <button 
            id="nav-docs"
            onClick={() => setActiveTab('docs')} 
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-left transition-colors cursor-pointer ${activeTab === 'docs' ? 'bg-blue-600 text-white border-l-4 border-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Specifications Guide</span>
          </button>
        </nav>

        {/* User Account Tray (High Density Specs) */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-inner uppercase">
              {currentUser?.name.substring(0, 2) || 'US'}
            </div>
            <div className="text-xs overflow-hidden">
              <p className="font-bold text-gray-100 truncate">{currentUser?.name || 'Authorized User'}</p>
              <p className="text-[10px] text-gray-400 truncate">{currentUser?.email || 'user@agency.com'}</p>
            </div>
          </div>
          <button 
            id="btn-logout"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-gray-700 rounded-lg text-[10px] text-gray-300 hover:bg-red-900/40 hover:text-red-200 transition-colors cursor-pointer tracking-wider uppercase font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out Session
          </button>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-lg capitalize tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard Center'}
              {activeTab === 'campaigns' && 'Social Ad Campaigns'}
              {activeTab === 'ads' && 'Ad Creative Gallery'}
              {activeTab === 'audiences' && 'Targeting Cohorts'}
              {activeTab === 'analytics' && 'Growth Analytics'}
              {activeTab === 'admin' && 'System Admin Controls'}
              {activeTab === 'docs' && 'Technical Reference & System Spec'}
            </h1>
            <div className="flex gap-1.5">
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] rounded font-mono font-bold uppercase tracking-wider">LIVE DATA</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-mono font-bold uppercase tracking-wider">CY-2026</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Context search box */}
            <div className="relative">
              <input 
                id="header-search-input"
                type="text" 
                placeholder="Search resources..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-100 border-none text-xs rounded-lg pl-8 pr-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" 
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            </div>

            {/* Quick action triggers */}
            {activeTab === 'campaigns' && (
              <button 
                id="header-create-camp-btn"
                onClick={() => setShowCampaignModal(true)}
                className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            )}

            {activeTab === 'ads' && (
              <button 
                id="header-create-ad-btn"
                onClick={() => setShowAdModal(true)}
                className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Ad Draft
              </button>
            )}

            {activeTab === 'audiences' && (
              <button 
                id="header-create-aud-btn"
                onClick={() => setShowAudienceModal(true)}
                className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Save Audience
              </button>
            )}

            <button 
              id="header-refresh-btn"
              onClick={() => {
                fetchData();
                triggerToast('Manually refreshed active system data streams.', 'info');
              }}
              className="p-2 border rounded-lg text-gray-600 hover:bg-gray-50 bg-white shadow-xs cursor-pointer transition-colors"
              title="Refresh Data Streams"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Scroll container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* -------------------- TAB: DASHBOARD OVERVIEW -------------------- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Quick statistics layout cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-xs">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Total Ad Spending</p>
                  <p className="text-2xl font-black mt-1 text-gray-900">₹{metrics.totals.spend.toLocaleString()}</p>
                  <p className="text-green-600 text-[10px] font-bold mt-2 flex items-center gap-1">
                    <span>↑ 14.8% vs target limit</span>
                  </p>
                </div>

                <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-xs">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Accumulated Impressions</p>
                  <p className="text-2xl font-black mt-1 text-gray-900">{metrics.totals.impressions.toLocaleString()}</p>
                  <p className="text-blue-600 text-[10px] font-bold mt-2 font-mono">
                    Reach: {metrics.totals.reach.toLocaleString()} Unique
                  </p>
                </div>

                <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-xs">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Performance Average CTR</p>
                  <p className="text-2xl font-black mt-1 text-gray-900">{metrics.totals.ctr}%</p>
                  <div className="w-full bg-gray-100 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(metrics.totals.ctr * 15, 100)}%` }}></div>
                  </div>
                </div>

                <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-xs">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Average Cost Per Click (CPC)</p>
                  <p className="text-2xl font-black mt-1 text-gray-900">₹{metrics.totals.cpc}</p>
                  <p className="text-orange-600 text-[10px] font-bold mt-2">
                    CPA Conv: ₹{metrics.totals.cpa} Avg
                  </p>
                </div>
              </div>

              {/* Layout Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Campaigns List (Left Col) */}
                <section className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <h2 className="text-xs font-black uppercase tracking-wider text-gray-700">Quick Active Campaigns Monitor</h2>
                    </div>
                    <div className="flex gap-2">
                      <select 
                        id="global-campaign-filter"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="p-1 px-2 border rounded bg-white text-[11px] text-gray-600"
                      >
                        <option value="all">Status: All</option>
                        <option value="active">ActiveOnly</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button 
                        id="export-csv-btn"
                        onClick={() => {
                          let headers = "Campaign Name,Objective,Status,Budget,Start Date,End Date\n";
                          let rows = campaigns.map(c => `"${c.name}","${c.objective}","${c.status}",${c.budget},"${c.startDate}","${c.endDate}"`).join("\n");
                          let blob = new Blob([headers + rows], { type: 'text/csv' });
                          let url = window.URL.createObjectURL(blob);
                          let a = document.createElement('a');
                          a.href = url;
                          a.download = `Campaign_Report_${Date.now()}.csv`;
                          a.click();
                          triggerToast('Downloaded CSV Campaign Data Grid.', 'success');
                        }}
                        className="px-2.5 py-1 border rounded bg-white hover:bg-gray-50 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" /> CSV Export
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F9FAFB] text-gray-500 uppercase font-bold text-[10px] border-b">
                        <tr>
                          <th className="p-3">Campaign Meta</th>
                          <th className="p-3">Objective</th>
                          <th className="p-3">Dates</th>
                          <th className="p-3 text-right">Budget Limit</th>
                          <th className="p-3">System status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-gray-700">
                        {filteredCampaigns.slice(0, 5).map((camp) => (
                          <tr key={camp.id} className="hover:bg-blue-50/50 cursor-pointer">
                            <td className="p-3">
                              <p className="font-bold text-gray-900 text-xs">{camp.name}</p>
                              <span className="text-[10px] text-gray-400 font-mono">ID: {camp.id}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold text-white ${
                                camp.objective === 'Sales' ? 'bg-emerald-600' :
                                camp.objective === 'Awareness' ? 'bg-indigo-600' :
                                camp.objective === 'Leads' ? 'bg-teal-600' : 'bg-blue-600'
                              }`}>{camp.objective}</span>
                            </td>
                            <td className="p-3 text-gray-500 font-mono">
                              {camp.startDate} to {camp.endDate}
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900 font-mono">
                              ₹{camp.budget.toLocaleString()} INR
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                camp.status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' :
                                camp.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                camp.status === 'completed' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                                'bg-red-100 text-red-800'
                              }`}>{camp.status}</span>
                            </td>
                          </tr>
                        ))}
                        {filteredCampaigns.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-400 text-xs">
                              No campaign structures found matching criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Target Audience Mix Ratios (Right Col) */}
                <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">Target Demographic Cohorts</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-semibold text-gray-700">
                          <span>Tech Savvy Professionals</span>
                          <span className="font-bold">42%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-purple-600 h-full rounded-full" style={{ width: '42%' }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1 font-semibold text-gray-700">
                          <span>Active Health & Gym Fitness</span>
                          <span className="font-bold">35%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#10B981] h-full rounded-full" style={{ width: '35%' }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1 font-semibold text-gray-700">
                          <span>Enterprise Decision Makers</span>
                          <span className="font-bold">23%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: '23%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">AI Segment Project Reach</p>
                    <p className="text-3xl font-black tracking-tight text-gray-900 mt-1">4.2M - 5.8M</p>
                    <p className="text-[10px] text-indigo-600 font-bold mt-1">✓ Demographics verified based on live tracking pixels</p>
                  </div>
                </section>
              </div>

              {/* Performance graph */}
              {renderInteractiveChart()}

              {/* System summary diagnostics card */}
              <div className="bg-[#1F2937] text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-800 rounded-xl">
                    <RefreshCw className="w-6 h-6 text-green-400 rotate-12" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#10B981]">Dynamic Metrics Automation Online</h4>
                    <p className="text-xs text-gray-400 mt-1">Simulated performance trackers increment campaign statistics by tracking audience behavior variations every 30 seconds automatically.</p>
                  </div>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-center bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-700">
                    <span className="block text-[9px] text-gray-400 uppercase font-bold tracking-widest">Active Ads</span>
                    <span className="text-lg font-black text-white">{ads.filter(a => a.status === 'active').length} Approved</span>
                  </div>
                  <div className="text-center bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-700">
                    <span className="block text-[9px] text-gray-400 uppercase font-bold tracking-widest">Status Feed</span>
                    <span className="text-lg font-black text-emerald-400 flex items-center justify-center gap-1">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span> 100% OK
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* -------------------- TAB: CAMPAIGNS -------------------- */}
          {activeTab === 'campaigns' && (
            <div className="space-y-6">
              <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-xs flex flex-wrap gap-4 items-center justify-between">
                <div className="text-xs text-gray-500">
                  Showing <strong>{filteredCampaigns.length}</strong> campaigns of {campaigns.length} total.
                </div>
                <div className="flex gap-2">
                  <button 
                    id="trigger-camp-modal"
                    onClick={() => setShowCampaignModal(true)}
                    className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Schedule New Campaign
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCampaigns.map((camp) => {
                  const audience = audiences.find(au => au.id === camp.audienceId);

                  return (
                    <div key={camp.id} className="bg-white border rounded-2xl shadow-xs flex flex-col justify-between overflow-hidden relative group hover:shadow-md transition-all">
                      {/* Accent Topline */}
                      <div className={`h-1.5 ${
                        camp.status === 'active' ? 'bg-green-500' :
                        camp.status === 'scheduled' ? 'bg-yellow-500' :
                        camp.status === 'paused' ? 'bg-amber-400' : 'bg-gray-400'
                      }`} />

                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-mono">{camp.objective} GOAL</span>
                            <h3 className="font-bold text-base text-gray-900 mt-1 line-clamp-1">{camp.name}</h3>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            camp.status === 'active' ? 'bg-green-100 text-green-800' :
                            camp.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            camp.status === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                          }`}>{camp.status}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-xs font-medium text-gray-600">
                          <div>
                            <span className="block text-[9px] text-gray-400 uppercase font-bold">Total Budget</span>
                            <span className="font-bold text-gray-900 font-mono">₹{camp.budget.toLocaleString()} INR</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-gray-400 uppercase font-bold">Daily Spend Cap</span>
                            <span className="font-bold text-gray-900 font-mono">₹{camp.spendingLimit}/day</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-gray-600">
                          <p className="flex items-center gap-1.5">
                            <span className="text-gray-400">📅 Schedule:</span>
                            <span className="font-medium text-gray-800 font-mono">{camp.startDate} to {camp.endDate}</span>
                          </p>
                          <p className="flex items-center gap-1.5 truncate">
                            <span className="text-gray-400">👥 Cohort:</span>
                            <span className="font-bold text-indigo-600">{audience ? audience.name : 'All demographics'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="p-4 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
                        <button 
                          id={`toggle-status-${camp.id}`}
                          onClick={() => handleToggleCampaignStatus(camp)}
                          className="px-3 py-1 bg-white hover:bg-gray-100 border text-gray-700 text-[11px] rounded-md font-bold transition-colors cursor-pointer"
                        >
                          {camp.status === 'paused' ? '✓ Resume Active' : '⏸ Pause'}
                        </button>

                        <button 
                          id={`delete-camp-${camp.id}`}
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredCampaigns.length === 0 && (
                  <div className="col-span-full py-16 bg-white rounded-3xl border border-dashed text-center flex flex-col items-center justify-center p-8">
                    <p className="text-gray-400 text-sm">No campaigns defined or match filter filters.</p>
                    <button 
                      id="empty-camp-add-btn"
                      onClick={() => setShowCampaignModal(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      Create First Campaign
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* -------------------- TAB: AD CREATIVE GALLERY -------------------- */}
          {activeTab === 'ads' && (
            <div className="space-y-6">
              
              {/* Creative top banner info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 border border-gray-100 rounded-lg flex items-center gap-3">
                  <span className="p-2 bg-green-50 text-green-500 rounded-lg font-bold">✓</span>
                  <div className="text-xs">
                    <p className="font-bold">Active Ads</p>
                    <p className="text-gray-500">{ads.filter(a => a.status === 'active').length} creatives publishing traffic</p>
                  </div>
                </div>
                <div className="bg-white p-4 border border-gray-100 rounded-lg flex items-center gap-3">
                  <span className="p-2 bg-yellow-50 text-yellow-500 rounded-lg font-bold">⌛</span>
                  <div className="text-xs">
                    <p className="font-bold">Pending Review Queue</p>
                    <p className="text-gray-500">{ads.filter(a => a.status === 'pending_approval').length} awaiting admin verification</p>
                  </div>
                </div>
                <div className="bg-white p-4 border border-gray-100 rounded-lg flex items-center gap-3">
                  <span className="p-2 bg-red-100 text-red-500 rounded-lg font-bold">✕</span>
                  <div className="text-xs">
                    <p className="font-bold">Needs Correction</p>
                    <p className="text-gray-500">{ads.filter(a => a.status === 'rejected').length} rejected blueprints</p>
                  </div>
                </div>
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAds.map((ad) => (
                  <div key={ad.id} className="bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      {/* Media Header Preview */}
                      <div className="relative h-44 bg-gray-900 overflow-hidden group">
                        <img 
                          src={ad.mediaUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=60'} 
                          alt="Creative Thumbnail" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 right-3 flex gap-1">
                          <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-black/60 text-white font-mono">{ad.mediaType}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black text-white ${
                            ad.status === 'active' ? 'bg-emerald-600' :
                            ad.status === 'pending_approval' ? 'bg-yellow-600 animate-pulse' :
                            ad.status === 'rejected' ? 'bg-red-600' : 'bg-gray-600'
                          }`}>{ad.status.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {/* Info & Copywriter parameters */}
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{ad.campaignName}</p>
                          <h4 className="font-extrabold text-sm text-gray-900 mt-1 line-clamp-1">{ad.title}</h4>
                        </div>

                        <p className="text-xs text-gray-500 italic line-clamp-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                          "{ad.bodyText}"
                        </p>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">CTA Anchor Link</span>
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">{ad.cta}</span>
                        </div>

                        {ad.status === 'rejected' && ad.rejectionReason && (
                          <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-[10px] text-red-800">
                            <span className="font-bold block uppercase tracking-wide text-red-900">Admin Rejection Feedback:</span>
                            <p className="mt-0.5 font-medium">"{ad.rejectionReason}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 border-t border-gray-50 bg-gray-50/50 flex align-center justify-between">
                      <span className="text-[10px] text-gray-400 font-mono">Date: {new Date(ad.createdAt).toLocaleDateString()}</span>
                      
                      <button 
                        id={`delete-ad-${ad.id}`}
                        onClick={() => handleDeleteAd(ad.id)}
                        className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Delete ad draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredAds.length === 0 && (
                  <div className="col-span-full py-16 bg-white border border-dashed rounded-3xl text-center flex flex-col items-center justify-center p-8">
                    <p className="text-gray-400 text-sm">No creative ad media blueprints found matching parameters.</p>
                    <button 
                      id="empty-ad-add-btn"
                      onClick={() => setShowAdModal(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      Design First Ad Copy
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}


          {/* -------------------- TAB: AUDIENCES -------------------- */}
          {activeTab === 'audiences' && (
            <div className="space-y-6">
              <div className="bg-[#EEF2F6] p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-100">
                <div className="flex gap-3 align-start">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl mt-1">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-indigo-900 tracking-tight uppercase">✨ Gemini AI Guided Demographic Segment Planner</h4>
                    <p className="text-xs text-indigo-700 mt-1">Struggled to discover high intent buyers? Simply write down or describe your ideal consumer segment hook, and Gemini will matching targeted age scales, locations, and interests hashtags to configure and save automatically!</p>
                  </div>
                </div>
                <button 
                  id="trigger-audience-modal-btn"
                  onClick={() => setShowAudienceModal(true)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Open Dynamic AI Planner
                </button>
              </div>

              {/* Listed saved segments */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {audiences.map((aud) => (
                  <div key={aud.id} className="bg-white border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-base text-gray-900">{aud.name}</h4>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono rounded font-bold">SAVED</span>
                      </div>

                      <div className="space-y-2.5 text-xs text-gray-700">
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-gray-400 font-semibold">Demographic Age</span>
                          <span className="font-bold text-gray-800">{aud.minAge} to {aud.maxAge} yrs old</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-gray-400 font-semibold">Gender Spread</span>
                          <span className="font-bold text-gray-800">{aud.gender}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold block mb-1">Saved Locations Scope</span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(aud.locations) ? aud.locations.map((loc, idx) => (
                              <span key={idx} className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded font-medium">{loc}</span>
                            )) : <span className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded font-medium">{aud.locations}</span>}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold block mb-1 text-[10px] uppercase">Associated Keywords & Interests</span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(aud.interests) ? aud.interests.map((int, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">#{int}</span>
                            )) : <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">#{aud.interests}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t bg-gray-50 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-mono">ID: {aud.id}</span>
                      <button 
                        id={`delete-audience-${aud.id}`}
                        onClick={() => handleDeleteAudience(aud.id)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Delete Cohort"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* -------------------- TAB: PERFORMANCE ANALYTICS REPORT -------------------- */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {renderInteractiveChart()}

              {/* Analytical campaign metrics overview */}
              <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Detailed Campaign Metrics Matrix</h3>
                  <button 
                    id="print-report-btn"
                    onClick={() => {
                      window.print();
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-4.5 h-4.5" /> Render & Save PDF Report
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F9FAFB] text-gray-500 uppercase font-black text-[9px] border-b">
                      <tr>
                        <th className="p-3">Campaign Reference Name</th>
                        <th className="p-3 text-right">Budget Limit</th>
                        <th className="p-3 text-right">Impressions</th>
                        <th className="p-3 text-right">Traffic Clicks</th>
                        <th className="p-3 text-right">Conversions</th>
                        <th className="p-3 text-right">Spend</th>
                        <th className="p-3 text-right">CTR %</th>
                        <th className="p-3 text-right">CPC Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {metrics.campaignMetrics?.map((met: any) => (
                        <tr key={met.id} className="hover:bg-blue-50/40">
                          <td className="p-3 font-bold text-gray-900 text-xs">
                            {met.name}
                            <span className="block text-[9px] text-[#A1A1AA] font-mono">{met.objective}</span>
                          </td>
                          <td className="p-3 text-right font-mono">₹{met.budget.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{met.impressions.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{met.clicks.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{met.conversions.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold font-mono text-gray-900">₹{met.spend.toLocaleString()}</td>
                          <td className="p-3 text-right text-indigo-600 font-bold font-mono">{met.ctr}%</td>
                          <td className="p-3 text-right text-green-600 font-bold font-mono">₹{met.cpc}</td>
                        </tr>
                      ))}
                      {(!metrics.campaignMetrics || metrics.campaignMetrics.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-400">
                            Awaiting primary metrics data to display. Please create campaigns.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* -------------------- TAB: ADMIN SECURITY MODULE -------------------- */}
          {activeTab === 'admin' && currentUser?.role === 'Admin' && (
            <div className="space-y-6">
              
              {/* Review pending creations queue */}
              <section className="bg-white border rounded-2xl shadow-sm overflow-hidden border-orange-200">
                <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></span>
                    <h3 className="text-xs font-black uppercase text-orange-900 tracking-wider">Awaiting Verification Review Queue</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-orange-100 text-orange-850 text-[10px] rounded font-bold">{pendingAds.length} Drafts Awaiting</span>
                </div>

                <div className="divide-y">
                  {pendingAds.map((ad) => (
                    <div key={ad.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#FFFDF9]">
                      <div className="flex items-start gap-4">
                        <img 
                          src={ad.mediaUrl} 
                          alt="Ad Submission" 
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-inner flex-shrink-0" 
                        />
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Campaign Association: {ad.campaignName}</p>
                          <h4 className="font-extrabold text-sm text-gray-950 mt-0.5">{ad.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 italic font-medium">"{ad.bodyText}"</p>
                          <div className="mt-2 text-[10px] flex gap-2">
                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">TYPE: {ad.mediaType}</span>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">CTA: {ad.cta}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          id={`approve-ad-${ad.id}`}
                          onClick={() => {
                            setReviewAd(ad);
                            setShowReviewModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                        >
                          Review Submission
                        </button>
                      </div>
                    </div>
                  ))}

                  {pendingAds.length === 0 && (
                    <div className="p-6 text-center text-xs text-green-600 font-bold bg-[#F4FBF7]">
                      ✓ Verification Queue is fully clean. Beautiful work! All advertisement drafts are currently optimized and active.
                    </div>
                  )}
                </div>
              </section>

              {/* Multi-role management */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* User privilege administration */}
                <section className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">User Directory & Status Map</h3>
                    <UserCheck className="w-4 h-4 text-gray-500" />
                  </div>

                  <div className="divide-y divide-gray-100">
                    {systemUsers.map((su) => (
                      <div key={su.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{su.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{su.email}</p>
                          <span className="text-[10px] text-gray-450 block mt-0.5 font-mono">Registered on: {new Date(su.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${su.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {su.role}
                          </span>
                          <button 
                            id={`su-role-toggle-${su.id}`}
                            onClick={() => handleToggleUserRole(su.id, su.role)}
                            className="text-xs border hover:bg-gray-50 px-2 py-1 rounded font-bold cursor-pointer transition-colors"
                          >
                            Toggle Privilege
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Audit tracker trail */}
                <section className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">Live System Audit Activity Log</h3>
                      <span className="p-1 px-1.5 bg-gray-200 text-gray-600 rounded text-[9px] font-mono">SECURE TRACE</span>
                    </div>

                    <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                      {activities.map((act) => (
                        <div key={act.id} className="flex gap-3 text-xs">
                          <span className="font-mono text-gray-400 text-[9px] mt-0.5 shrink-0">
                            {new Date(act.timestamp).toLocaleTimeString()}
                          </span>
                          <div>
                            <p className="text-gray-900 leading-tight">
                              <strong>{act.userName}</strong> ({act.action})
                            </p>
                            <p className="text-gray-500 font-light text-[11px] mt-0.5">{act.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono">
                    System Security Version: API-HASH-AES-256-GCM
                  </div>
                </section>

              </div>

            </div>
          )}


          {/* -------------------- TAB: DOCS GUIDE -------------------- */}
          {activeTab === 'docs' && (
            <div className="bg-white p-6 border rounded-2xl shadow-sm max-w-4xl space-y-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Social Ads Pro — Technical Document & Architecture Spec</h3>
                <p className="text-xs text-gray-500 mt-1">Full-stack digital advertising orchestration room blueprint details layout specs below.</p>
              </div>

              <div className="space-y-4 text-xs text-gray-700 leading-relaxed border-t pt-4">
                <section className="space-y-1.5">
                  <h4 className="font-bold text-gray-800 text-sm uppercase">1. System Architecture Overview</h4>
                  <p>Our platform uses a <strong>React JS client framework</strong> on the user front-end aligned with an <strong>Express + Node back-end routing layout</strong>. File synchronization is driven by a stateful local persistent store utility with transactional atomic updates back to a JSON-based database model, ensuring reliable testing under the sandboxed workspace environment without requiring native external MySQL configuration blockers.</p>
                </section>

                <section className="space-y-1.5">
                  <h4 className="font-bold text-gray-800 text-sm uppercase">2. Entity Relationship Framework (Database Model ER map)</h4>
                  <div className="p-4 bg-gray-50 rounded-xl font-mono text-[10px] leading-tight space-y-2.5 text-gray-600 border">
                    <div>
                      <strong className="text-gray-900 uppercase">USERS ENTITY</strong><br/>
                      id [PK] | name (STRING) | email (STRING UNIQUE) | role (Admin / Advertiser) | passwordHash (SHA256)
                    </div>
                    <div>
                      <strong className="text-gray-900 uppercase">CAMPAIGNS ENTITY</strong><br/>
                      id [PK] | name (STRING) | objective (Awareness/Sales etc) | startDate (DATE) | endDate (DATE) | budget (DECIMAL) | status (active/paused/scheduled/completed) | audienceId [FK] | createdBy [FK]
                    </div>
                    <div>
                      <strong className="text-gray-900 uppercase">ADVERTISEMENTS ENTITY</strong><br/>
                      id [PK] | campaignId [FK] | title (STRING) | bodyText (TEXT) | mediaUrl (STRING) | mediaType (image/video/carousel) | cta (STRING) | status (pending_approval/active/rejected) | createdBy [FK]
                    </div>
                    <div>
                      <strong className="text-gray-900 uppercase">AUDIENCES ENTITY</strong><br/>
                      id [PK] | name (STRING) | minAge (INT) | maxAge (INT) | gender (STRING) | locations (ARRAY) | interests (ARRAY) | createdBy [FK]
                    </div>
                  </div>
                </section>

                <section className="space-y-1.5">
                  <h4 className="font-bold text-gray-800 text-sm uppercase">3. Developer Security & Audit Trace</h4>
                  <p>All REST API communication points utilize security header intercepts, verified and authenticated using base bearer token allocations. In addition, administrative operations such as ad-approval changes override system metadata blocks dynamically with continuous automated auditing for transparency.</p>
                </section>
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <footer className="h-8 bg-white border-t px-4 flex items-center justify-between text-[10px] text-gray-400 shrink-0 select-none">
          <div className="flex gap-4">
            <span>Core: Node+Express Fullstack Framework</span>
            <span>Database Mock Emulator: MySQL-8.0.32 Compliant Store</span>
          </div>
          <div>Last background tick refresh: Today at 15:23 UTC</div>
        </footer>
      </main>

      {/* ==================================================================== */}
      {/* -------------------- MODAL: CREATE CAMPAIGN -------------------- */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-base text-gray-900 uppercase tracking-tight">Schedule New Ad Campaign</h3>
              <button 
                id="close-camp-modal"
                onClick={() => setShowCampaignModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-750 uppercase mb-1">Campaign Descriptive Name</label>
                <input 
                  id="camp-name-form"
                  type="text" 
                  required
                  placeholder="e.g. Q4 Black Friday Premium Fashion launch" 
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Campaign Objective</label>
                  <select 
                    id="camp-obj-form"
                    value={newCampaign.objective}
                    onChange={(e: any) => setNewCampaign({ ...newCampaign, objective: e.target.value })}
                    className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                  >
                    <option value="Awareness">Awareness (Maximize Brand Reach)</option>
                    <option value="Traffic">Traffic (Capture Link Audiences)</option>
                    <option value="Engagement">Engagement (Social Community growth)</option>
                    <option value="Leads">Leads (Sign ups & conversions)</option>
                    <option value="Sales">Sales (E-commerce Revenue boost)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Social Media Platform</label>
                  <select 
                    id="camp-platform-form"
                    value={newCampaign.platform}
                    onChange={(e: any) => setNewCampaign({ ...newCampaign, platform: e.target.value })}
                    className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                  >
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Twitter">Twitter</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Pinterest">Pinterest</option>
                    <option value="YouTube">YouTube</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-750 uppercase mb-1">Assign Target Audience Segment</label>
                <select 
                  id="camp-aud-form"
                  value={newCampaign.audienceId}
                  onChange={(e: any) => setNewCampaign({ ...newCampaign, audienceId: e.target.value })}
                  className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                >
                  {audiences.map(au => (
                    <option key={au.id} value={au.id}>{au.name} (Age: {au.minAge}-{au.maxAge})</option>
                  ))}
                  {audiences.length === 0 && (
                    <option value="">No custom audiences configured yet</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Total Allocated Budget</label>
                  <input 
                    id="camp-budget-form"
                    type="number" 
                    required 
                    min="100"
                    value={newCampaign.budget}
                    onChange={(e) => setNewCampaign({ ...newCampaign, budget: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Daily Cap Limit</label>
                  <input 
                    id="camp-limit-form"
                    type="number" 
                    required 
                    min="10"
                    value={newCampaign.spendingLimit}
                    onChange={(e) => setNewCampaign({ ...newCampaign, spendingLimit: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 col-span-2">
                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Activation Date</label>
                  <input 
                    id="camp-start-form"
                    type="date" 
                    required
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">End Expiry Date</label>
                  <input 
                    id="camp-end-form"
                    type="date" 
                    required
                    value={newCampaign.endDate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, endDate: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2.5">
                <button 
                  id="cancel-camp-modal-btn"
                  type="button" 
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  id="submit-camp-btn"
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* -------------------- MODAL: CREATE AD DRAFT (WITH GEMINI ASSIST PANEL) -------------------- */}
      {showAdModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-zoom-in my-8">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-sm text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>Design New Ad Creative Draft</span>
              </h3>
              <button 
                id="close-ad-modal"
                onClick={() => setShowAdModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-100">
              
              {/* Draft creation Form */}
              <form onSubmit={handleCreateAd} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Target Campaign Association</label>
                  <select 
                    id="ad-campaign-form"
                    value={newAd.campaignId}
                    onChange={(e) => setNewAd({ ...newAd, campaignId: e.target.value })}
                    className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                    required
                  >
                    <option value="">-- Associate Campaign --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.objective})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Ad Headline Title</label>
                  <input 
                    id="ad-title-form"
                    type="text" 
                    required
                    placeholder="Short catching message... (e.g. Claim 20% off)" 
                    value={newAd.title}
                    onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Primary Body Copy text</label>
                  <textarea 
                    id="ad-body-form"
                    required
                    rows={3}
                    placeholder="Provide hook painpoints, incentives, and core urgency links." 
                    value={newAd.bodyText}
                    onChange={(e) => setNewAd({ ...newAd, bodyText: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-750 uppercase mb-1">Media Variant Type</label>
                    <select 
                      id="ad-type-form"
                      value={newAd.mediaType}
                      onChange={(e: any) => setNewAd({ ...newAd, mediaType: e.target.value })}
                      className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                    >
                      <option value="image">image banner</option>
                      <option value="video">Promotional Video</option>
                      <option value="carousel">Interactive Carousel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-750 uppercase mb-1">Action Hook (CTA)</label>
                    <select 
                      id="ad-cta-form"
                      value={newAd.cta}
                      onChange={(e) => setNewAd({ ...newAd, cta: e.target.value })}
                      className="w-full p-2.5 bg-white border rounded-lg text-gray-800 font-bold"
                    >
                      <option value="Shop Now">Shop Now</option>
                      <option value="Learn More">Learn More</option>
                      <option value="Sign Up">Sign Up</option>
                      <option value="Download">Download</option>
                      <option value="Join Now">Join Now</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Display Media URL / Vector URL</label>
                  <input 
                    id="ad-media-form"
                    type="url" 
                    placeholder="https://images.unsplash.com/..." 
                    value={newAd.mediaUrl}
                    onChange={(e) => setNewAd({ ...newAd, mediaUrl: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>

                <div className="pt-4 border-t flex justify-end gap-2.5">
                  <button 
                    id="cancel-ad-modal-btn"
                    type="button" 
                    onClick={() => setShowAdModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    id="submit-ad-btn"
                    type="submit" 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                  >
                    Save Draft creative
                  </button>
                </div>
              </form>

              {/* ✨ GEMINI GENERATIVE ASSISTANT PANEL */}
              <div className="p-6 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-black text-xs text-indigo-900 uppercase tracking-tight">AI Copywriting generator</h4>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-4 bg-white p-2.5 rounded-lg border">
                    Describe your product and audience hooks, and get high-converting headings and copy matched with your specified campaign objective using Gemini 3.5.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Product description & Core Pain Points</label>
                      <textarea 
                        id="ai-desc-form"
                        rows={2}
                        placeholder="e.g. Ergonomic vegan memory foam office chair with smart spinal feedback curves..."
                        value={aiProductDesc}
                        onChange={(e) => setAiProductDesc(e.target.value)}
                        className="w-full p-2 bg-white border rounded-lg text-gray-850"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-slate-700 uppercase mb-1 text-[9px]">Tone & Attitude</label>
                        <select 
                          id="ai-tone-form"
                          className="w-full p-1.5 bg-white border rounded text-slate-800"
                          value={aiTone}
                          onChange={(e) => setAiTone(e.target.value)}
                        >
                          <option value="Professional and engaging">Professional</option>
                          <option value="Youthful and playful">Playful / Gen-Z</option>
                          <option value="Bold Growth Hacker">Bold Growth Hacker</option>
                          <option value="Minimalist and Luxurious">Luxury</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 uppercase mb-1 text-[9px]">Keywords to Include</label>
                        <input 
                          id="ai-keywords-form"
                          type="text"
                          placeholder="e.g. Spinal comfort"
                          value={aiKeywords}
                          onChange={(e) => setAiKeywords(e.target.value)}
                          className="w-full p-1.5 bg-white border rounded text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <button 
                      id="generate-ai-copywriter"
                      type="button"
                      onClick={handleAiCopywriter}
                      disabled={isGeneratingAd}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingAd ? (
                        <>🗱 Querying Gemini Copywriter...</>
                      ) : (
                        <>✨ Generate copy with Gemini AI</>
                      )}
                    </button>
                  </div>

                  {/* Creative copy variations listings */}
                  <div className="mt-4 space-y-3 overflow-y-auto max-h-56 pr-1">
                    {aiSuggestions.map((sug, idx) => (
                      <div key={idx} className="p-3 bg-white border border-indigo-100 rounded-xl space-y-2 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black font-mono">VARIATION #{idx + 1}</span>
                          <button 
                            id={`apply-ai-sug-${idx}`}
                            type="button"
                            onClick={() => {
                              setNewAd(prev => ({
                                ...prev,
                                title: sug.headline,
                                bodyText: sug.bodyText,
                                cta: sug.recommendedCTA || 'Learn More'
                              }));
                              triggerToast('Applied copy suggestion to form!', 'success');
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-bold"
                          >
                            Apply this copy
                          </button>
                        </div>
                        <p className="font-bold text-gray-900 text-xs text-indigo-950">"{sug.headline}"</p>
                        <p className="text-[11px] text-gray-500 italic block">"{sug.bodyText}"</p>
                        <div className="text-[10px] text-slate-400 font-sans block">{sug.audienceHooks}</div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* -------------------- MODAL: CREATE / AI AUDIENCE SEGMENT -------------------- */}
      {showAudienceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-zoom-in my-8">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-sm text-indigo-950 uppercase tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Configure Audience Demographics Segment</span>
              </h3>
              <button 
                id="close-aud-modal"
                onClick={() => setShowAudienceModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-100">
              
              {/* Audience edit form */}
              <form onSubmit={handleCreateAudience} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Cohort Segment Name</label>
                  <input 
                    id="aud-name-form"
                    type="text" 
                    required
                    placeholder="e.g. West Coast Millennial Bakers" 
                    value={newAudience.name}
                    onChange={(e) => setNewAudience({ ...newAudience, name: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-750 uppercase mb-1">Target Age Bounds</label>
                    <div className="flex items-center gap-2">
                      <input 
                        id="aud-minage-form"
                        type="number" 
                        min="13" 
                        max="100"
                        value={newAudience.minAge}
                        onChange={(e) => setNewAudience({ ...newAudience, minAge: parseInt(e.target.value) || 18 })}
                        className="w-full p-2 border rounded-lg text-gray-800 text-center font-mono font-bold"
                        placeholder="Min Age"
                      />
                      <span className="text-gray-400">to</span>
                      <input 
                        id="aud-maxage-form"
                        type="number" 
                        min="13" 
                        max="100"
                        value={newAudience.maxAge}
                        onChange={(e) => setNewAudience({ ...newAudience, maxAge: parseInt(e.target.value) || 65 })}
                        className="w-full p-2 border rounded-lg text-gray-800 text-center font-mono font-bold"
                        placeholder="Max Age"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-750 uppercase mb-1">Target Gender Profile</label>
                    <select 
                      id="aud-gender-form"
                      value={newAudience.gender}
                      onChange={(e: any) => setNewAudience({ ...newAudience, gender: e.target.value })}
                      className="w-full p-2.5 bg-white border rounded-lg text-gray-800"
                    >
                      <option value="All">All Genders</option>
                      <option value="Male">Male-only targeting</option>
                      <option value="Female">Female-only targeting</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Locations Target Scope (Comma split list)</label>
                  <input 
                    id="aud-locations-form"
                    type="text" 
                    required
                    placeholder="e.g. San Francisco, California, Canada" 
                    value={newAudience.locations}
                    onChange={(e) => setNewAudience({ ...newAudience, locations: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Consumer Interests & Tags (Comma split list)</label>
                  <input 
                    id="aud-interests-form"
                    type="text" 
                    required
                    placeholder="e.g. Baking, Organic Cooking, Vegan lifestyle" 
                    value={newAudience.interests}
                    onChange={(e) => setNewAudience({ ...newAudience, interests: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-750 uppercase mb-1">Demographics Refinement filters</label>
                  <input 
                    id="aud-demographics-form"
                    type="text" 
                    placeholder="e.g. College Graduate, Executive Management" 
                    value={newAudience.demographics}
                    onChange={(e) => setNewAudience({ ...newAudience, demographics: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-gray-800"
                  />
                </div>

                <div className="pt-4 border-t flex justify-end gap-2.5">
                  <button 
                    id="cancel-aud-modal-btn"
                    type="button" 
                    onClick={() => setShowAudienceModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    id="submit-aud-btn"
                    type="submit" 
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                  >
                    Save Targeted Cohort
                  </button>
                </div>
              </form>

              {/* ✨ GEMINI AUDIENCE STRATEGIST GENERATOR */}
              <div className="p-6 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h4 className="font-black text-xs text-purple-950 uppercase tracking-tight">AI Demographic Planner</h4>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-4 bg-white p-2.5 rounded-lg border leading-relaxed">
                    Stuck finding matching media buying settings? Input your concept below (e.g., "Organic coffee buyers in Berlin") and Gemini will suggest granular locations, demographics, and interests matching!
                  </p>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Ideal Customer Concept Angle</label>
                      <input 
                        id="ai-aud-concept-form"
                        type="text"
                        placeholder="e.g. High-income pet lovers who work remotely"
                        value={aiAudienceConcept}
                        onChange={(e) => setAiAudienceConcept(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-gray-850 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Company / Sector Context (Optional)</label>
                      <input 
                        id="ai-aud-context-form"
                        type="text"
                        placeholder="e.g. Premium organic dog food SaaS box"
                        value={aiAudienceContext}
                        onChange={(e) => setAiAudienceContext(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-gray-850"
                      />
                    </div>

                    <button 
                      id="generate-ai-audience"
                      type="button"
                      onClick={handleAiAudienceSuggest}
                      disabled={isGeneratingAudience}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {isGeneratingAudience ? (
                        <>🧠 Assembling Cohorts in Gemini...</>
                      ) : (
                        <>✨ Map Demographics with Gemini AI</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] text-indigo-900 font-sans">
                  💡 <strong>Tip:</strong> Matching audiences with appropriate objectives enables highly optimized reach predictions automatically.
                </div>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* -------------------- MODAL: ADMIN AD REVIEW DECISION PANEL -------------------- */}
      {showReviewModal && reviewAd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 border-orange-150">
              <h3 className="font-extrabold text-base text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                <span>Admin Creative Ad Review</span>
              </h3>
              <button 
                id="close-review-modal"
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewAd(null);
                }} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="border p-4 rounded-xl space-y-3 bg-gray-50">
                <span className="text-[10px] bg-blue-50 text-blue-700 rounded px-2 py-0.5 font-bold font-mono">AD SUBMISSION BLUEPRINT</span>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-950 mt-1">"{reviewAd.title}"</h4>
                  <p className="text-xs text-gray-500 mt-1 italic leading-relaxed">"{reviewAd.bodyText}"</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] border-t pt-2 mt-2 leading-loose text-gray-500">
                  <p><strong>CTA Link:</strong> {reviewAd.cta}</p>
                  <p><strong>Format Type:</strong> {reviewAd.mediaType}</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">State correction feedback (Only required for Redo/Rejections)</label>
                <textarea 
                  id="rejection-reason"
                  rows={2}
                  placeholder="e.g. Violates promotional codes, optimize body hook to keep character boundaries compliant..." 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-gray-800"
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2.5">
                <button 
                  id="btn-reject-ad"
                  type="button" 
                  onClick={() => handleAdVerification('reject')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  ✕ Reject With Feedback
                </button>
                <button 
                  id="btn-approve-ad"
                  type="button" 
                  onClick={() => handleAdVerification('approve')}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  ✓ Approve & Publish Ad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
