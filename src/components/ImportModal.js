import React, { useState } from 'react';
import { createContact } from '../lib/supabase';

const S = {
  ovl: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'rgba(11,15,24,0.97)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 22 },
  mHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  mTitle: { fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(232,220,200,0.92)' },
  ibtn: { width: 24, height: 24, borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(170,152,125,0.42)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btn: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,182,155,0.62)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnP: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid #C4522A', background: '#C4522A', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 },
  mFt: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 15, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' },
  zone: { border: '1px dashed rgba(196,82,42,0.42)', borderRadius: 5, padding: 26, textAlign: 'center', cursor: 'pointer', marginBottom: 13, background: 'rgba(196,82,42,0.04)', transition: 'background 0.15s' },
  fInp: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 3, padding: '7px 9px', fontSize: 12, fontFamily: "'Montserrat', sans-serif", color: 'rgba(232,220,200,0.92)', width: '100%' },
};

export default function ImportModal({ onClose, onImported, userId, showToast }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = ev.target.result.trim().split('\n')
        .map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
      const col = (k) => {
        const i = headers.findIndex(h => h.includes(k));
        return i >= 0 ? i : null;
      };
      const parsed = rows.slice(1)
        .filter(r => r.length > 1)
        .map(r => ({
          full_name:      r[col('name')] || '',
          email:          r[col('email')] || '',
          phone:          r[col('phone')] || '',
          firm:           r[col('firm')] || '',
          city:           r[col('city')] || '',
          management_co:  r[col('mgmt')] || 'Alpenglow Capital',
          source:         r[col('source')] || 'Manager Upload',
          contact_type:   r[col('type')] || 'investor',
          stage:          'suspect',
          last_contact_date: new Date().toISOString().split('T')[0],
          notes:          '',
        }))
        .filter(c => c.full_name);
      setPending(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!pending.length) return;
    setLoading(true);
    let imported = 0;
    let failed = 0;
    for (const contact of pending) {
      try {
        await createContact(contact, userId);
        imported++;
      } catch (e) {
        failed++;
        console.error('Import error:', e);
      }
    }
    setLoading(false);
    showToast(`${imported} contacts imported${failed > 0 ? `, ${failed} failed` : ''}`);
    onImported();
    onClose();
  };

  return (
    <div style={S.ovl} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.mHdr}>
          <span style={S.mTitle}>Import Contacts</span>
          <button style={S.ibtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={S.zone} onClick={() => document.getElementById('csvInput').click()}>
          <i className="ti ti-file-upload" style={{ fontSize: 26, color: '#C4522A', display: 'block', marginBottom: 8 }} />
          <p style={{ fontSize: 11, color: 'rgba(200,182,155,0.55)', lineHeight: 1.5 }}>
            Upload manager tare sheet or contact CSV
          </p>
          <p style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(170,152,125,0.38)', marginTop: 4 }}>
            Name · Email · Phone · Firm · City · Source · Type
          </p>
        </div>
        <input
          type="file"
          id="csvInput"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleCSV}
        />

        {pending.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: 'rgba(170,152,125,0.48)', margin: '0 0 4px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {pending.length} contacts ready
            </div>
            <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 11, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, padding: 8, marginBottom: 10 }}>
              {pending.slice(0, 8).map((c, i) => (
                <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(200,182,155,0.55)' }}>
                  {c.full_name} · {c.firm}
                </div>
              ))}
              {pending.length > 8 && (
                <div style={{ padding: '4px 0', color: 'rgba(170,152,125,0.42)' }}>
                  …and {pending.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize: 8, letterSpacing: '0.08em', color: 'rgba(170,152,125,0.36)', lineHeight: 1.6 }}>
          Imports as Suspect by default. Include Stage and Type columns to override.
        </p>

        <div style={S.mFt}>
          <button style={S.btn} onClick={onClose}>Cancel</button>
          {pending.length > 0 && (
            <button
              style={{ ...S.btnP, opacity: loading ? 0.7 : 1 }}
              onClick={handleImport}
              disabled={loading}>
              {loading ? 'Importing…' : `Import ${pending.length} contacts`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
