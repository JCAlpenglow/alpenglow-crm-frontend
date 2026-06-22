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
  ptag: { fontSize: 9, letterSpacing: '0.26em', color: 'rgba(170,152,125,0.42)', textTransform: 'uppercase', fontWeight: 300, paddingLeft: 12, borderLeft: '1px solid rgba(196,82,42,0.28)', marginLeft: 2 },
  hRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,182,155,0.62)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnP: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid #C4522A', background: '#C4522A', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 },
  ibtn: { width: 24, height: 24, borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(170,152,125,0.42)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  stats: { display: 'flex', background: 'rgba(7,9,13,0.78)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' },
  stat: { flex: 1, padding: '9px 12px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' },
  statNum: { fontSize: 20, fontWeight: 500, lineHeight: 1 },
  statLbl: { fontSize: 8, letterSpacing: '0.16em', color: 'rgba(170,152,125,0.42)', textTransform: 'uppercase', marginTop: 3, fontWeight: 300 },
  board: { display: 'flex', gap: 10, padding: 14, flex: 1, alignItems: 'flex-start', overflowX: 'auto' },
  col: { flex: '0 0 200px', background: 'rgba(10,14,22,0.75)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', minHeight: 520 },
  colHdr: { padding: '10px 12px 9px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  colName: { fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,182,155,0.62)' },
  colCnt: { fontSize: 9, color: 'rgba(170,152,125,0.42)', background: 'rgba(255,255,255,0.06)', borderRadius: 9, padding: '1px 7px' },
  colBody: { padding: 8, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 },
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

const LOGO_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='100' y1='10' x2='100' y2='90' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0%25' stop-color='%23C4522A'/%3E%3Cstop offset='100%25' stop-color='%231B3A5C'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M100 10 L20 85 L55 85 L75 55 L100 10 L125 55 L145 85 L180 85 Z' fill='url(%23g)'/%3E%3Cpath d='M88 55 L100 10 L112 55 Z' fill='rgba(0,0,0,0.2)'/%3E%3Ctext x='100' y='108' font-family='Montserrat,sans-serif' font-size='18' font-weight='500' letter-spacing='8' fill='%231B3A5C' text-anchor='middle'%3EALPENGLOW%3C/text%3E%3Ctext x='100' y='120' font-family='Montserrat,sans-serif' font-size='10' font-weight='300' letter-spacing='6' fill='%231B3A5C' text-anchor='middle'%3ECAPITAL%3C/text%3E%3C/svg%3E`;

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

  const handleLogin = () => {
    loadProfile();
    loadContacts();
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

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

  const filtered = useCallback(() => {
    if (!search.trim()) return contacts;
    const lq = search.toLowerCase();
    return contacts.filter(c =>
      c.full_name?.toLowerCase().includes(lq) ||
      c.firm?.toLowerCase().includes(lq) ||
      c.city?.toLowerCase().includes(lq)
    );
  }, [contacts, search]);

  const stats = useCallback(() => {
    const s = { suspect: 0, prospect: 0, engagement: 0, invested: 0, overdue: 0 };
    contacts.forEach(c => {
      if (s[c.stage] !== undefined) s[c.stage]++;
      if (daysSince(c.last_contact_date) >= 30) s.overdue++;
    });
    return s;
  }, [contacts]);

  if (!user) return <Login onLogin={handleLogin} />;

  const st = stats();
  const list = filtered();
  const total = contacts.length || 1;

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
                    const b = badgeFor(r.last_contact_date);
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
          <div style={{ ...S.stat,
