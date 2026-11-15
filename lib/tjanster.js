// Speglar backendens prismatris (serviceos/api/routes/bokningar.py → PRISER).
// Priserna är inkl. moms. Backend räknar alltid om priset vid bokning — det här
// används bara för förhandsvisningen i appen.

export const TEAL = '#1D9E75';

export const TJÄNSTER = [
  { id: 'hemstadning',     etikett: 'Hemstädning',     ikon: '🏠', rut: true,  färg: '#EFF6FF', kantfärg: '#BFDBFE' },
  { id: 'flyttstadning',   etikett: 'Flyttstädning',   ikon: '📦', rut: true,  färg: '#FFF7ED', kantfärg: '#FED7AA' },
  { id: 'fonsterputsning', etikett: 'Fönsterputs',     ikon: '🪟', rut: true,  färg: '#F0F9FF', kantfärg: '#BAE6FD' },
  { id: 'kontorsstadning', etikett: 'Kontorsstädning', ikon: '🏢', rut: false, färg: '#F0FDF4', kantfärg: '#BBF7D0' },
];

export const STORLEKAR = [
  { id: 'studio', etikett: 'Studio / 1 rok' },
  { id: '2rok',   etikett: '2 rum och kök' },
  { id: '3rok',   etikett: '3 rum och kök' },
  { id: '4plus',  etikett: '4+ rum och kök' },
];

export const PRISER = {
  hemstadning:     { studio: 900,  '2rok': 1200, '3rok': 1500, '4plus': 1900 },
  flyttstadning:   { studio: 1800, '2rok': 2400, '3rok': 3200, '4plus': 4200 },
  kontorsstadning: { studio: 1100, '2rok': 1500, '3rok': 2000, '4plus': 2600 },
  fonsterputsning: { studio: 600,  '2rok': 800,  '3rok': 1000, '4plus': 1300 },
};

export const TIDER = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export function tjänstInfo(id) {
  return TJÄNSTER.find((t) => t.id === id) ?? { id, etikett: 'Städning', ikon: '🧹', rut: false };
}

/** Förhandsberäkning: RUT 50 % bara för RUT-tjänst + personnummer (samma regel som backend). */
export function beräknaPris(tjänstId, storlekId, harPersonnummer) {
  const pris = PRISER[tjänstId]?.[storlekId];
  if (pris == null) return null;
  const rut = tjänstInfo(tjänstId).rut && harPersonnummer ? Math.round(pris * 0.5) : 0;
  return { pris, rut, att_betala: pris - rut };
}

export const kr = (n) => `${Math.round(Number(n) || 0).toLocaleString('sv-SE')} kr`;

/** Lokalt datum som YYYY-MM-DD (inte toISOString — den ger UTC och kan byta dag). */
export function isoDatum(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Enkel kontroll av svenskt personnummer (format + Luhn). */
export function giltigtPersonnummer(rå) {
  const s = (rå || '').replace(/[^0-9]/g, '');
  const tio = s.length === 12 ? s.slice(2) : s;
  if (tio.length !== 10) return false;
  let summa = 0;
  for (let i = 0; i < 10; i++) {
    let v = Number(tio[i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    summa += v;
  }
  return summa % 10 === 0;
}

export const STATUS_FÄRG = {
  gron: '#10B981', teal: TEAL, amber: '#F59E0B', gra: '#9CA3AF',
};
