import React, { useState, useEffect, useCallback } from 'react';
import ImportModal from './components/ImportModal';
import { LOGO_WHITE, LOGO_COLOR } from './brand';
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
  getContactNotes,
  addContactNote,
  deleteContactNote,
} from './lib/supabase';

// ── Kit + Nurture notification integration ──────────────────────
const KIT_API_KEY = process.env.REACT_APP_KIT_API_KEY;
const KIT_TAG_ID = process.env.REACT_APP_KIT_TAG_ID;
const API_URL = process.env.REACT_APP_API_URL;

async function subscribeToKitNurture(contact) {
  if (!contact?.email) {
    console.warn('No email on contact — skipped Kit subscribe');
    return;
  }
  if (!KIT_API_KEY || !KIT_TAG_ID) {
    console.warn('Kit env vars not configured — skipped Kit subscribe');
    return;
  }
  try {
    // Step 1: Create-or-update the subscriber (Kit requires the subscriber
    // to already exist before it can be tagged).
    const upsertRes = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': KIT_API_KEY,
      },
      body: JSON.stringify({ email_address: contact.email, first_name: contact.full_name }),
    });
    if (!upsertRes.ok) {
      const data = await upsertRes.json().catch(() => ({}));
      console.error('Kit create-subscriber error:', data);
      return;
    }

    // Step 2: Tag the now-existing subscriber.
    const tagRes = await fetch(`https://api.kit.com/v4/tags/${KIT_TAG_ID}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': KIT_API_KEY,
      },
      body: JSON.stringify({ email_address: contact.email }),
    });
    if (!tagRes.ok) {
      const data = await tagRes.json().catch(() => ({}));
      console.error('Kit subscribe error:', data);
    }
  } catch (e) {
    console.error('Kit subscribe error:', e);
  }
}

async function notifyNurtureMove(contact) {
  if (!API_URL) {
    console.warn('REACT_APP_API_URL not configured — skipped notification email');
    return;
  }
  try {
    await fetch(`${API_URL}/api/notify/nurture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact }),
    });
  } catch (e) {
    console.error('Nurture notification error:', e);
  }
}

function handleMoveToNurture(contact) {
  subscribeToKitNurture(contact);
  notifyNurtureMove(contact);
}

// ── Alpenglow Design System ─────────────────────────────────────
// Midnight #05081C (primary), flame #FA4536 (accent: one thing per screen,
// here overdue follow-ups and Invested), white ground, square corners.
const FONT = "'Eina 03', Outfit, 'Helvetica Neue', Arial, sans-serif";
const C = {
  midnight: '#05081C',
  flame: '#FA4536',
  flameDeep: '#CC2C1D',   // flame for small text (5.3:1 on white)
  white: '#FFFFFF',
  surfaceAlt: '#F3F3F5',
  ink: '#05081C',
  inkMuted: '#555B66',
  hairline: '#DCDDE2',
  slate: '#5C6270',
  gray: '#A7ACB5',
  lightGray: '#D9DBE0',
};

// Stage markers use the brand's neutral sequence; flame marks Invested.
const STAGES = [
  { id: 'suspect',    lb: 'Suspect',    c: C.gray },
  { id: 'prospect',   lb: 'Prospect',   c: C.slate },
  { id: 'engagement', lb: 'Engagement', c: C.midnight },
  { id: 'invested',   lb: 'Invested',   c: C.flame },
  { id: 'nurture',    lb: 'Nurture',    c: C.lightGray, edge: C.gray },
];

const SOURCES = [
  'Referral','Conference','Database',
  'LinkedIn','Direct Outreach','Manager Upload','Other',
];

const GH_ICONS = {
  investor: { icon: 'ti-user-dollar',  lb: 'Investor' },
  manager:  { icon: 'ti-briefcase',    lb: 'Manager' },
  contact:  { icon: 'ti-address-book', lb: 'Contact' },
};

const CARDS_PER_PAGE = 15;   // board view
const ROWS_PER_PAGE = 50;    // list view, per stage group
const COLLAPSE_KEY = 'ag-crm-collapsed';
const VIEW_KEY = 'ag-crm-view';
const DEFAULT_COLLAPSED = { nurture: true };

const daysSince = (dateStr) => {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
};

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const avatarStyle = () => ({ b: C.surfaceAlt, c: C.midnight });

const badgeFor = (dateStr) => {
  const d = daysSince(dateStr);
  if (d >= 999) return { cl: 'bod', lb: 'Never' };
  if (d >= 30) return { cl: 'bod', lb: d + 'd ago' };
  if (d >= 20) return { cl: 'bwn', lb: d + 'd ago' };
  return { cl: 'bok', lb: d <= 0 ? 'Today' : d + 'd ago' };
};

const highlight = (text, q) => {
  if (!q || !text) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ background: 'rgba(250,69,54,0.16)', color: C.ink, padding: '0 1px' }}>{part}</mark>
      : part
  );
};

const noteTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const d = daysSince(dateStr);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
};

// Full date + time + relative "since" label, e.g. "Aug 25, 2026, 3:12 PM · today"
const formatNoteTimestamp = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const dateTime = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateTime} · ${noteTimeAgo(dateStr)}`;
};

const readStored = (key, fallback) => {
  try {
    const v = window.localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) { return fallback; }
};
const writeStored = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
};

const HDR_H = 60; // sticky header height, used to stack the stage headers under it

const btnBase = { fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
const pillBase = { fontFamily: FONT, fontSize: 12, padding: '5px 11px', borderRadius: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const badgeBase = { fontSize: 12, padding: '2px 7px', borderRadius: 0, fontWeight: 500, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const eyebrow = { fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.flameDeep };

const S = {
  app: { fontFamily: FONT, color: C.ink, minHeight: '100vh', background: C.surfaceAlt },
  content: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },

  // Header: midnight title band with the white logo
  hdr: { background: C.midnight, minHeight: HDR_H, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 20 },
  brand: { display: 'flex', alignItems: 'center', gap: 14 },
  logo: { height: 26, width: 'auto', display: 'block' },
  ptag: { fontSize: 13, color: 'rgba(255,255,255,0.72)', paddingLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.22)' },
  hRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hSearch: { fontFamily: FONT, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 0, padding: '8px 10px 8px 30px', fontSize: 13, color: C.white, width: 260 },
  hBtn: { ...btnBase, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: C.white },
  hBtnP: { ...btnBase, fontWeight: 600, border: `1px solid ${C.white}`, background: C.white, color: C.midnight },
  hIbtn: { width: 34, height: 34, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  // Buttons on white
  btn: { ...btnBase, border: `1px solid ${C.hairline}`, background: C.white, color: C.ink },
  btnP: { ...btnBase, fontWeight: 600, border: `1px solid ${C.midnight}`, background: C.midnight, color: C.white },
  btnActive: { ...btnBase, border: `1px solid ${C.midnight}`, background: C.midnight, color: C.white },
  ibtn: { width: 28, height: 28, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: C.inkMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  // Stage summary strip
  stats: { display: 'flex', background: C.white, borderBottom: `1px solid ${C.hairline}`, overflowX: 'auto' },
  stat: { flex: '1 0 110px', padding: '12px 14px', textAlign: 'left', position: 'relative', background: C.white, border: 'none', borderRight: `1px solid ${C.hairline}`, cursor: 'pointer', fontFamily: FONT, color: C.ink },
  statNum: { fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: C.ink, fontVariantNumeric: 'tabular-nums' },
  statLbl: { fontSize: 12, color: C.inkMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 },

  // Toolbar: view switch, filters, expand/collapse
  filterBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: C.white, borderBottom: `1px solid ${C.hairline}`, flexWrap: 'wrap' },
  filterLabel: { fontSize: 12, color: C.inkMuted, marginRight: 2 },
  pill: { ...pillBase, border: `1px solid ${C.hairline}`, background: C.white, color: C.ink },
  pillActive: { ...pillBase, border: `1px solid ${C.midnight}`, background: C.midnight, color: C.white },
  pillDivider: { width: 1, height: 18, background: C.hairline, margin: '0 4px' },
  seg: { display: 'inline-flex', border: `1px solid ${C.hairline}` },
  segBtn: (on) => ({ ...pillBase, border: 'none', background: on ? C.midnight : C.white, color: on ? C.white : C.ink, padding: '6px 12px' }),

  // ── List view: one collapsible group per stage ──
  groups: { padding: '16px 20px 48px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1440, width: '100%', margin: '0 auto' },
  group: { background: C.white, border: `1px solid ${C.hairline}` },
  groupHdr: (open, over) => ({ position: 'sticky', top: HDR_H, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: over ? '#E8E9ED' : C.white, borderBottom: open ? `1px solid ${C.hairline}` : 'none', cursor: 'pointer', userSelect: 'none', width: '100%', border: 'none', fontFamily: FONT, textAlign: 'left' }),
  groupName: { fontSize: 16, fontWeight: 600, color: C.ink },
  groupCnt: { fontSize: 13, color: C.inkMuted, fontVariantNumeric: 'tabular-nums' },
  groupOverdue: { fontSize: 13, color: C.flameDeep, fontWeight: 500 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 },
  th: { textAlign: 'left', fontWeight: 600, fontSize: 12, color: C.inkMuted, padding: '8px 12px', borderBottom: `1px solid ${C.hairline}`, background: C.white, whiteSpace: 'nowrap' },
  thBtn: { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.inkMuted, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 },
  td: { padding: '8px 12px', borderBottom: `1px solid ${C.hairline}`, verticalAlign: 'middle', color: C.ink },
  tdMuted: { padding: '8px 12px', borderBottom: `1px solid ${C.hairline}`, verticalAlign: 'middle', color: C.inkMuted },
  rowName: { fontWeight: 600, color: C.ink },
  rowSub: { fontSize: 12, color: C.inkMuted, marginTop: 1 },
  stageSel: { fontFamily: FONT, fontSize: 13, padding: '4px 6px', border: `1px solid ${C.hairline}`, borderRadius: 0, background: C.white, color: C.ink, cursor: 'pointer' },
  groupFt: { display: 'flex', gap: 8, padding: '10px 16px', alignItems: 'center' },
  emptyGroup: { padding: '18px 16px', fontSize: 13, color: C.inkMuted },

  // ── Board view ──
  board: { display: 'flex', gap: 12, padding: 16, flex: 1, alignItems: 'flex-start', overflowX: 'auto' },
  col: { flex: '0 0 240px', background: C.white, border: `1px solid ${C.hairline}`, display: 'flex', flexDirection: 'column' },
  colHdr: { padding: '12px 12px 10px', borderBottom: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  colName: { fontSize: 14, fontWeight: 600, color: C.ink },
  colCnt: { fontSize: 12, color: C.inkMuted, fontVariantNumeric: 'tabular-nums' },
  colScroll: { overflowY: 'auto', flex: 1, minHeight: 120, maxHeight: 'calc(100vh - 300px)' },
  colBody: { padding: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: C.white, border: `1px solid ${C.hairline}`, padding: '10px 11px', cursor: 'grab', userSelect: 'none' },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  av: { width: 30, height: 30, borderRadius: 0, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName: { fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.25, flex: 1 },
  cardFirm: { fontSize: 12, color: C.inkMuted, marginTop: 1 },
  cardMeta: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 7 },
  metaRow: { fontSize: 12, color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 4 },
  spl: { fontSize: 11, padding: '1px 6px', borderRadius: 0, border: `1px solid ${C.hairline}`, color: C.ink, background: C.surfaceAlt },
  cardFt: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.hairline}` },
  showMore: { ...btnBase, margin: '4px 8px 8px', justifyContent: 'center', border: `1px solid ${C.hairline}`, background: C.white, color: C.ink, fontSize: 12, width: 'calc(100% - 16px)' },

  // Last-contact badges
  bok: { ...badgeBase, background: C.surfaceAlt, color: C.inkMuted },
  bwn: { ...badgeBase, background: C.white, color: C.ink, border: `1px solid ${C.gray}` },
  bod: { ...badgeBase, background: 'rgba(250,69,54,0.09)', color: C.flameDeep },

  // Modals
  ovl: { position: 'fixed', inset: 0, background: 'rgba(5,8,28,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: C.white, border: `1px solid ${C.hairline}`, borderTop: `3px solid ${C.midnight}`, borderRadius: 0, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 24 },
  mHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.hairline}` },
  mTitle: { fontSize: 16, fontWeight: 600, color: C.ink },
  fGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fFull: { gridColumn: '1 / -1' },
  fGrp: { display: 'flex', flexDirection: 'column', gap: 4 },
  fLbl: { fontSize: 12, fontWeight: 500, color: C.inkMuted },
  fInp: { background: C.white, border: `1px solid ${C.hairline}`, borderRadius: 0, padding: '8px 10px', fontSize: 13, fontFamily: FONT, color: C.ink, width: '100%' },
  fTa: { background: C.white, border: `1px solid ${C.hairline}`, borderRadius: 0, padding: '8px 10px', fontSize: 13, fontFamily: FONT, color: C.ink, width: '100%', minHeight: 68, resize: 'vertical' },
  mFt: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.hairline}` },

  // Search dropdown
  sDrop: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 400, maxWidth: '90vw', background: C.white, border: `1px solid ${C.hairline}`, boxShadow: '0 8px 24px rgba(5,8,28,0.18)', zIndex: 200, maxHeight: 480, overflowY: 'auto' },
  sSec: { ...eyebrow, padding: '10px 14px 6px' },
  sRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderTop: `1px solid ${C.hairline}` },
  sIco: { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 },
  sFt: { padding: '8px 14px', borderTop: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.inkMuted },

  // Login
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.midnight, padding: 20 },
  loginCard: { background: C.white, borderRadius: 0, width: 380, maxWidth: '100%', padding: 36 },

  toast: (show) => ({ position: 'fixed', bottom: 20, right: 20, background: C.midnight, color: C.white, padding: '10px 16px', fontSize: 13, zIndex: 200, opacity: show ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none', fontFamily: FONT, borderLeft: `3px solid ${C.flame}` }),

  // Notes timeline (contact detail)
  noteItem: { padding: '8px 0', borderBottom: `1px solid ${C.hairline}`, display: 'flex', gap: 8, alignItems: 'flex-start' },
  noteText: { fontSize: 13, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  noteMeta: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: C.inkMuted },
  noteDelBtn: { width: 20, height: 20, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: C.inkMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  noteEmpty: { fontSize: 13, color: C.inkMuted, padding: '10px 0', textAlign: 'center' },
  noteList: { maxHeight: 200, overflowY: 'auto', marginBottom: 10 },
};

const StageDot = ({ stage, size = 10 }) => (
  <span aria-hidden="true" style={{ width: size, height: size, background: stage.c, border: stage.edge ? `1px solid ${stage.edge}` : 'none', flexShrink: 0, display: 'inline-block' }} />
);

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
      setError('That email and password don’t match. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{ marginBottom: 28 }}>
          <img src={LOGO_COLOR} alt="Alpenglow Capital" style={{ height: 34, marginBottom: 20 }} />
          <div style={{ width: 40, height: 3, background: C.flame, marginBottom: 10 }} />
          <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Investor pipeline</div>
        </div>
        {error && (
          <div style={{ background: 'rgba(250,69,54,0.08)', borderLeft: `3px solid ${C.flame}`, padding: '8px 12px', fontSize: 13, color: C.flameDeep, marginBottom: 14 }}>
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

const SORTS = {
  name:    (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
  firm:    (a, b) => (a.firm || '').localeCompare(b.firm || ''),
  city:    (a, b) => (a.city || '').localeCompare(b.city || ''),
  source:  (a, b) => (a.source || '').localeCompare(b.source || ''),
  type:    (a, b) => (a.contact_type || '').localeCompare(b.contact_type || ''),
  contact: (a, b) => daysSince(a.last_contact_date) - daysSince(b.last_contact_date),
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [colPages, setColPages] = useState({ suspect: 1, prospect: 1, engagement: 1, invested: 1, nurture: 1 });
  const [view, setView] = useState(() => readStored(VIEW_KEY, 'list'));
  const [collapsed, setCollapsed] = useState(() => readStored(COLLAPSE_KEY, DEFAULT_COLLAPSED));
  const [sort, setSort] = useState({ key: 'contact', dir: 'desc' });

  useEffect(() => { writeStored(VIEW_KEY, view); }, [view]);
  useEffect(() => { writeStored(COLLAPSE_KEY, collapsed); }, [collapsed]);

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

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      showToast('Couldn’t load contacts. Refresh to try again.');
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

  // One path for every stage change: drag-and-drop, the row's stage menu and the detail modal.
  const moveContact = async (contact, toStage) => {
    if (!contact || contact.stage === toStage) return false;
    if (toStage === 'invested') {
      setModal({ type: 'promote', contact });
      return false;
    }
    try {
      await moveStage(contact.id, contact.stage, toStage, user.id);
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, stage: toStage } : c));
      showToast('Moved to ' + STAGES.find(s => s.id === toStage).lb);
      if (toStage === 'nurture') handleMoveToNurture(contact);
      return true;
    } catch (e) {
      showToast('Couldn’t move contact. Try again.');
      return false;
    }
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragId) return;
    const contact = contacts.find(c => c.id === dragId);
    setDragId(null);
    await moveContact(contact, stageId);
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
        showToast('Contact saved');
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
      showToast('Couldn’t save contact. Try again.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      showToast('Contact removed');
    } catch (e) {
      showToast('Couldn’t remove contact. Try again.');
    }
  };

  const handlePromotionRequest = async (contact, details) => {
    try {
      await requestPromotion(contact.id, user.id, details);
      showToast('Promotion request submitted');
      setModal(null);
    } catch (e) {
      showToast('Couldn’t submit request. Try again.');
    }
  };

  const handlePromotionApprove = async (requestId, contactId) => {
    try {
      await approvePromotion(requestId, contactId, user.id, profile);
      await loadContacts();
      showToast('LP promoted to Investors database');
      setModal(null);
    } catch (e) {
      showToast('Couldn’t approve promotion. Try again.');
    }
  };

  useEffect(() => {
    setColPages({ suspect: 1, prospect: 1, engagement: 1, invested: 1, nurture: 1 });
  }, [activeSource, activeType, search, overdueOnly]);

  const filtered = useCallback(() => {
    let list = contacts;
    if (search.trim()) {
      const lq = search.toLowerCase();
      list = list.filter(c =>
        c.full_name?.toLowerCase().includes(lq) ||
        c.firm?.toLowerCase().includes(lq) ||
        c.city?.toLowerCase().includes(lq) ||
        c.email?.toLowerCase().includes(lq)
      );
    }
    if (activeSource) list = list.filter(c => c.source === activeSource);
    if (activeType) list = list.filter(c => c.contact_type === activeType);
    if (overdueOnly) list = list.filter(c => daysSince(c.last_contact_date) >= 30);
    return list;
  }, [contacts, search, activeSource, activeType, overdueOnly]);

  const stats = useCallback(() => {
    const s = { suspect: 0, prospect: 0, engagement: 0, invested: 0, nurture: 0, overdue: 0 };
    contacts.forEach(c => {
      if (s[c.stage] !== undefined) s[c.stage]++;
      if (daysSince(c.last_contact_date) >= 30) s.overdue++;
    });
    return s;
  }, [contacts]);

  const showMoreCol = (stageId, all = false) => {
    setColPages(prev => ({ ...prev, [stageId]: all ? 9999 : prev[stageId] + 1 }));
  };

  const clearFilters = () => {
    setActiveSource(null);
    setActiveType(null);
    setOverdueOnly(false);
  };

  const toggleGroup = (stageId) => setCollapsed(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  const setAllGroups = (isCollapsed) => setCollapsed(STAGES.reduce((acc, s) => ({ ...acc, [s.id]: isCollapsed }), {}));

  const jumpToStage = (stageId) => {
    if (view !== 'list') { setView('list'); }
    setCollapsed(prev => ({ ...prev, [stageId]: false }));
    setTimeout(() => {
      const el = document.getElementById('stage-' + stageId);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HDR_H - 8, behavior: 'smooth' });
    }, 30);
  };

  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'contact' ? 'desc' : 'asc' });
  };

  const sortRows = (rows) => {
    const fn = SORTS[sort.key] || SORTS.name;
    const out = [...rows].sort(fn);
    return sort.dir === 'desc' ? out.reverse() : out;
  };

  const hasFilters = activeSource || activeType || overdueOnly;

  if (!user) return <Login onLogin={handleLogin} />;

  const st = stats();
  const list = filtered();
  const total = contacts.length || 1;
  const usedSources = [...new Set(contacts.map(c => c.source).filter(Boolean))];

  const SortHead = ({ k, children, style }) => {
    const on = sort.key === k;
    return (
      <th style={{ ...S.th, ...style }} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button style={{ ...S.thBtn, color: on ? C.ink : C.inkMuted }} onClick={() => toggleSort(k)}>
          {children}
          <i className={`ti ${on ? (sort.dir === 'asc' ? 'ti-chevron-up' : 'ti-chevron-down') : 'ti-selector'}`} style={{ fontSize: 12, opacity: on ? 1 : 0.5 }} />
        </button>
      </th>
    );
  };

  return (
    <div style={S.app}>
      <div style={S.content}>
        <header style={S.hdr}>
          <div style={S.brand}>
            <img src={LOGO_WHITE} alt="Alpenglow Capital" style={S.logo} />
            <span style={S.ptag}>Investor pipeline</span>
          </div>
          <div style={S.hRight}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 10, fontSize: 14, color: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
                <input
                  className="ag-hsearch"
                  style={S.hSearch}
                  placeholder="Search name, firm, city or email"
                  aria-label="Search contacts"
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
                    const stg = STAGES.find(s => s.id === r.stage);
                    return (
                      <div key={r.id} className="ag-row" style={S.sRow} onClick={() => handleSearchSelect(r)}>
                        <div style={{ ...S.sIco, background: C.surfaceAlt, color: C.midnight }}>
                          <i className={`ti ${ic.icon}`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{highlight(r.full_name, search)}</div>
                          <div style={{ fontSize: 12, color: C.inkMuted }}>{r.firm}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          {stg && <span style={{ fontSize: 12, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}><StageDot stage={stg} size={8} />{stg.lb}</span>}
                          <span style={{ fontSize: 12, color: C.inkMuted }}>{r.city}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={S.sFt}>
                    <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                    <span>Esc to close</span>
                  </div>
                </div>
              )}
            </div>
            <button style={S.hBtn} onClick={() => setModal({ type: 'capture' })}>
              <i className="ti ti-camera" /> Capture
            </button>
            <button style={S.hBtn} onClick={() => setModal({ type: 'import' })}>
              <i className="ti ti-upload" /> Import
            </button>
            <button style={S.hBtnP} onClick={() => setModal({ type: 'add' })}>
              <i className="ti ti-plus" /> Add contact
            </button>
            <button style={S.hIbtn} onClick={handleSignOut} title="Sign out" aria-label="Sign out">
              <i className="ti ti-logout" style={{ fontSize: 16 }} />
            </button>
          </div>
        </header>

        <nav style={S.stats} aria-label="Pipeline stages">
          {STAGES.map(stage => (
            <button key={stage.id} className="ag-stat" style={S.stat} onClick={() => jumpToStage(stage.id)} title={`Go to ${stage.lb}`}>
              <div style={S.statNum}>{st[stage.id]}</div>
              <div style={S.statLbl}><StageDot stage={stage} size={8} />{stage.lb}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${Math.round(st[stage.id] / total * 100)}%`, background: stage.id === 'nurture' ? C.gray : stage.c }} />
            </button>
          ))}
          <button className="ag-stat" style={{ ...S.stat, borderRight: 'none' }} onClick={() => setOverdueOnly(v => !v)} title="Show only contacts not reached in 30+ days">
            <div style={{ ...S.statNum, color: C.flame }}>{st.overdue}</div>
            <div style={S.statLbl}>Overdue, 30+ days</div>
          </button>
        </nav>

        <div style={S.filterBar}>
          <div style={S.seg} role="group" aria-label="View">
            <button style={S.segBtn(view === 'list')} onClick={() => setView('list')}><i className="ti ti-list" style={{ fontSize: 13 }} />List</button>
            <button style={S.segBtn(view === 'board')} onClick={() => setView('board')}><i className="ti ti-layout-kanban" style={{ fontSize: 13 }} />Board</button>
          </div>
          {view === 'list' && (
            <>
              <button style={S.pill} onClick={() => setAllGroups(false)}><i className="ti ti-arrows-vertical" style={{ fontSize: 12 }} />Expand all</button>
              <button style={S.pill} onClick={() => setAllGroups(true)}><i className="ti ti-fold" style={{ fontSize: 12 }} />Collapse all</button>
            </>
          )}
          <div style={S.pillDivider} />
          <span style={S.filterLabel}>Filter</span>
          {[
            { key: 'investor', label: 'Investors', icon: 'ti-user-dollar' },
            { key: 'manager',  label: 'Managers',  icon: 'ti-briefcase' },
            { key: 'contact',  label: 'Contacts',  icon: 'ti-address-book' },
          ].map(t => (
            <button key={t.key} style={activeType === t.key ? S.pillActive : S.pill}
              onClick={() => setActiveType(activeType === t.key ? null : t.key)}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 12 }} />
              {t.label}
            </button>
          ))}
          <button style={overdueOnly ? S.pillActive : S.pill} onClick={() => setOverdueOnly(v => !v)}>
            <i className="ti ti-clock-exclamation" style={{ fontSize: 12 }} />Overdue
          </button>
          {usedSources.length > 0 && <div style={S.pillDivider} />}
          {usedSources.map(src => (
            <button key={src} style={activeSource === src ? S.pillActive : S.pill}
              onClick={() => setActiveSource(activeSource === src ? null : src)}>
              {src}
            </button>
          ))}
          {hasFilters && (
            <>
              <div style={S.pillDivider} />
              <button style={S.pill} onClick={clearFilters}>
                <i className="ti ti-x" style={{ fontSize: 11 }} />
                Clear filters
              </button>
              <span style={{ fontSize: 12, color: C.inkMuted, marginLeft: 4 }}>
                {list.length} contact{list.length !== 1 ? 's' : ''} shown
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkMuted, fontSize: 14, padding: 40 }}>
            Loading pipeline…
          </div>
        ) : view === 'list' ? (
          // ── LIST VIEW: one collapsible table per stage ──
          <div style={S.groups}>
            {STAGES.map(stage => {
              const rows = sortRows(list.filter(c => c.stage === stage.id));
              const open = !collapsed[stage.id];
              const visibleCount = colPages[stage.id] * ROWS_PER_PAGE;
              const visible = rows.slice(0, visibleCount);
              const remaining = rows.length - visible.length;
              const overdue = rows.filter(c => daysSince(c.last_contact_date) >= 30).length;
              return (
                <section key={stage.id} id={'stage-' + stage.id} style={S.group}
                  onDragOver={e => { e.preventDefault(); if (dragOver !== stage.id) setDragOver(stage.id); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                  onDrop={e => handleDrop(e, stage.id)}>
                  <button style={S.groupHdr(open, dragOver === stage.id)} onClick={() => toggleGroup(stage.id)} aria-expanded={open}>
                    <i className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: 16, color: C.inkMuted }} />
                    <StageDot stage={stage} size={12} />
                    <span style={S.groupName}>{stage.lb}</span>
                    <span style={S.groupCnt}>{rows.length}{hasFilters || search.trim() ? ` of ${st[stage.id]}` : ''}</span>
                    {overdue > 0 && <span style={S.groupOverdue}>{overdue} overdue</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: C.inkMuted }}>
                      {dragOver === stage.id ? 'Drop to move here' : open ? 'Collapse' : 'Expand'}
                    </span>
                  </button>

                  {open && (
                    rows.length === 0 ? (
                      <div style={S.emptyGroup}>
                        {hasFilters || search.trim() ? 'No contacts in this stage match your filters.' : 'No contacts in this stage yet. Drag a row here or change a contact’s stage to add one.'}
                      </div>
                    ) : (
                      <>
                        <div style={S.tableWrap}>
                          <table style={S.table}>
                            <thead>
                              <tr>
                                <SortHead k="name" style={{ width: '24%' }}>Name</SortHead>
                                <SortHead k="firm" style={{ width: '18%' }}>Firm</SortHead>
                                <SortHead k="type">Type</SortHead>
                                <SortHead k="city">City</SortHead>
                                <SortHead k="source">Source</SortHead>
                                <SortHead k="contact">Last contact</SortHead>
                                <th style={S.th}>Stage</th>
                                <th style={{ ...S.th, textAlign: 'right' }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {visible.map(c => {
                                const b = badgeFor(c.last_contact_date);
                                const ic = GH_ICONS[c.contact_type] || GH_ICONS.contact;
                                return (
                                  <tr key={c.id} className="ag-row" draggable
                                    onDragStart={e => handleDragStart(e, c.id)}
                                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                                    style={{ cursor: 'pointer', opacity: dragId === c.id ? 0.4 : 1 }}
                                    onClick={() => setModal({ type: 'detail', contact: c })}>
                                    <td style={S.td}>
                                      <div style={S.rowName}>{highlight(c.full_name, search)}</div>
                                      {c.email && <div style={S.rowSub}>{c.email}</div>}
                                    </td>
                                    <td style={S.td}>{highlight(c.firm, search)}</td>
                                    <td style={S.tdMuted}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        <i className={`ti ${ic.icon}`} style={{ fontSize: 13 }} />{ic.lb}
                                      </span>
                                    </td>
                                    <td style={S.tdMuted}>{c.city}</td>
                                    <td style={S.tdMuted}>{c.source}</td>
                                    <td style={S.td}><span style={S[b.cl]}>{b.lb}</span></td>
                                    <td style={S.td} onClick={e => e.stopPropagation()}>
                                      <select style={S.stageSel} value={c.stage} aria-label={`Stage for ${c.full_name}`}
                                        onChange={e => moveContact(c, e.target.value)}>
                                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.lb}</option>)}
                                      </select>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                      <button style={S.ibtn} title="Edit" aria-label={`Edit ${c.full_name}`} onClick={() => setModal({ type: 'edit', contact: c })}><i className="ti ti-edit" style={{ fontSize: 15 }} /></button>
                                      <button style={S.ibtn} title="Remove" aria-label={`Remove ${c.full_name}`} onClick={() => handleDelete(c.id, c.full_name)}><i className="ti ti-trash" style={{ fontSize: 15 }} /></button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {remaining > 0 && (
                          <div style={S.groupFt}>
                            <button style={S.btn} onClick={() => showMoreCol(stage.id)}>
                              Show {Math.min(remaining, ROWS_PER_PAGE)} more
                            </button>
                            <button style={S.btn} onClick={() => showMoreCol(stage.id, true)}>
                              Show all {rows.length}
                            </button>
                            <span style={{ fontSize: 12, color: C.inkMuted }}>{remaining} not shown</span>
                          </div>
                        )}
                      </>
                    )
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          // ── BOARD VIEW ──
          <div style={S.board}>
            {STAGES.map(stage => {
              const stageContacts = sortRows(list.filter(c => c.stage === stage.id));
              const visibleCount = colPages[stage.id] * CARDS_PER_PAGE;
              const visible = stageContacts.slice(0, visibleCount);
              const remaining = stageContacts.length - visibleCount;
              return (
                <div key={stage.id} style={{ ...S.col, outline: dragOver === stage.id ? `2px solid ${C.midnight}` : 'none' }}
                  onDragOver={e => { e.preventDefault(); if (dragOver !== stage.id) setDragOver(stage.id); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                  onDrop={e => handleDrop(e, stage.id)}>
                  <div style={{ height: 3, background: stage.id === 'nurture' ? C.gray : stage.c, flexShrink: 0 }} />
                  <div style={S.colHdr}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StageDot stage={stage} size={9} />
                      <span style={S.colName}>{stage.lb}</span>
                    </div>
                    <span style={S.colCnt}>{stageContacts.length}</span>
                  </div>
                  <div style={S.colScroll}>
                    <div style={S.colBody}>
                      {stageContacts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '22px 10px', fontSize: 12, color: C.inkMuted }}>
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
                            onDragEnd={() => { setDragId(null); setDragOver(null); }}>
                            <div style={S.cardTop}>
                              <div style={{ ...S.av, background: av.b, color: av.c }}>{initials(c.full_name)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={S.cardName}>{c.full_name}</div>
                                <div style={S.cardFirm}>{c.firm}</div>
                              </div>
                              <i className={`ti ${ic.icon}`} style={{ fontSize: 13, color: C.inkMuted }} />
                            </div>
                            <div style={S.cardMeta}>
                              {c.city && <div style={S.metaRow}><i className="ti ti-map-pin" style={{ fontSize: 12 }} />{c.city}</div>}
                              {c.source && <div style={S.metaRow}><i className="ti ti-tag" style={{ fontSize: 12 }} /><span style={S.spl}>{c.source}</span></div>}
                            </div>
                            <div style={S.cardFt}>
                              <span style={S[b.cl]}>{b.lb}</span>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button style={S.ibtn} title="View" onClick={() => setModal({ type: 'detail', contact: c })}><i className="ti ti-eye" style={{ fontSize: 14 }} /></button>
                                <button style={S.ibtn} title="Edit" onClick={() => setModal({ type: 'edit', contact: c })}><i className="ti ti-edit" style={{ fontSize: 14 }} /></button>
                                <button style={S.ibtn} title="Remove" onClick={() => handleDelete(c.id, c.full_name)}><i className="ti ti-trash" style={{ fontSize: 14 }} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {remaining > 0 && (
                      <button style={S.showMore} onClick={() => showMoreCol(stage.id)}>
                        Show {Math.min(remaining, CARDS_PER_PAGE)} more ({remaining} left)
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
            if (fromStage === toStage) { setModal(null); return; }
            const contact = contacts.find(c => c.id === contactId);
            const moved = await moveContact(contact, toStage);
            if (moved) setModal(null);
          }}
          onPromotionRequest={handlePromotionRequest}
          onPromotionApprove={handlePromotionApprove}
          showToast={showToast}
        />
      )}

      <div style={S.toast(toast.show)} role="status">{toast.msg}</div>
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
            <i className="ti ti-camera" style={{ fontSize: 16, color: '#FA4536' }} />
            <span style={S.mTitle}>Capture contact</span>
          </div>
          <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {step === 'upload' && (
          <>
            <div
              style={{ border: '1px dashed rgba(250,69,54,0.42)', borderRadius: 2, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 13, background: 'rgba(250,69,54,0.04)' }}
              onClick={() => document.getElementById('captureInput').click()}>
              <i className="ti ti-camera" style={{ fontSize: 32, color: '#FA4536', display: 'block', marginBottom: 10 }} />
              <p style={{ fontSize: 12, color: '#555B66', marginBottom: 6 }}>Take a photo or upload from gallery</p>
              <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555B66' }}>Business card · Tear sheet · Any contact info</p>
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
              <img src={preview} alt="Captured" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 2, marginBottom: 14 }} />
            )}
            {extracting ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#555B66', fontSize: 11, letterSpacing: '0.1em' }}>
                <i className="ti ti-loader" style={{ fontSize: 22, display: 'block', marginBottom: 8 }} />
                Extracting contact details…
              </div>
            ) : extracted && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#555B66', marginBottom: 10 }}>
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

  // Notes timeline state (used only when modal.type === 'detail')
  const [noteEntries, setNoteEntries] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (modal.type === 'detail' && modal.contact?.id) {
      let cancelled = false;
      setNotesLoading(true);
      getContactNotes(modal.contact.id)
        .then(rows => { if (!cancelled) setNoteEntries(rows || []); })
        .catch(() => { if (!cancelled) showToast('Error loading notes'); })
        .finally(() => { if (!cancelled) setNotesLoading(false); });
      return () => { cancelled = true; };
    }
  }, [modal.type, modal.contact?.id, showToast]);

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !modal.contact?.id) return;
    setAddingNote(true);
    const authorName = profile?.full_name || profile?.email || 'Unknown';
    try {
      const created = await addContactNote(modal.contact.id, newNoteText.trim(), authorName);
      setNoteEntries(prev => [created, ...prev]);
      setNewNoteText('');
    } catch (e) {
      showToast('Error adding note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteContactNote(noteId);
      setNoteEntries(prev => prev.filter(n => n.id !== noteId));
      showToast('Note deleted');
    } catch (e) {
      showToast('Error deleting note');
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setP = (k) => (e) => setPromoDetails(p => ({ ...p, [k]: e.target.value }));

  if (modal.type === 'promote') {
    return (
      <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ ...S.modal, borderColor: '#DCDDE2' }}>
          <div style={S.mHdr}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-lock" style={{ fontSize: 16, color: '#05081C' }} />
              <span style={{ ...S.mTitle, color: '#05081C' }}>Promote to Invested</span>
            </div>
            <button style={S.ibtn} onClick={onClose}><i className="ti ti-x" /></button>
          </div>
          <div style={{ background: 'rgba(5,8,28,0.08)', border: '1px solid rgba(5,8,28,0.2)', borderRadius: 2, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'rgba(5,8,28,0.8)', lineHeight: 1.5 }}>
            You are about to promote <strong style={{ color: '#05081C' }}>{modal.contact.full_name}</strong> to Invested status. This will write their record to the secure LP Registry database. This action is logged and requires authorization.
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
            <button style={{ ...S.btnP, background: '#05081C', borderColor: '#05081C' }}
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
              <i className={`ti ${icon}`} style={{ fontSize: 13, color: '#555B66', marginTop: 1 }} />
              <span style={{ color: '#555B66', minWidth: 100, fontSize: 11 }}>{label}</span>
              <span style={{ color: '#05081C' }}>{val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14, fontSize: 12 }}>
            <i className="ti ti-calendar" style={{ fontSize: 13, color: '#555B66', marginTop: 1 }} />
            <span style={{ color: '#555B66', minWidth: 100, fontSize: 11 }}>Last contact</span>
            <span style={S[b.cl]}>{c.last_contact_date ? c.last_contact_date + ' · ' : ''}{b.lb}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CC2C1D', marginBottom: 8 }}>Pipeline stage</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {STAGES.map(s => (
              <button key={s.id} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 0, cursor: 'pointer', border: c.stage === s.id ? '1px solid #05081C' : '1px solid #DCDDE2', background: c.stage === s.id ? '#05081C' : '#FFFFFF', color: c.stage === s.id ? '#FFFFFF' : '#05081C', fontFamily: FONT, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => onMoveStage(c.id, c.stage, s.id)}>
                <span style={{ width: 8, height: 8, background: s.c, border: s.edge ? '1px solid ' + s.edge : 'none' }} />{s.lb}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CC2C1D', marginBottom: 6 }}>Notes</div>

          {notesLoading ? (
            <div style={S.noteEmpty}>Loading notes…</div>
          ) : (
            <div style={S.noteList}>
              {noteEntries.length === 0 ? (
                <div style={S.noteEmpty}>No notes yet</div>
              ) : (
                noteEntries.map(n => (
                  <div key={n.id} style={S.noteItem}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.noteText}>{n.note_text}</div>
                      <div style={S.noteMeta}>
                        <span>{n.created_by || 'Unknown'}</span>
                        <span>·</span>
                        <span>{formatNoteTimestamp(n.created_at)}</span>
                      </div>
                    </div>
                    <button style={S.noteDelBtn} onClick={() => handleDeleteNote(n.id)} title="Delete note">
                      <i className="ti ti-x" style={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea
              style={{ ...S.fTa, minHeight: 44, flex: 1 }}
              placeholder="Add a note…"
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
            />
            <button
              style={{ ...S.btnP, opacity: (addingNote || !newNoteText.trim()) ? 0.6 : 1 }}
              onClick={handleAddNote}
              disabled={addingNote || !newNoteText.trim()}>
              {addingNote ? '…' : 'Add'}
            </button>
          </div>

          <div style={S.mFt}><button style={S.btn} onClick={onClose}>Close</button></div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.mHdr}>
          <span style={S.mTitle}>{modal.type === 'edit' ? 'Edit contact' : 'New contact'}</span>
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
