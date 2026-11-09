import React, { useState } from 'react';
import { createContact } from '../lib/supabase';

// Alpenglow Design System: midnight #05081C, flame #FA4536, white; square corners.
const FONT = "'Eina 03', Outfit, 'Helvetica Neue', Arial, sans-serif";
const S = {
  ovl: { position: 'fixed', inset: 0, background: 'rgba(5,8,28,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#FFFFFF', border: '1px solid #DCDDE2', borderTop: '3px solid #05081C', borderRadius: 0, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 24 },
  mHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #DCDDE2' },
  mTitle: { fontSize: 16, fontWeight: 600, color: '#05081C' },
  ibtn: { width: 28, height: 28, borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#555B66', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btn: { fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 0, cursor: 'pointer', border: '1px solid #DCDDE2', background: '#FFFFFF', color: '#05081C', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnP: { fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 0, cursor: 'pointer', border: '1px solid #05081C', background: '#05081C', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: 6 },
  mFt: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid #DCDDE2' },
  zone: { border: '1px dashed #A7ACB5', borderRadius: 0, padding: 26, textAlign: 'center', cursor: 'pointer', marginBottom: 13, background: '#F3F3F5' },
  fInp: { background: '#FFFFFF', border: '1px solid #DCDDE2', borderRadius: 0, padding: '8px 10px', fontSize: 13, fontFamily: FONT, color: '#05081C', width: '100%' },
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
          <span style={S.mTitle}>Import contacts</span>
          <button style={S.ibtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={S.zone} onClick={() => document.getElementById('csvInput').click()}>
          <i className="ti ti-file-upload" style={{ fontSize: 26, color: '#FA4536', display: 'block', marginBottom: 8 }} />
          <p style={{ fontSize: 11, color: '#555B66', lineHeight: 1.5 }}>
            Upload a manager tear sheet or contact CSV
          </p>
          <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555B66', marginTop: 4 }}>
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
            <div style={{ fontSize: 10, color: '#555B66', margin: '0 0 4px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {pending.length} contacts ready
            </div>
            <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 11, border: '1px solid #DCDDE2', borderRadius: 2, padding: 8, marginBottom: 10 }}>
              {pending.slice(0, 8).map((c, i) => (
                <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #DCDDE2', color: '#555B66' }}>
                  {c.full_name} · {c.firm}
                </div>
              ))}
              {pending.length > 8 && (
                <div style={{ padding: '4px 0', color: '#555B66' }}>
                  …and {pending.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize: 10, letterSpacing: '0.08em', color: '#555B66', lineHeight: 1.6 }}>
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
