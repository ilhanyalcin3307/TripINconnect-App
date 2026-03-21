/**
 * Bir rezervasyon için provizyon ödeme tarihlerini ve tutarlarını hesaplar.
 *
 * @param {object} reservation - Rezervasyon kaydı (buchung, abreise, ruckreise, reisepreis, provisionRate)
 * @param {object} agenturEntry - Agentur Planung kaydı (kasseTyp, berechnung, tage, dkiModel, anzahlungPct, restzahlung, rbiBerechnung, rbiModel)
 * @returns {{ kasseTyp: string, payments: Array<{ date: Date, amount: number, label: string }> } | null}
 */
export function calcProvisionDates(reservation, agenturEntry) {
  if (!agenturEntry || !reservation) return null;

  const addDays = (dateStr, days) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + days);
    return d;
  };

  const kasseTyp = agenturEntry.kasseTyp || 'DKI';
  const preis = parseFloat(reservation.reisepreis) || 0;
  const provStr = String(reservation.provisionRate || '').replace('%', '').trim();
  const provRate = parseFloat(provStr) || 0;
  const totalProv = preis * (provRate / 100);

  if (kasseTyp === 'DKI') {
    const berechnung = agenturEntry.berechnung || 'Rückreisedatum';
    const tage = parseInt(agenturEntry.tage) || 30;
    const dkiModel = agenturEntry.dkiModel || 'Nacher';

    let baseDate;
    if (berechnung === 'Buchungsdatum') baseDate = reservation.buchung;
    else if (berechnung === 'Abreisedatum') baseDate = reservation.abreise;
    else baseDate = reservation.ruckreise;

    const offset = dkiModel === 'Nacher' ? tage : -tage;
    const paymentDate = addDays(baseDate, offset);

    return {
      kasseTyp: 'DKI',
      payments: paymentDate ? [{ date: paymentDate, amount: totalProv, label: 'DKI' }] : []
    };
  } else {
    // RBI: iki ayrı ödeme
    const anzahlungPct = parseFloat(agenturEntry.anzahlungPct) || 30;
    const restzahlung = parseInt(agenturEntry.restzahlung) || 30;
    const rbiModel = agenturEntry.rbiModel || 'Nacher';
    const rbiBerechnung = agenturEntry.rbiBerechnung || 'Abreisedatum';

    const anzahlungAmount = totalProv * (anzahlungPct / 100);
    const restAmount = totalProv - anzahlungAmount;

    // 1. Anzahlung: Buchungsdatum + 7 gün (sabit)
    const anzahlungDate = addDays(reservation.buchung, 7);

    // 2. Restzahlung: seçilen tarih ± restzahlung gün
    let baseDate;
    if (rbiBerechnung === 'Buchungsdatum') baseDate = reservation.buchung;
    else if (rbiBerechnung === 'Rückreisedatum') baseDate = reservation.ruckreise;
    else baseDate = reservation.abreise;

    const offset = rbiModel === 'Nacher' ? restzahlung : -restzahlung;
    const restDate = addDays(baseDate, offset);

    const payments = [];
    if (anzahlungDate) payments.push({ date: anzahlungDate, amount: anzahlungAmount, label: 'Anz.' });
    if (restDate) payments.push({ date: restDate, amount: restAmount, label: 'Rest' });

    return {
      kasseTyp: 'RBI',
      payments
    };
  }
}

/**
 * Tarihe göre renk döndürür:
 * - Vadesi geçmiş → kırmızı
 * - Bu hafta vadesi dolacak → sarı
 * - Gelecek → normal
 */
export function getPaymentDateColor(date) {
  if (!date) return 'var(--text2)';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (date < today) return '#ef4444';
  if (date <= nextWeek) return '#f59e0b';
  return 'var(--text)';
}
