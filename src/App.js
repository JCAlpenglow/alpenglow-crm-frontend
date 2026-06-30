import React, { useState, useEffect, useCallback } from 'react';
import ImportModal from './components/ImportModal';
import {
  pipelineDb,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  moveStage,
  requestPromotion,
  approvePromotion,
  getCurrentProfile,
  signIn,
  signOut,
} from './lib/supabase';

const STAGES = [
  { id: 'suspect',    lb: 'Suspect',    c: '#6B7A88' },
  { id: 'prospect',   lb: 'Prospect',   c: '#3A6A96' },
  { id: 'engagement', lb: 'Engagement', c: '#C9A84C' },
  { id: 'invested',   lb: 'Invested',   c: '#5BAA7A' },
];

const SOURCES = [
  'Referral','Conference','Database',
  'LinkedIn','Direct Outreach','Manager Upload','Other',
];

const GH_ICONS = {
  investor: { cls: 'ico-inv', icon: 'ti-user-dollar' },
  manager:  { cls: 'ico-mgr', icon: 'ti-briefcase'   },
  contact:  { cls: 'ico-gen', icon: 'ti-address-book' },
};

const STAGE_CLS = {
  suspect:    'ss-sus',
  prospect:   'ss-pro',
  engagement: 'ss-eng',
  invested:   'ss-inv',
};

const CARDS_PER_PAGE = 15;

const daysSince = (dateStr) => {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
};

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const avatarStyle = (name) => {
  if (!name) return { b: 'rgba(107,122,136,0.28)', c: '#8A9AA8' };
  const p = [
    { b: 'rgba(58,106,150,.28)',  c: '#7EB8E0' },
    { b: 'rgba(196,82,42,.22)',   c: '#E89070' },
    { b: 'rgba(91,170,122,.22)',  c: '#80C8A0' },
    { b: 'rgba(201,168,76,.22)',  c: '#D4B44A' },
    { b: 'rgba(140,100,170,.2)',  c: '#B08ACC' },
  ];
  return p[name.charCodeAt(0) % p.length];
};

const badgeFor = (dateStr) => {
  const d = daysSince(dateStr);
  if (d >= 30) return { cl: 'bod', lb: d + 'd ago' };
  if (d >= 20) return { cl: 'bwn', lb: d + 'd ago' };
  return { cl: 'bok', lb: d + 'd ago' };
};

const highlight = (text, q) => {
  if (!q || !text) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part)
      ? <mark key={i} style={{ background: 'rgba(196,82,42,0.28)', color: 'rgba(232,113,58,0.95)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
};

const S = {
  app: { fontFamily: "'Montserrat', system-ui, sans-serif", color: 'rgba(232,220,200,0.92)', minHeight: '100vh', position: 'relative' },
  scene: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' },
  sky: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 130% 80% at 28% 18%, #1a1018 0%, #0d0f14 42%, #07090c 100%)' },
  glL: { position: 'absolute', top: 0, left: -60, width: 420, height: 360, background: 'radial-gradient(ellipse 55% 52% at 22% 30%, rgba(175,75,28,0.22) 0%, transparent 65%)' },
  glR: { position: 'absolute', top: 0, right: 100, width: 340, height: 300, background: 'radial-gradient(ellipse 55% 55% at 68% 22%, rgba(28,56,115,0.17) 0%, transparent 68%)' },
  fg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to top, #050608 0%, rgba(5,6,8,0.85) 55%, transparent 100%)' },
  content: { position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  hdr: { background: 'rgba(7,9,13,0.88)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 10 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { height: 34, width: 'auto' },
  ptag: { fontSize: 9, letterSpacing: '0.26em', color: 'rgba(170,152,125,0.42)', textTransform: 'uppercase', fontWeight: 300, paddingLeft: 12, borderLeft: '1px solid rgba(196,82,04,0.28)', marginLeft: 2 },
  hRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,182,155,0.62)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnP: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid #C4522A', background: '#C4522A', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnActive: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.1)', color: 'rgba(232,220,200,0.92)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  ibtn: { width: 24, height: 24, borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(170,152,125,0.42)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  stats: { display: 'flex', background: 'rgba(7,9,13,0.78)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' },
  stat: { flex: 1, padding: '9px 12px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' },
  statNum: { fontSize: 20, fontWeight: 500, lineHeight: 1 },
  statLbl: { fontSize: 8, letterSpacing: '0.16em', color: 'rgba(170,152,125,0.42)', textTransform: 'uppercase', marginTop: 3, fontWeight: 300 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: 'rgba(7,9,13,0.65)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', backdropFilter: 'blur(8px)' },
  filterLabel: { fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.38)', marginRight: 2 },
  pill: { fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(170,152,125,0.55)', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 },
  pillActive: { fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid rgba(196,82,42,0.5)', background: 'rgba(196,82,42,0.15)', color: 'rgba(232,113,58,0.9)', fontFamily: "'Montserrat', sans-serif", display: 'inline-flex', alignItems: 'center', gap: 5 },
  pillDivider: { width: 1, height: 14, background: 'rgba(255,255,255,0.08)', margin: '0 4px' },
  board: { display: 'flex', gap: 10, padding: 14, flex: 1, alignItems: 'flex-start', overflowX: 'auto' },
  col: { flex: '0 0 200px', background: 'rgba(10,14,22,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' },
  colHdr: { padding: '10px 12px 9px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  colName: { fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,182,155,0.62)' },
  colCnt: { fontSize: 9, color: 'rgba(170,152,125,0.42)', background: 'rgba(255,255,255,0.06)', borderRadius: 9, padding: '1px 7px' },
  colScroll: { overflowY: 'auto', flex: 1, minHeight: 120, maxHeight: 'calc(100vh - 280px)' },
  colBody: { padding: 8, display: 'flex', flexDirection: 'column', gap: 7 },
  card: { background: 'rgba(14,18,28,0.86)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '10px 11px', cursor: 'grab', userSelect: 'none' },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  av: { width: 28, height: 28, borderRadius: '50%', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName: { fontSize: 12, fontWeight: 500, color: 'rgba(232,220,200,0.92)', lineHeight: 1.25, flex: 1 },
  cardFirm: { fontSize: 10, color: 'rgba(170,152,125,0.42)', marginTop: 1 },
  cardMeta: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 7 },
  metaRow: { fontSize: 10, color: 'rgba(200,182,155,0.62)', display: 'flex', alignItems: 'center', gap: 4 },
  spl: { fontSize: 8, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '2px 5px', borderRadius: 2, border: '1px solid' },
  cardFt: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)' },
  bok: { fontSize: 8, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 2, fontWeight: 500, background: 'rgba(91,170,122,.14)', color: '#6DBF90', border: '1px solid rgba(91,170,122,.22)' },
  bwn: { fontSize: 8, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 2, fontWeight: 500, background: 'rgba(201,168,76,.14)', color: '#D4B44A', border: '1px solid rgba(201,168,76,.25)' },
  bod: { fontSize: 8, letterSpacing: '0.05em', padding: '2px 6px', borderRadius: 2, fontWeight: 500, background: 'rgba(196,82,42,.18)', color: '#E07858', border: '1px solid rgba(196,82,42,.3)' },
  showMore: { margin: '4px 8px 8px', padding: '7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(170,152,125,0.55)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', fontFamily: "'Montserrat', sans-serif", width: 'calc(100% - 16px)' },
  ovl: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'rgba(11,15,24,0.97)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 22 },
  mHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  mTitle: { fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(232,220,200,0.92)' },
  fGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 },
  fFull: { gridColumn: '1 / -1' },
  fGrp: { display: 'flex', flexDirection: 'column', gap: 4 },
  fLbl: { fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)' },
  fInp: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 3, padding: '7px 9px', fontSize: 12, fontFamily: "'Montserrat', sans-serif", color: 'rgba(232,220,200,0.92)', width: '100%' },
  fTa: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 3, padding: '7px 9px', fontSize: 12, fontFamily: "'Montserrat', sans-serif", color: 'rgba(232,220,200,0.92)', width: '100%', minHeight: 68, resize: 'vertical' },
  mFt: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 15, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' },
  sDrop: { position: 'absolute', top: 'calc(100% + 7px)', right: 0, width: 380, background: 'rgba(10,13,21,0.99)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 6, overflow: 'hidden', zIndex: 200, maxHeight: 480, overflowY: 'auto' },
  sSec: { fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)', padding: '9px 13px 5px', borderTop: '0.5px solid rgba(255,255,255,0.06)' },
  sRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 13px', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.04)' },
  sIco: { width: 29, height: 29, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 },
  sFt: { padding: '8px 13px', borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse 130% 80% at 28% 18%, #1a1018 0%, #0d0f14 42%, #07090c 100%)' },
  loginCard: { background: 'rgba(11,15,24,0.97)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, width: 360, padding: 32 },
  toast: (show) => ({ position: 'fixed', bottom: 18, right: 18, background: 'rgba(11,15,24,0.96)', border: '1px solid rgba(196,82,42,0.4)', color: 'rgba(232,220,200,0.92)', padding: '9px 16px', borderRadius: 3, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', zIndex: 200, opacity: show ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none', fontFamily: "'Montserrat', sans-serif" }),
};

// ── LOGO — upload Alpenglow_Capital.png to the /public folder first ──
const LOGO_SVG = '/Alpenglow_Capital.png';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={LOGO_SVG} alt="Alpenglow Capital" style={{ height: 80, marginBottom: 16 }} />
          <div style={{ fontSize: 9, letterSpacing: '0.26em', color: 'rgba(170,152,125,0.42)', textTransform: 'uppercase' }}>Investor Pipeline</div>
        </div>
        {error && (
          <div style={{ background: 'rgba(196,82,42,0.15)', border: '1px solid rgba(196,82,42,0.3)', borderRadius: 3, padding: '8px 12px', fontSize: 11, color: '#E07858', marginBottom: 14 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <div style={S.fLbl}>Email</div>
            <input style={{ ...S.fInp, marginTop: 4 }} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={S.fLbl}>Password</div>
            <input style={{ ...S.fInp, marginTop: 4 }} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" style={{ ...S.btnP, width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [colPages, setColPages] = useState({ suspect: 1, prospect: 1, engagement: 1, invested: 1 });

  useEffect(() => {
    pipelineDb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile();
        loadContacts();
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = pipelineDb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setContacts([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await getCurrentProfile();
      setProfile(p);
    } catch (e) { console.error(e); }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await getContacts();
      setContacts(data || []);
    } catch (e) {
      showToast('Error loading contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => { loadProfile(); loadContacts(); };
  const handleSignOut = async () => { await signOut(); setUser(null); };

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 2400);
  }, []);

  const handleSearch = (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchOpen(false); return; }
    const lq = q.toLowerCase();
    const results = contacts.filter(c =>
      c.full_name?.toLowerCase().includes(lq) ||
      c.firm?.toLowerCase().includes(lq) ||
      c.city?.toLowerCase().includes(lq) ||
      c.email?.toLowerCase().includes(lq)
    ).slice(0, 10);
    setSearchResults(results);
    setSearchOpen(true);
  };

  const handleSearchSelect = (contact) => {
    setSearch(contact.full_name);
    setSearchOpen(false);
    setModal({ type: 'detail', contact });
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    if (!dragId) return;
    const contact = contacts.find(c => c.id === dragId);
    if (!contact || contact.stage === stageId) { setDragId(null); return; }
    if (stageId === 'invested') {
      setModal({ type: 'promote', contact });
      setDragId(null);
      return;
    }
    try {
      await moveStage(contact.id, contact.stage, stageId, user.id);
      setContacts(prev => prev.map(c => c.id === dragId ? { ...c, stage: stageId } : c));
      showToast('Moved to ' + STAGES.find(s => s.id === stageId).lb);
    } catch (e) {
      showToast('Error moving contact');
    }
    setDragId(null);
  };

  const handleSave = async (formData, existingId) => {
    try {
      if (existingId) {
        const updated = await updateContact(existingId, {
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          firm: formData.firm,
          city: formData.city,
          management_co: formData.mgmtCo,
          source: formData.source,
          contact_type: formData.type,
          stage: formData.stage,
          last_contact_date: formData.lastContact,
          notes: formData.notes,
        });
        setContacts(prev => prev.map(c => c.id === existingId ? updated : c));
        showToast('Saved');
      } else {
        const created = await createContact({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          firm: formData.firm,
          city: formData.city,
          management_co: formData.mgmtCo,
          source: formData.source,
          contact_type: formData.type || 'investor',
          stage: formData.stage || 'suspect',
          last_contact_date: formData.lastContact || new Date().toISOString().split('T')[0],
          notes: formData.notes,
        }, user.id);
        setContacts(prev => [created, ...prev]);
        showToast('Contact added');
      }
      setModal(null);
    } catch (e) {
      showToast('Error saving contact');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      showToast('Removed');
    } catch (e) {
      showToast('Error removing contact');
    }
  };

  const handlePromotionRequest = async (contact, details) => {
    try {
      await requestPromotion(contact.id, user.id, details);
      showToast('Promotion request submitted');
      setModal(null);
    } catch (e) {
      showToast('Error submitting request');
    }
  };

  const handlePromotionApprove = async (requestId, contactId) => {
    try {
      await approvePromotion(requestId, contactId, user.id, profile);
      await loadContacts();
      showToast('LP promoted to Investors database');
      setModal(null);
    } catch (e) {
      showToast('Error approving promotion');
    }
  };

  useEffect(() => {
    setColPages({ suspect: 1, prospect: 1, engagement: 1, invested: 1 });
  }, [activeSource, activeType, search]);

  const filtered = useCallback(() => {
    let list = contacts;
    if (search.trim()) {
      const lq = search.toLowerCase();
      list = list.filter(c =>
        c.full_name?.toLowerCase().includes(lq) ||
        c.firm?.toLowerCase().includes(lq) ||
        c.city?.toLowerCase().includes(lq)
      );
    }
    if (activeSource) list = list.filter(c => c.source === activeSource);
    if (activeType) list = list.filter(c => c.contact_type === activeType);
    return list;
  }, [contacts, search, activeSource, activeType]);

  const stats = useCallback(() => {
    const s = { suspect: 0, prospect: 0, engagement: 0, invested: 0, overdue: 0 };
    contacts.forEach(c => {
      if (s[c.stage] !== undefined) s[c.stage]++;
      if (daysSince(c.last_contact_date) >= 30) s.overdue++;
    });
    return s;
  }, [contacts]);

  const showMoreCol = (stageId) => {
    setColPages(prev => ({ ...prev, [stageId]: prev[stageId] + 1 }));
  };

  const clearFilters = () => {
    setActiveSource(null);
    setActiveType(null);
  };

  const hasFilters = activeSource || activeType;

  if (!user) return <Login onLogin={handleLogin} />;

  const st = stats();
  const list = filtered();
  const total = contacts.length || 1;
  const usedSources = [...new Set(contacts.map(c => c.source).filter(Boolean))];

  return (
    <div style={S.app}>
      <div style={S.scene}>
        <div style={S.sky} />
        <div style={S.glL} />
        <div style={S.glR} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          <g fill="white" opacity="0.55">
            {[[120,80],[280,55],[450,95],[600,42],[720,75],[850,30],[980,62],[1100,48],[1250,88],[1380,36],[1500,70],[1650,50],[1790,82]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="0.7"/>)}
          </g>
          <path d="M0,620 L120,520 L220,580 L340,460 L480,540 L580,400 L700,490 L820,350 L960,450 L1080,320 L1220,430 L1340,370 L1460,490 L1580,340 L1700,430 L1820,380 L1920,460 L1920,1080 L0,1080 Z" fill="#0e1520" opacity="0.95"/>
          <path d="M0,680 L100,580 L200,640 L300,530 L420,610 L540,500 L660,570 L760,480 L880,550 L1000,440 L1120,520 L1220,460 L1340,530 L1460,470 L1580,550 L1700,490 L1800,560 L1920,500 L1920,1080 L0,1080 Z" fill="#0b1018" opacity="0.97"/>
          <path d="M0,760 Q200,720 400,750 Q600,780 800,740 Q1000,700 1200,730 Q1400,760 1600,720 Q1750,695 1920,730 L1920,1080 L0,1080 Z" fill="#07090c"/>
        </svg>
        <div style={S.fg} />
      </div>

      <div style={S.content}>
        <div style={S.hdr}>
          <div style={S.brand}>
            <img src={LOGO_SVG} alt="Alpenglow Capital" style={S.logo} />
            <span style={S.ptag}>Investor Pipeline · RE Group</span>
          </div>
          <div style={S.hRight}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 9, fontSize: 13, color: 'rgba(170,152,125,0.42)', pointerEvents: 'none' }} />
                <input
                  style={{ ...S.fInp, paddingLeft: 28, width: 220, borderRadius: 4 }}
                  placeholder="Search investors, managers, firms…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  onFocus={() => search && setSearchOpen(true)}
                />
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div style={S.sDrop}>
                  <div style={S.sSec}>Results</div>
                  {searchResults.map(r => {
                    const ic = GH_ICONS[r.contact_type] || GH_ICONS.contact;
                    const av = avatarStyle(r.full_name);
                    return (
                      <div key={r.id} style={S.sRow}
                        onClick={() => handleSearchSelect(r)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,82,42,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ ...S.sIco, background: av.b, color: av.c }}>
                          <i className={`ti ${ic.icon}`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(232,220,200,0.92)' }}>{highlight(r.full_name, search)}</div>
                          <div style={{ fontSize: 10, color: 'rgba(170,152,125,0.42)' }}>{r.firm}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span style={{ fontSize: 8, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, fontWeight: 500, ...S[STAGE_CLS[r.stage]] }}>{r.stage}</span>
                          <span style={{ fontSize: 9, color: 'rgba(170,152,125,0.38)' }}>{r.city}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={S.sFt}>
                    <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)' }}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 9, color: 'rgba(170,152,125,0.35)' }}>esc to close</span>
                  </div>
                </div>
              )}
            </div>
            <button style={S.btn} onClick={() => setModal({ type: 'capture' })}>
              <i className="ti ti-camera" /> Capture
            </button>
            <button style={S.btn} onClick={() => setModal({ type: 'import' })}>
              <i className="ti ti-upload" /> Import
            </button>
            <button style={S.btnP} onClick={() => setModal({ type: 'add' })}>
              <i className="ti ti-plus" /> Add Contact
            </button>
            <button style={S.ibtn} onClick={handleSignOut} title="Sign out">
              <i className="ti ti-logout" style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        <div style={S.stats}>
          {STAGES.map(stage => (
            <div key={stage.id} style={S.stat}>
              <div style={{ ...S.statNum, color: stage.c }}>{st[stage.id]}</div>
              <div style={S.statLbl}>{stage.lb}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: `${Math.round(st[stage.id] / total * 100)}%`, background: stage.c, opacity: 0.55 }} />
            </div>
          ))}
          <div style={{ ...S.stat, borderRight: 'none' }}>
            <div style={{ ...S.statNum, color: '#E07858' }}>{st.overdue}</div>
            <div style={S.statLbl}>Overdue</div>
          </div>
        </div>

        <div style={S.filterBar}>
          <span style={S.filterLabel}>Filter</span>
          {[
            { key: 'investor', label: 'Investors', icon: 'ti-user-dollar' },
            { key: 'manager',  label: 'Managers',  icon: 'ti-briefcase' },
            { key: 'contact',  label: 'Contacts',  icon: 'ti-address-book' },
          ].map(t => (
            <button key={t.key} style={activeType === t.key ? S.pillActive : S.pill}
              onClick={() => setActiveType(activeType === t.key ? null : t.key)}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 11 }} />
              {t.label}
            </button>
          ))}
          <div style={S.pillDivider} />
          {usedSources.map(src => (
            <button key={src} style={activeSource === src ? S.pillActive : S.pill}
              onClick={() => setActiveSource(activeSource === src ? null : src)}>
              {src}
            </button>
          ))}
          {hasFilters && (
            <>
              <div style={S.pillDivider} />
              <button style={{ ...S.pill, color: 'rgba(196,82,42,0.7)', borderColor: 'rgba(196,82,42,0.3)' }} onClick={clearFilters}>
                <i className="ti ti-x" style={{ fontSize: 10 }} />
                Clear
              </button>
            </>
          )}
          {hasFilters && (
            <span style={{ fontSize: 9, color: 'rgba(170,152,125,0.38)', marginLeft: 4, letterSpacing: '0.08em' }}>
              {list.length} contact{list.length !== 1 ? 's' : ''} shown
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(170,152,125,0.42)', fontSize: 12, letterSpacing: '0.1em' }}>
            Loading pipeline…
          </div>
        ) : (
          <div style={S.board}>
            {STAGES.map(stage => {
              const stageContacts = list.filter(c => c.stage === stage.id);
              const visibleCount = colPages[stage.id] * CARDS_PER_PAGE;
              const visible = stageContacts.slice(0, visibleCount);
              const remaining = stageContacts.length - visibleCount;
              return (
                <div key={stage.id} style={S.col}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, stage.id)}>
                  <div style={{ height: 2, background: stage.c, opacity: 0.8, borderRadius: '6px 6px 0 0', flexShrink: 0 }} />
                  <div style={S.colHdr}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.c, flexShrink: 0 }} />
                      <span style={S.colName}>{stage.lb}</span>
                    </div>
                    <span style={S.colCnt}>{stageContacts.length}</span>
                  </div>
                  <div style={S.colScroll}>
                    <div style={S.colBody}>
                      {stageContacts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '22px 10px', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)', opacity: 0.5 }}>
                          <i className="ti ti-inbox" style={{ fontSize: 18, display: 'block', marginBottom: 5 }} />
                          No contacts
                        </div>
                      )}
                      {visible.map(c => {
                        const b = badgeFor(c.last_contact_date);
                        const av = avatarStyle(c.full_name);
                        const ic = GH_ICONS[c.contact_type] || GH_ICONS.contact;
                        return (
                          <div key={c.id} style={S.card} draggable
                            onDragStart={e => handleDragStart(e, c.id)}
                            onDragEnd={() => setDragId(null)}>
                            <div style={S.cardTop}>
                              <div style={{ ...S.av, background: av.b, color: av.c }}>{initials(c.full_name)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={S.cardName}>{c.full_name}</div>
                                <div style={S.cardFirm}>{c.firm}</div>
                              </div>
                              <i className={`ti ${ic.icon}`} style={{ fontSize: 11, color: av.c, opacity: 0.7 }} />
                            </div>
                            <div style={S.cardMeta}>
                              <div style={S.metaRow}><i className="ti ti-map-pin" style={{ fontSize: 11 }} />{c.city}</div>
                              <div style={S.metaRow}><i className="ti ti-tag" style={{ fontSize: 11 }} />
                                <span style={{ ...S.spl, color: stage.c, borderColor: stage.c + '44', background: stage.c + '12' }}>{c.source}</span>
                              </div>
                            </div>
                            <div style={S.cardFt}>
                              <span style={S[b.cl]}>{b.lb}</span>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button style={S.ibtn} onClick={() => setModal({ type: 'detail', contact: c })}><i className="ti ti-eye" style={{ fontSize: 12 }} /></button>
                                <button style={S.ibtn} onClick={() => setModal({ type: 'edit', contact: c })}><i className="ti ti-edit" style={{ fontSize: 12 }} /></button>
                                <button style={S.ibtn} onClick={() => handleDelete(c.id, c.full_name)}><i className="ti ti-trash" style={{ fontSize: 12 }} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {remaining > 0 && (
                      <button style={S.showMore} onClick={() => showMoreCol(stage.id)}>
                        <i className="ti ti-chevron-down" style={{ fontSize: 11, marginRight: 5 }} />
                        Show {Math.min(remaining, CARDS_PER_PAGE)} more · {remaining} remaining
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal?.type === 'import' && (
        <ImportModal
          onClose={() => setModal(null)}
          onImported={loadContacts}
          userId={user?.id}
          showToast={showToast}
        />
      )}

      {modal?.type === 'capture' && (
        <CaptureModal
          onClose={() => setModal(null)}
          onSaved={(contact) => {
            setContacts(prev => [contact, ...prev]);
            showToast('Contact captured and saved');
          }}
          userId={user?.id}
          showToast={showToast}
        />
      )}

      {modal && modal.type !== 'import' && modal.type !== 'capture' && (
        <ContactModal
          modal={modal}
          profile={profile}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onMoveStage={async (contactId, fromStage, toStage) => {
            if (toStage === 'invested') {
              const contact = contacts.find(c => c.id === contactId);
              setModal({ type: 'promote', contact });
              return;
            }
            await moveStage(contactId, fromStage, toStage, user.id);
            setContacts(prev => prev.map(c => c.id === contactId ? { ...c, stage: toStage } : c));
            setModal(null);
            showToast('Moved to ' + STAGES.find(s => s.id === toStage).lb);
          }}
          onPromotionRequest={handlePromotionRequest}
          onPromotionApprove={handlePromotionApprove}
          showToast={showToast}
        />
      )}

      <div style={S.toast(toast.show)}>{toast.msg}</div>
    </div>
  );
}

// ── CAPTURE MODAL ─────────────────────────────────────────────
function CaptureModal({ onClose, onSaved, userId, showToast }) {
  const [step, setStep] = useState('upload');
  const [preview, setPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1600;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(objectUrl);
      setPreview(dataUrl);
      setStep('confirm');
      extractContact(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showToast('Could not read image — please try again');
    };

    img.src = objectUrl;
  };

  const extractContact = async (dataUrl) => {
    setExtracting(true);
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;

    if (!apiKey) {
      showToast('API key not configured — please fill in manually');
      setExtracted({ full_name: '', email: '', phone: '', firm: '', city: '', management_co: 'Alpenglow Capital' });
      setExtracting(false);
      return;
    }

    try {
      const base64 = dataUrl.split(',')[1];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `You are reviewing a business card or contact sheet.
Extract contact information and return ONLY a valid JSON object with these exact keys (use empty string for any field not found):
{
  "full_name": "person full name",
  "email": "email address",
  "phone": "phone number",
  "firm": "company or firm name",
  "city": "city they are based in",
  "management_co": "Alpenglow Capital",
  "title": "job title or role"
}
Return ONLY the JSON object. No markdown, no explanation, no code fences.`,
              },
            ],
          }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Anthropic error:', JSON.stringify(data));
        throw new Error(data?.error?.message || `Anthropic error ${response.status}`);
      }

      const rawText = (data.content || [])
        .map(b => b.text || '')
        .join('')
        .replace(/```json|```/g, '')
        .trim();

      let parsed = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        console.error('JSON parse failed, raw text:', rawText);
        parsed = { full_name: '', email: '', phone: '', firm: '', city: '', management_co: 'Alpenglow Capital' };
      }

      setExtracted(parsed);
    } catch (e) {
      console.error('Extraction error:', e);
      showToast('Could not extract — please fill in manually');
      setExtracted({ full_name: '', email: '', phone: '', firm: '', city: '', management_co: 'Alpenglow Capital' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted?.full_name) { showToast('Name is required'); return; }
    setSaving(true);
    try {
      const contact = await createContact({
        full_name: extracted.full_name,
        email: extracted.email || '',
        phone: extracted.phone || '',
        firm: extracted.firm || '',
        city: extracted.city || '',
        management_co: extracted.management_co || 'Alpenglow Capital',
        source: 'Conference',
        contact_type: 'investor',
        stage: 'suspect',
        last_contact_date: new Date().toISOString().split('T')[0],
        notes: extracted.title ? `Title: ${extracted.title}` : '',
      }, userId);
      onSaved(contact);
      onClose();
    } catch (e) {
      showToast('Error saving contact');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setExtracted(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.mHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-camera" style={{ fontSize: 16, color: '#C4522A' }} />
            <span style={S.mTitle}>Capture contact</span>
          </div>
          <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {step === 'upload' && (
          <>
            <div
              style={{ border: '1px dashed rgba(196,82,42,0.42)', borderRadius: 5, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 13, background: 'rgba(196,82,42,0.04)' }}
              onClick={() => document.getElementById('captureInput').click()}>
              <i className="ti ti-camera" style={{ fontSize: 32, color: '#C4522A', display: 'block', marginBottom: 10 }} />
              <p style={{ fontSize: 12, color: 'rgba(200,182,155,0.7)', marginBottom: 6 }}>Take a photo or upload from gallery</p>
              <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.38)' }}>Business card · Tear sheet · Any contact info</p>
            </div>
            <input
              type="file"
              id="captureInput"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <div style={S.mFt}>
              <button style={S.btn} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            {preview && (
              <img src={preview} alt="Captured" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 4, marginBottom: 14 }} />
            )}
            {extracting ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(170,152,125,0.6)', fontSize: 11, letterSpacing: '0.1em' }}>
                <i className="ti ti-loader" style={{ fontSize: 22, display: 'block', marginBottom: 8 }} />
                Extracting contact details…
              </div>
            ) : extracted && (
              <>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)', marginBottom: 10 }}>
                  Review and edit extracted details
                </div>
                <div style={S.fGrid}>
                  {[
                    ['full_name', 'Full name'],
                    ['firm', 'Firm'],
                    ['email', 'Email'],
                    ['phone', 'Phone'],
                    ['city', 'City'],
                    ['management_co', 'Management co'],
                  ].map(([key, label]) => (
                    <div key={key} style={S.fGrp}>
                      <label style={S.fLbl}>{label}</label>
                      <input style={S.fInp} value={extracted[key] || ''} onChange={set(key)} />
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={S.mFt}>
              <button style={S.btn} onClick={onClose}>Cancel</button>
              <button
                style={{ ...S.btnP, opacity: (extracting || saving) ? 0.7 : 1 }}
                onClick={handleSave}
                disabled={extracting || saving}>
                {saving ? 'Saving…' : 'Add to pipeline'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── CONTACT MODAL ─────────────────────────────────────────────
function ContactModal({ modal, profile, onClose, onSave, onDelete, onMoveStage, onPromotionRequest, onPromotionApprove, showToast }) {
  const [form, setForm] = useState({
    name: modal.contact?.full_name || '',
    email: modal.contact?.email || '',
    phone: modal.contact?.phone || '',
    firm: modal.contact?.firm || '',
    city: modal.contact?.city || '',
    mgmtCo: modal.contact?.management_co || 'Alpenglow Capital',
    source: modal.contact?.source || 'Referral',
    type: modal.contact?.contact_type || 'investor',
    stage: modal.contact?.stage || 'suspect',
    lastContact: modal.contact?.last_contact_date || new Date().toISOString().split('T')[0],
    notes: modal.contact?.notes || '',
  });
  const [promoDetails, setPromoDetails] = useState({
    share_class: 'A',
    commitment_amount: '',
    accreditation_status: 'accredited_investor',
    notes: '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setP = (k) => (e) => setPromoDetails(p => ({ ...p, [k]: e.target.value }));

  if (modal.type === 'promote') {
    return (
      <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ ...S.modal, borderColor: '#C9A84C55' }}>
          <div style={S.mHdr}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-lock" style={{ fontSize: 16, color: '#C9A84C' }} />
              <span style={{ ...S.mTitle, color: '#C9A84C' }}>Promote to Invested</span>
            </div>
            <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
          </div>
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 4, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'rgba(201,168,76,0.8)', lineHeight: 1.5 }}>
            You are about to promote <strong style={{ color: '#C9A84C' }}>{modal.contact.full_name}</strong> to Invested status. This will write their record to the secure LP Registry database. This action is logged and requires authorization.
          </div>
          <div style={S.fGrid}>
            <div style={S.fGrp}>
              <label style={S.fLbl}>Share class</label>
              <select style={S.fInp} value={promoDetails.share_class} onChange={setP('share_class')}>
                <option value="A">Class A</option>
                <option value="P">Class P</option>
              </select>
            </div>
            <div style={S.fGrp}>
              <label style={S.fLbl}>Commitment amount ($)</label>
              <input style={S.fInp} type="number" placeholder="2500000" value={promoDetails.commitment_amount} onChange={setP('commitment_amount')} />
            </div>
            <div style={{ ...S.fGrp, ...S.fFull }}>
              <label style={S.fLbl}>Accreditation status</label>
              <select style={S.fInp} value={promoDetails.accreditation_status} onChange={setP('accreditation_status')}>
                <option value="accredited_investor">Accredited Investor</option>
                <option value="qualified_purchaser">Qualified Purchaser</option>
                <option value="qualified_client">Qualified Client</option>
              </select>
            </div>
            <div style={{ ...S.fGrp, ...S.fFull }}>
              <label style={S.fLbl}>Notes</label>
              <textarea style={S.fTa} value={promoDetails.notes} onChange={setP('notes')} placeholder="KYC notes, wire details reference, any relevant context…" />
            </div>
          </div>
          <div style={S.mFt}>
            <button style={S.btn} onClick={onClose}>Cancel</button>
            <button style={{ ...S.btnP, background: '#C9A84C', borderColor: '#C9A84C' }}
              onClick={() => onPromotionRequest(modal.contact, promoDetails)}>
              <i className="ti ti-lock" /> Submit for approval
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.type === 'detail') {
    const c = modal.contact;
    const b = badgeFor(c.last_contact_date);
    const av = avatarStyle(c.full_name);
    return (
      <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={S.modal}>
          <div style={S.mHdr}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ ...S.av, background: av.b, color: av.c, width: 28, height: 28, fontSize: 9 }}>{initials(c.full_name)}</div>
              <span style={S.mTitle}>{c.full_name}</span>
            </div>
            <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
          </div>
          {[
            ['ti-building', 'Firm', c.firm],
            ['ti-mail', 'Email', c.email],
            ['ti-phone', 'Phone', c.phone],
            ['ti-map-pin', 'City', c.city],
            ['ti-briefcase', 'Mgmt co', c.management_co],
            ['ti-tag', 'Source', c.source],
          ].map(([icon, label, val]) => val && (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 7, fontSize: 12 }}>
              <i className={`ti ${icon}`} style={{ fontSize: 13, color: 'rgba(170,152,125,0.42)', marginTop: 1 }} />
              <span style={{ color: 'rgba(170,152,125,0.42)', minWidth: 100, fontSize: 11 }}>{label}</span>
              <span style={{ color: 'rgba(200,182,155,0.62)' }}>{val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14, fontSize: 12 }}>
            <i className="ti ti-calendar" style={{ fontSize: 13, color: 'rgba(170,152,125,0.42)', marginTop: 1 }} />
            <span style={{ color: 'rgba(170,152,125,0.42)', minWidth: 100, fontSize: 11 }}>Last contact</span>
            <span style={S[b.cl]}>{c.last_contact_date} · {b.lb}</span>
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)', marginBottom: 8 }}>Pipeline stage</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {STAGES.map(s => (
              <button key={s.id} style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${s.c}55`, background: c.stage === s.id ? s.c + '1A' : 'transparent', color: s.c, fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
                onClick={() => onMoveStage(c.id, c.stage, s.id)}>
                {s.lb}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.42)', marginBottom: 6 }}>Notes</div>
          <textarea style={S.fTa} defaultValue={c.notes} />
          <div style={S.mFt}><button style={S.btn} onClick={onClose}>Close</button></div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.mHdr}>
          <span style={S.mTitle}>{modal.type === 'edit' ? 'Edit Contact' : 'New Contact'}</span>
          <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div style={S.fGrid}>
          {[
            ['name', 'Full name', 'text', 'Jane Smith'],
            ['firm', 'Firm', 'text', 'Smith Capital'],
            ['email', 'Email', 'email', 'jane@firm.com'],
            ['phone', 'Phone', 'text', '(555) 000-0000'],
            ['city', 'City', 'text', 'New York'],
            ['mgmtCo', 'Management co', 'text', 'Alpenglow Capital'],
          ].map(([key, label, type, placeholder]) => (
            <div key={key} style={S.fGrp}>
              <label style={S.fLbl}>{label}</label>
              <input style={S.fInp} type={type} placeholder={placeholder} value={form[key]} onChange={set(key)} />
            </div>
          ))}
          <div style={S.fGrp}>
            <label style={S.fLbl}>Contact type</label>
            <select style={S.fInp} value={form.type} onChange={set('type')}>
              <option value="investor">Investor</option>
              <option value="manager">Manager</option>
              <option value="contact">Contact</option>
            </select>
          </div>
          <div style={S.fGrp}>
            <label style={S.fLbl}>Source</label>
            <select style={S.fInp} value={form.source} onChange={set('source')}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={S.fGrp}>
            <label style={S.fLbl}>Stage</label>
            <select style={S.fInp} value={form.stage} onChange={set('stage')}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.lb}</option>)}
            </select>
          </div>
          <div style={S.fGrp}>
            <label style={S.fLbl}>Last contact</label>
            <input style={S.fInp} type="date" value={form.lastContact} onChange={set('lastContact')} />
          </div>
          <div style={{ ...S.fGrp, ...S.fFull }}>
            <label style={S.fLbl}>Notes</label>
            <textarea style={S.fTa} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div style={S.mFt}>
          <button style={S.btn} onClick={onClose}>Cancel</button>
          <button style={S.btnP} onClick={() => onSave(form, modal.contact?.id)}>
            {modal.type === 'edit' ? 'Save changes' : 'Add contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
