'use strict';

function bookingConfirmHtml(b, fare) {
  const brand = {
    name: 'Silver Service Taxi Sydney',
    phone: '1800 173 171',
    email: 'info@silvertaxisydneyservice.com',
    url: 'https://silvertaxisydneyservice.com',
    color: '#0f1f3d',
    gold: '#d4a63c',
  };
  const formatDate = (d, t) => {
    try {
      const [y, mo, dy] = (d || '').split('-').map(Number);
      const [hh, mm]    = (t || '00:00').split(':').map(Number);
      const dt = new Date(y, mo - 1, dy, hh, mm);
      const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const ampm   = hh >= 12 ? 'pm' : 'am';
      const h12    = hh % 12 || 12;
      const minStr = mm > 0 ? `:${String(mm).padStart(2, '0')}` : '';
      return `${days[dt.getDay()]}, ${dy} ${months[mo - 1]} ${y} at ${h12}${minStr} ${ampm}`;
    } catch (e) { return `${d} at ${t}`; }
  };
  const dt = formatDate(b.date, b.time);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:${brand.color};padding:32px 24px;text-align:center">
    <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#fff">SILVER SERVICE</div>
    <div style="font-size:12px;font-weight:700;letter-spacing:4px;color:${brand.gold};margin-top:4px">TAXI SYDNEY</div>
  </div>
  <div style="padding:32px 24px">
    <h2 style="color:${brand.color};margin:0 0 8px">Booking Confirmed</h2>
    <p style="color:#6b7a99;margin:0 0 24px">Hi ${b.name}, your booking is confirmed.</p>
    <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#6b7a99;width:130px">Booking Ref</td><td style="padding:6px 0;color:#0f1f3d;font-weight:700">#${b.ref}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Date &amp; Time</td><td style="padding:6px 0;color:#0f1f3d">${dt}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Pickup</td><td style="padding:6px 0;color:#0f1f3d">${b.pickup}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Drop-off</td><td style="padding:6px 0;color:#0f1f3d">${b.dropoff}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Vehicle</td><td style="padding:6px 0;color:#0f1f3d">${b.vehicle || 'Sedan'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Fare</td><td style="padding:6px 0;color:#0f1f3d;font-weight:700">${b.fare}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Payment</td><td style="padding:6px 0;color:#0f1f3d">${b.payment || 'Cash in Vehicle'}</td></tr>
        ${b.flightNumber ? `<tr><td style="padding:6px 0;color:#6b7a99">Flight</td><td style="padding:6px 0;color:#0f1f3d">${b.flightNumber}</td></tr>` : ''}
      </table>
    </div>
    <p style="color:#6b7a99;font-size:13px">Need to modify or cancel? Visit <a href="${brand.url}/manage" style="color:${brand.color}">${brand.url}/manage</a> or call <a href="tel:${brand.phone}" style="color:${brand.color}">${brand.phone}</a></p>
  </div>
  <div style="background:${brand.color};padding:20px 24px;text-align:center">
    <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0">Premium Airport Transfers &bull; Executive Corporate Travel &bull; 24/7 Service</p>
    <p style="margin:8px 0 0"><a href="${brand.url}" style="color:${brand.gold};font-size:12px;text-decoration:none">${brand.url}</a></p>
  </div>
</div></body></html>`;
}

function receiptHtml(b, fare) {
  const brand = { color: '#0f1f3d', gold: '#d4a63c', url: 'https://silvertaxisydneyservice.com' };
  const f = fare || {};
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:${brand.color};padding:32px 24px;text-align:center">
    <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#fff">SILVER SERVICE</div>
    <div style="font-size:12px;font-weight:700;letter-spacing:4px;color:${brand.gold};margin-top:4px">TAXI SYDNEY</div>
    <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:12px">Payment Receipt</div>
  </div>
  <div style="padding:32px 24px">
    <h2 style="color:${brand.color};margin:0 0 8px">Receipt — #${b.ref}</h2>
    <p style="color:#6b7a99;margin:0 0 24px">Hi ${b.name}, thank you for your payment.</p>
    <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#6b7a99;width:130px">Booking Ref</td><td style="padding:6px 0;color:#0f1f3d;font-weight:700">#${b.ref}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Pickup</td><td style="padding:6px 0;color:#0f1f3d">${b.pickup}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Drop-off</td><td style="padding:6px 0;color:#0f1f3d">${b.dropoff}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7a99">Date</td><td style="padding:6px 0;color:#0f1f3d">${b.date} at ${b.time}</td></tr>
        ${f.sub ? `<tr><td style="padding:6px 0;color:#6b7a99">Base Fare</td><td style="padding:6px 0;color:#0f1f3d">$${(+f.sub).toFixed(2)}</td></tr>` : ''}
        ${f.tolls ? `<tr><td style="padding:6px 0;color:#6b7a99">Tolls</td><td style="padding:6px 0;color:#0f1f3d">$${(+f.tolls).toFixed(2)}</td></tr>` : ''}
        ${f.bookingFee ? `<tr><td style="padding:6px 0;color:#6b7a99">Booking Fee</td><td style="padding:6px 0;color:#0f1f3d">$${(+f.bookingFee).toFixed(2)}</td></tr>` : ''}
        ${f.govtLevy ? `<tr><td style="padding:6px 0;color:#6b7a99">Govt Levy</td><td style="padding:6px 0;color:#0f1f3d">$${(+f.govtLevy).toFixed(2)}</td></tr>` : ''}
        ${f.serviceFee ? `<tr><td style="padding:6px 0;color:#6b7a99">Card Fee (5%)</td><td style="padding:6px 0;color:#0f1f3d">$${(+f.serviceFee).toFixed(2)}</td></tr>` : ''}
        <tr style="border-top:2px solid #e8ecf4"><td style="padding:10px 0 6px;color:#0f1f3d;font-weight:700">Total Paid</td><td style="padding:10px 0 6px;color:#0f1f3d;font-weight:700;font-size:16px">${b.fare}</td></tr>
      </table>
    </div>
  </div>
  <div style="background:${brand.color};padding:20px 24px;text-align:center">
    <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0">Premium Airport Transfers &bull; Executive Corporate Travel &bull; 24/7 Service</p>
    <p style="margin:8px 0 0"><a href="${brand.url}" style="color:${brand.gold};font-size:12px;text-decoration:none">${brand.url}</a></p>
  </div>
</div></body></html>`;
}

function adminEmailHtml(b, fare, stripePayLink = null) {
  const f = fare || {};
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px">
  <h2 style="color:#0f1f3d;border-bottom:3px solid #d4a63c;padding-bottom:12px;margin:0 0 20px">New Booking — #${b.ref}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#6b7a99;width:130px">Name</td><td style="padding:6px 0;color:#0f1f3d;font-weight:700">${b.name}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Phone</td><td style="padding:6px 0"><a href="tel:${b.phone}" style="color:#144a8f">${b.phone}</a></td></tr>
    ${b.email ? `<tr><td style="padding:6px 0;color:#6b7a99">Email</td><td style="padding:6px 0"><a href="mailto:${b.email}" style="color:#144a8f">${b.email}</a></td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#6b7a99">Vehicle</td><td style="padding:6px 0;color:#0f1f3d">${b.vehicle}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Pickup</td><td style="padding:6px 0;color:#0f1f3d">${b.pickup}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Drop-off</td><td style="padding:6px 0;color:#0f1f3d">${b.dropoff}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Date</td><td style="padding:6px 0;color:#0f1f3d">${b.date} at ${b.time}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Fare</td><td style="padding:6px 0;color:#0f1f3d;font-weight:700">${b.fare}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7a99">Payment</td><td style="padding:6px 0;color:#0f1f3d">${b.payment || 'Cash in Vehicle'}</td></tr>
    ${b.flightNumber ? `<tr><td style="padding:6px 0;color:#6b7a99">Flight</td><td style="padding:6px 0;color:#0f1f3d">${b.flightNumber}</td></tr>` : ''}
    ${b.notes ? `<tr><td style="padding:6px 0;color:#6b7a99;vertical-align:top">Notes</td><td style="padding:6px 0;color:#0f1f3d">${b.notes}</td></tr>` : ''}
  </table>
  ${stripePayLink ? `<div style="margin-top:20px;padding:16px;background:#eef2fa;border-radius:8px"><b>Payment Link:</b> <a href="${stripePayLink}" style="color:#144a8f">${stripePayLink}</a></div>` : ''}
</div></body></html>`;
}

module.exports = { bookingConfirmHtml, receiptHtml, adminEmailHtml };
