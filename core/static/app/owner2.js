/* Firaao v2 owner screens, part 2: bookings, offers (campaigns), insights, my shop (QR, branding, rules, services, team), billing. */
(function (FX) {
  'use strict';
  const { h, api, S, field, inp, sel, pill, empty, kpi, toast, modal, busy, confirmBox } = FX;
  const t = FX.t, R = FX.routes.owner;
  const code = () => S.biz.shop_code;

  /* ---------- bookings (owner + staff) ---------- */
  async function bookingsPage() {
    const tab = (location.hash.split('/')[1]) || 'open';
    const q = tab === 'today' ? '?when=today' : tab === 'history' ? '?status=completed' : '?status=open';
    const list = await api('b/' + code() + '/bookings/' + q);
    const done = () => FX.render(true);
    return h('div.stack.l', h('h1', t('Bookings')),
      h('div.seg', [['open', 'Upcoming'], ['today', 'Today'], ['history', 'Completed']].map(([k, l]) => h('button', { 'aria-selected': String(k === tab), onclick: () => FX.go('bookings/' + k) }, t(l)))),
      h('div.card', list.length ? (tab === 'history' ? list.map(b => h('div.li', h('div.grow', h('b', b.customer + ' · ' + b.service_name), h('div.small.muted', FX.fmtDT(b.starts_at))), b.rated ? pill('★', 'ok') : null)) : FX.bookingQueue(list, done)) : empty('Nothing here', 'Booking requests from customers appear here.')));
  }
  R.bookings = FX.routes.staff.bookings = bookingsPage;

  /* ---------- offers / campaigns ---------- */
  R.campaigns = async function (args) {
    let seg = FX.SEG.some(s => s[0] === args[0]) && args[0] !== 'never' ? args[0] : 'all';
    const text = h('textarea', { maxlength: 200, placeholder: t('e.g. We miss you! Show this message for double stamps this week.') });
    const info = h('p.muted'), count = h('small.muted', '0/200');
    text.addEventListener('input', () => { count.textContent = text.value.length + '/200'; });
    const SAMPLES = { at_risk: 'We miss you! Visit this week and earn double stamps.', lapsed: 'It has been a while. Come back and we will add a welcome-back gift.', new: 'Thanks for joining! Visit again this week to earn your next stamp faster.', regular: 'You are one of our best customers. A thank-you treat is waiting for you.', all: 'Double stamps this weekend. See you soon!' };
    const chipsBox = h('div'), go = h('button.btn.lg', { onclick: () => busy(go, async () => { if (!text.value.trim()) throw new Error(t('Write the offer text.')); const r = await api('b/' + code() + '/campaign/', 'POST', { text: text.value, segment: seg }); toast(t('Sent to {n} customers', { n: r.sent })); text.value = ''; }) }, t('Send offer'));
    const draw = async () => {
      chipsBox.replaceChildren(h('div.chips', FX.SEG.filter(s => s[0] !== 'never').map(([k, l]) => h('button.chip', { 'aria-pressed': String(k === seg), onclick: () => { seg = k; if (!text.value) text.value = ''; draw(); } }, t(l)))));
      try { const r = await api('b/' + code() + '/campaign/?segment=' + seg); info.textContent = t('{n} customers will receive this (only those who agreed to offers).', { n: r.audience }); go.disabled = !r.audience; } catch (e) { info.textContent = e.message; }
    };
    await draw();
    /* win-back gift: a real, short-lived reward code for people who stopped coming. Far stronger than a message alone. */
    let gseg = 'lapsed', gdays = 7;
    const gtitle = inp({ maxlength: 120, ph: 'e.g. Free cookie with any drink' }), gtext = inp({ maxlength: 100, ph: 'We miss you! A gift is waiting for you.' });
    const gInfo = h('p.muted'), gChips = h('div'), gDays = h('div.chips');
    const IDEAS = ['Free cookie with any drink', 'Free chai on your next visit', '10% off your next bill', 'Free delivery this week'];
    const gBtn = h('button.btn.lg.gold', { onclick: () => busy(gBtn, async () => {
      if (!gtitle.value.trim()) throw new Error(t('Name the gift, for example: Free cookie.'));
      const r = await api('b/' + code() + '/winback/', 'POST', { segment: gseg, title: gtitle.value, expiry_days: gdays, text: gtext.value });
      toast(t('Gift sent to {n} customers', { n: r.sent })); gtitle.value = ''; gtext.value = ''; drawG();
    }) }, '🎁 ' + t('Send gift'));
    const drawG = async () => {
      gChips.replaceChildren(h('div.chips', [['at_risk', 'Slipping away'], ['lapsed', 'Lapsed'], ['new', 'New'], ['regular', 'Regular']].map(([k, l]) => h('button.chip', { 'aria-pressed': String(k === gseg), onclick: () => { gseg = k; drawG(); } }, t(l)))));
      gDays.replaceChildren(...[3, 7, 14, 30].map(d => h('button.chip', { 'aria-pressed': String(d === gdays), onclick: () => { gdays = d; drawG(); } }, t('{n} days', { n: d }))));
      try { const r = await api('b/' + code() + '/winback/?segment=' + gseg); gInfo.textContent = t('{n} customers will get a gift code (only those who agreed to offers).', { n: r.audience }); gBtn.disabled = !r.audience; } catch (e) { gInfo.textContent = e.message; }
    };
    await drawG();
    const giftCard = h('div.card.stack', h('div', h('h3', '🎁 ' + t('Win-back gift')), h('p.muted.small', t('Give people who stopped visiting a real reward code that expires soon. They get a notification and show the code at the counter.'))),
      gChips, h('div.chips', IDEAS.map(i => h('button.chip', { onclick: () => { gtitle.value = t(i); } }, t(i)))),
      field('Gift', gtitle), field('Message (optional)', gtext), h('div.field', h('span', t('Valid for')), gDays), gInfo, gBtn);
    return h('div.stack.l', { style: 'max-width:680px' }, h('div', h('h1', t('Bring customers back')), h('p.muted', t('Send a gift or a message to customers who agreed to receive offers.'))), giftCard,
      h('div.card.stack', h('h3', '💬 ' + t('Send a message')), h('small.muted', t('Who should get it?')), chipsBox, info, field('Message', text), h('div.row.between', count, h('button.btn.ghost.sm', { onclick: () => { text.value = t(SAMPLES[seg]); text.dispatchEvent(new Event('input')); } }, t('Use a sample'))), go),
      h('p.small.muted', t('To protect customers, each audience can get one offer a day and you can send up to 3 a day.')));
  };

  /* ---------- insights ---------- */
  R.insights = async function () {
    const days = +(location.hash.split('/')[1]) || 30;
    const [d, fb] = await Promise.all([api('b/' + code() + '/insights/?days=' + days), api('b/' + code() + '/feedback/')]);
    const k = d.kpis, segName = Object.fromEntries(FX.SEG);
    const maxHour = Math.max(1, ...d.hours.map(x => x.count));
    return h('div.stack.l', h('div.hd', h('div', h('h1', t('Insights')), h('p.muted', t('See who comes back and when'))),
      h('div.seg', [7, 30, 90].map(n => h('button', { 'aria-selected': String(n === days), onclick: () => FX.go('insights/' + n) }, t('{n} days', { n }))))),
      h('div.g4', kpi('Customers', k.customers), kpi('New customers', k.new_in_period), kpi('Come back rate', k.repeat_rate + '%'), kpi('Returning visits', k.returning_share + '%', t('of {n} visits', { n: k.visits_in_period }))),
      h('div.g4', kpi('Tracked sales', FX.rupee(k.tracked_sales), t('Spend-type tasks only')), kpi('Rewards used', k.redeem_rate + '%', t('{a} of {b} issued', { a: k.rewards_redeemed, b: k.rewards_issued })), kpi('Average rating', k.rating_avg ? k.rating_avg + ' ★' : '-', t('{n} reviews', { n: k.rating_count })), kpi('Upcoming bookings', k.bookings_upcoming)),
      h('div.card', h('h3', t('Visits per day')), FX.barChart(d.series, 'visits')),
      h('div.g2', h('div.card', h('h3', t('Busiest days')), FX.hbars(d.weekday.map((n, i) => [FX.wd(i), n]))),
        h('div.card', h('h3', t('Customer groups')), FX.hbars(Object.entries(d.segments).map(([s, n]) => [t(segName[s] || s), n])))),
      d.hours.length ? h('div.card', h('h3', t('Busiest hours')), FX.hbars(d.hours.map(x => [(x.hour % 12 || 12) + (x.hour < 12 ? ' am' : ' pm'), x.count]))) : null,
      h('div.card', h('h3', t('Recent feedback')), fb.length ? fb.slice(0, 10).map(f => h('div.li', h('div.grow', FX.stars(f.rating), f.comment ? h('p.small', f.comment) : null, h('small.muted', f.customer + ' · ' + FX.ago(f.created_at))))) : empty('No feedback yet', 'Customers can rate a visit after it is approved.')));
  };

  /* ---------- my shop ---------- */
  /* ---------- the one QR card: shop details + QR on a single image (download / share only) ---------- */
  const loadImg = src => new Promise(res => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  function wrapText(ctx, text, maxW, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; let l = lines[maxLines - 1]; while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); lines[maxLines - 1] = l + '…'; }
    return lines;
  }
  async function drawQrCard(b) {
    const W = 1080, H = 1560, FONT = 'Inter, "Noto Sans Devanagari", -apple-system, "Segoe UI", sans-serif', hi = b.language === 'hi';
    try { await Promise.all([document.fonts.load('800 60px Inter'), document.fonts.load('500 30px Inter'), document.fonts.load('700 40px "Noto Sans Devanagari"')]); } catch (e) { /* system font fallback */ }
    const [qr, logo] = await Promise.all([loadImg('/api/b/' + b.shop_code + '/qr.png'), b.logo_url ? loadImg(b.logo_url) : null]);
    if (!qr) throw new Error(t('Could not load the QR code. Check your connection.'));
    const brand = /^#[0-9a-f]{6}$/i.test(b.brand_color || '') ? b.brand_color : '#5e35b1', onBrand = lum(brand) > .6 ? '#1c1530' : '#ffffff';
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const rr = (px, py, w, hh, r) => { x.beginPath(); x.roundRect ? x.roundRect(px, py, w, hh, r) : x.rect(px, py, w, hh); };
    x.fillStyle = brand; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff'; rr(48, 48, W - 96, 1464, 56); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    /* logo or initial */
    x.save(); x.beginPath(); x.arc(W / 2, 178, 72, 0, Math.PI * 2); x.clip();
    if (logo) { const k = Math.max(144 / logo.width, 144 / logo.height); x.fillStyle = '#fff'; x.fillRect(W / 2 - 72, 106, 144, 144); x.drawImage(logo, W / 2 - logo.width * k / 2, 178 - logo.height * k / 2, logo.width * k, logo.height * k); }
    else { x.fillStyle = brand; x.fillRect(W / 2 - 72, 106, 144, 144); }
    x.restore();
    if (!logo) { x.fillStyle = onBrand; x.font = '800 78px ' + FONT; x.fillText((b.name || '?').trim().charAt(0).toUpperCase(), W / 2, 205); }
    /* name + tagline */
    x.fillStyle = '#1c1530'; let size = 68, lines; do { x.font = '800 ' + size + 'px ' + FONT; lines = wrapText(x, b.name, 860, 2); size -= 4; } while (lines.length > 1 && size > 44 && lines.some(l => x.measureText(l).width > 860));
    lines = wrapText(x, b.name, 860, 2); let y = 318; lines.forEach(l => { x.fillText(l, W / 2, y); y += size + 18; });
    if (b.tagline) { x.fillStyle = '#6b6485'; x.font = '500 32px ' + FONT; wrapText(x, b.tagline, 860, 1).forEach(l => { x.fillText(l, W / 2, y + 4); y += 40; }); }
    /* QR in a brand-coloured frame */
    const qy = Math.max(y + 24, 470), qs = 600;
    x.strokeStyle = brand; x.lineWidth = 10; rr(W / 2 - qs / 2 - 20, qy - 20, qs + 40, qs + 40, 36); x.stroke();
    x.imageSmoothingEnabled = false; x.drawImage(qr, W / 2 - qs / 2, qy, qs, qs);
    /* call to action */
    const cy = qy + qs + 70; x.font = '800 46px ' + FONT; const label = hi ? 'स्कैन करें और इनाम पाएं' : 'Scan to join rewards', pw = Math.min(900, x.measureText(label).width + 120);
    x.fillStyle = brand; rr(W / 2 - pw / 2, cy, pw, 100, 50); x.fill(); x.fillStyle = onBrand; x.fillText(label, W / 2, cy + 66);
    x.fillStyle = '#6b6485'; x.font = '500 30px ' + FONT; x.fillText(hi ? 'Firaao पर स्टैम्प और रिवॉर्ड पाएं' : 'Collect stamps and rewards on Firaao', W / 2, cy + 160);
    /* shop details, as many lines as fit */
    const info = [b.address, [b.hours, b.phone].filter(Boolean).join('  ·  '), b.pay_upi_id ? 'UPI: ' + b.pay_upi_id : ''].filter(Boolean);
    x.fillStyle = '#4a4466'; x.font = '500 28px ' + FONT; let iy = cy + 222, left = Math.floor((1496 - iy) / 38);
    for (const row of info) { for (const l of wrapText(x, row, 880, Math.min(2, left))) { if (left <= 0) break; x.fillText(l, W / 2, iy); iy += 38; left--; } }
    x.globalAlpha = .85; x.fillStyle = onBrand; x.font = '700 24px ' + FONT; x.fillText('Powered by Firaao', W / 2, H - 20); x.globalAlpha = 1;
    return c;
  }
  function qrCard() {
    const b = S.biz, url = location.origin + '/b/' + b.shop_code + '/', box = h('div', { style: 'display:grid;place-items:center;min-height:240px' }, h('div.spin'));
    let canvas = null;
    const blob = () => new Promise((res, rej) => canvas.toBlob(x => (x ? res(x) : rej(new Error(t('Something went wrong. Please try again.')))), 'image/png'));
    const fname = (b.name || 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop';
    const mark = () => { localStorage['fx_printed_' + b.shop_code] = '1'; };
    const download = btn => busy(btn, async () => {
      const f = await blob(), a = h('a', { href: URL.createObjectURL(f), download: fname + '-qr.png' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); mark();
    });
    const shareCard = btn => busy(btn, async () => {
      const f = new File([await blob()], fname + '-qr.png', { type: 'image/png' }), text = t('Collect rewards at {shop}', { shop: b.name });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: text + ' ' + url }); mark(); } catch (e) { if (e.name !== 'AbortError') throw e; } }
      else FX.share(text, url);
    });
    drawQrCard(b).then(c => { canvas = c; c.setAttribute('role', 'img'); c.setAttribute('aria-label', t('Your QR code')); c.style.cssText = 'width:100%;max-width:340px;height:auto;border-radius:16px;box-shadow:0 8px 26px -10px #0004'; box.replaceChildren(c); })
      .catch(e => box.replaceChildren(h('p.err', e.message), h('button.btn.ghost.sm', { onclick: () => FX.render(true) }, t('Try again'))));
    return h('div.card.stack', h('h3', t('Your QR card')), h('p.muted.small', t('One card with your shop details and QR code. Download it to print, or share it on WhatsApp.')), box,
      h('div.stack.s', { style: 'width:100%;max-width:340px;margin:0 auto' }, h('button.btn', { onclick: e => { if (canvas) download(e.currentTarget); } }, t('Download')), h('button.btn.ghost', { onclick: e => { if (canvas) shareCard(e.currentTarget); } }, t('Share'))),
      h('div.stack.s', { style: 'text-align:center' }, h('small.muted', t('Your shop link')), h('code', { style: 'word-break:break-all;font-size:calc(12.5px * var(--font-scale, .8))' }, url),
        h('div.row.wrap', { style: 'justify-content:center' }, h('button.btn.ghost.sm', { onclick: () => FX.copy(url) }, t('Copy link')), h('a.btn.ghost.sm', { href: '#/counter' }, t('Counter code screen')))));
  }
  function servicesCard(biz) {
    const box = h('div.stack.s');
    const edit = (s) => {
      const name = inp({ value: s ? s.name : '', maxlength: 80 }), price = inp({ type: 'number', min: '0', value: s ? s.price : 0 }), dur = inp({ type: 'number', min: '5', max: '600', value: s ? s.duration_min : 30 });
      const m = modal(t(s ? 'Edit service' : 'New service'), h('div.stack', field('Name', name), h('div.g2', field('Price (₹)', price), field('Minutes', dur)), h('div.row',
        s ? h('button.btn.danger', { onclick: e => busy(e.target, async () => { await api('services/' + s.id + '/', 'DELETE'); m.close(); load(); }) }, t('Delete')) : null,
        h('button.btn.grow', { onclick: e => busy(e.target, async () => { const b = { name: name.value, price: price.value, duration_min: dur.value }; await api(s ? 'services/' + s.id + '/' : 'b/' + code() + '/services/', s ? 'PATCH' : 'POST', b); m.close(); load(); }) }, t('Save')))));
    };
    const load = async () => { const l = await api('b/' + code() + '/services/'); box.replaceChildren(...(l.length ? l.map(s => h('div.li.click', { onclick: () => edit(s) }, h('span.grow', s.name + (s.active ? '' : ' (' + t('hidden') + ')')), h('small.muted', s.duration_min + ' min'), h('b.num', FX.rupee(s.price)))) : [h('p.muted', t('Add the services customers can book.'))])); };
    load();
    const on = h('input', { type: 'checkbox', checked: biz.bookings_enabled, onchange: e => busy(e.target, async () => { await api('b/' + code() + '/settings/', 'PATCH', { bookings_enabled: e.target.checked }); await FX.reloadShops(); toast(t('Saved')); }) });
    return h('div.card.stack', h('div.hd', h('h3', t('Services and bookings')), h('button.btn.soft.sm', { onclick: () => edit(null) }, '+ ' + t('Add service'))),
      h('label.check', on, h('span', t('Let customers request appointments online'))), box,
      h('small.muted', t('When you mark a booking completed, the visit is added to your reward programs automatically.')));
  }
  function teamCard() {
    const box = h('div.stack.s');
    const load = async () => { const l = await api('b/' + code() + '/staff/'); box.replaceChildren(...(l.length ? l.map(s => h('div.li', h('span.grow', s.name || s.mobile, h('small.muted', ' ' + s.mobile)), h('button.btn.danger.sm', { onclick: async () => { if (await confirmBox(t('Remove this team member?'), t('Remove'), true)) { await api('b/' + code() + '/staff/', 'DELETE', { mobile: s.mobile }); load(); } } }, t('Remove')))) : [h('p.muted', t('Add a cashier so they can approve purchases and redeem rewards.'))])); };
    load();
    const add = () => { const n = inp({ maxlength: 60 }), mo = inp({ type: 'tel' }), pw = inp({ type: 'password', autocomplete: 'new-password' });
      const m = modal(t('Add team member'), h('div.stack', field('Name', n), field('Mobile number', mo), field('Password', pw, 'They log in with their mobile number and this password.'), h('button.btn', { onclick: e => busy(e.target, async () => { await api('b/' + code() + '/staff/', 'POST', { name: n.value, mobile: mo.value.trim(), password: pw.value }); m.close(); load(); }) }, t('Add')))); };
    return h('div.card.stack', h('div.hd', h('h3', t('Team')), h('button.btn.soft.sm', { onclick: add }, '+ ' + t('Add'))), box);
  }
  R.shop = async function () {
    const b = S.biz, url = location.origin + '/b/' + b.shop_code + '/';
    const f = { name: inp({ value: b.name, maxlength: 120 }), tagline: inp({ value: b.tagline, maxlength: 140 }), about: h('textarea', { maxlength: 600, value: b.about }), address: inp({ value: b.address }), hours: inp({ value: b.hours, ph: 'e.g. Mon-Sat 9am-9pm' }),
      phone: inp({ type: 'tel', value: b.phone }), whatsapp: inp({ type: 'tel', value: b.whatsapp, ph: 'with country code, e.g. 919876543210' }), maps_url: inp({ type: 'url', value: b.maps_url, ph: 'https://maps.google.com/...' }), pay_upi_id: inp({ value: b.pay_upi_id || '' }),
      brand_color: h('input', { type: 'color', value: b.brand_color || '#5e35b1' }), language: sel([['en', 'English'], ['hi', 'हिन्दी']], b.language) };
    const logo = h('input', { type: 'file', accept: 'image/*' });
    const rules = { approval_mode: sel([['manual', 'I approve each purchase'], ['auto', 'Approve automatically']], b.approval_mode), cooldown_minutes: inp({ type: 'number', min: '0', value: b.cooldown_minutes }), daily_cap: inp({ type: 'number', min: '1', value: b.daily_cap }), max_distance_m: inp({ type: 'number', min: '0', value: b.max_distance_m || 0 }), require_bill_photo: h('input', { type: 'checkbox', checked: b.require_bill_photo }) };
    let pos = null;
    const save = (fields, extra) => async e => busy(e.target, async () => {
      let body;
      if (extra && extra.logo && extra.logo.files[0]) { body = new FormData(); body.append('logo', extra.logo.files[0]); for (const [k, v] of Object.entries(fields)) body.append(k, v.type === 'checkbox' ? v.checked : v.value); }
      else { body = {}; for (const [k, v] of Object.entries(fields)) body[k] = v.type === 'checkbox' ? v.checked : v.value; if (pos && extra && extra.geo) { body.lat = pos.latitude; body.lng = pos.longitude; } }
      if (body instanceof FormData && pos && extra.geo) { body.append('lat', pos.latitude); body.append('lng', pos.longitude); }
      await api('b/' + code() + '/settings/', 'PATCH', body); await FX.reloadShops(); toast(t('Saved')); FX.render(true);
    });
    return h('div.stack.l', { style: 'max-width:820px;min-width:0' }, h('h1', t('My shop')),
      qrCard(),
      h('div.card.stack', h('h3', t('Shop page')), h('div.g2', field('Shop name', f.name), field('Tagline', f.tagline)), field('About', f.about), h('div.g2', field('Address', f.address), field('Opening hours', f.hours)),
        h('div.g2', field('Phone', f.phone), field('WhatsApp', f.whatsapp)), field('Google Maps link', f.maps_url), h('div.g2', field('UPI ID', f.pay_upi_id), field('Language', f.language)),
        h('div.g2', field('Brand colour', f.brand_color), field('Logo', logo)), h('button.btn', { style: 'justify-self:start', onclick: save(f, { logo }) }, t('Save shop page'))),
      h('div.card.stack', h('h3', t('Purchase rules')), field('Approval', rules.approval_mode), h('div.g2', field('Minutes between purchases', rules.cooldown_minutes), field('Purchases per day', rules.daily_cap)),
        h('label.check', rules.require_bill_photo, h('span', t('Ask customers for a bill photo'))), field('Shop radius (metres, 0 = off)', rules.max_distance_m, 'Purchases from farther away are flagged for your review.'),
        h('button.btn.ghost.sm', { style: 'justify-self:start', onclick: async e => { pos = await FX.getPos(); toast(pos ? t('Shop location captured. Press Save.') : t('Location unavailable.'), !pos); } }, t('Use my current location as the shop location')),
        h('button.btn', { style: 'justify-self:start', onclick: save(rules, { geo: true }) }, t('Save rules'))),
      servicesCard(b), teamCard(),
      h('div.card.stack', h('h3', t('Danger zone')), h('p.muted.small', t('Making a new QR code stops the old printed QR from working.')),
        h('button.btn.danger', { style: 'justify-self:start', onclick: async () => { if (await confirmBox(t('Make a new QR code? Printed QR codes will stop working.'), t('Make new QR'), true)) { const r = await api('b/' + code() + '/regenerate-qr/', 'POST'); localStorage.fx_biz = r.shop_code; await FX.reloadShops(); FX.render(); } } }, t('Make a new QR code'))));
  };

  /* ---------- billing ---------- */
  const loadRz = () => new Promise((res, rej) => { if (window.Razorpay) return res(); const s = h('script', { src: 'https://checkout.razorpay.com/v1/checkout.js', onload: res, onerror: () => rej(new Error(t('Could not load the payment window. Check your connection.'))) }); document.head.appendChild(s); });
  R.billing = async function () {
    const s = await FX.loadSub();
    const plan = k => s.plans[k];
    const checkout = k => async e => busy(e.target, async () => {
      const order = await api('billing/order/', 'POST', { plan: k }); await loadRz();
      const widget = new window.Razorpay({ key: order.key, order_id: order.order_id, amount: order.amount,
        currency: order.currency, name: 'Firaao', description: plan(k).label, theme: { color: '#5e35b1' },
        handler: async resp => { try { await api('billing/verify/', 'POST', resp); toast(t('Payment received. Thank you!')); await FX.loadSub(); FX.render(); } catch (x) { toast(x.message, true); } } });
      widget.on('payment.failed', resp => toast(resp.error?.description || t('Payment failed. Please try again.'), true));
      widget.open();
    });
    const subscribe = k => async e => busy(e.target, async () => {
      const r = await api('billing/autopay/', 'POST', { plan: k }); await loadRz();
      new window.Razorpay({ key: r.key, subscription_id: r.subscription_id, name: 'Firaao', description: plan(k).label, theme: { color: '#5e35b1' },
        handler: async resp => { try { await api('billing/autopay/verify/', 'POST', { razorpay_payment_id: resp.razorpay_payment_id, razorpay_subscription_id: resp.razorpay_subscription_id, razorpay_signature: resp.razorpay_signature }); toast(t('Payment received. Thank you!')); await FX.loadSub(); FX.render(); } catch (x) { toast(x.message, true); } } }).open();
    });
    const payUpi = k => {
      const utr = inp({ maxlength: 20, autocomplete: 'off', required: true });
      const proof = inp({ type: 'file', accept: 'image/*', required: true });
      const error = h('div.err', { role: 'alert' });
      const form = h('form.stack', { onsubmit: async e => {
        e.preventDefault();
        if (!utr.value.trim() || !proof.files.length) { error.textContent = t('Enter the transaction reference and attach a payment screenshot.'); return; }
        const data = new FormData(); data.append('plan', k); data.append('utr', utr.value.trim()); data.append('proof', proof.files[0]);
        try {
          await api('billing/upi/', 'POST', data); dialog.close(); toast(t('UPI payment submitted for admin verification.'));
          await FX.loadSub(); FX.render();
        } catch (x) { error.textContent = x.message; }
      } },
        h('p.muted', t('Pay exactly {a} to the platform UPI ID, then upload the completed-payment screenshot and UTR.', { a: FX.rupee(plan(k).amount / 100) })),
        h('p', h('b', t('Platform UPI ID: {upi}', { upi: s.upi_id }))),
        h('img', { src: '/api/billing/upi-qr.png?plan=' + encodeURIComponent(k) + '&ref=' + encodeURIComponent(s.owner_ref),
          alt: t('UPI payment QR code'), width: 220, height: 220, style: 'justify-self:center;background:#fff' }),
        h('a.btn.ghost', { href: s.upi_links[k] }, t('Open UPI app')),
        field('UPI transaction reference / UTR', utr),
        field('Payment screenshot (image, up to 5 MB)', proof),
        error, h('button.btn', { type: 'submit' }, t('Submit for admin verification')));
      const dialog = modal(t('Pay by UPI'), form);
    };
    const methods = s.payment_methods || {}, saving = s.yearly_saving || 0;
    const live = s.state === 'active' || s.state === 'trial';
    const pct = s.state === 'trial' ? Math.max(4, Math.min(100, Math.round(100 * (s.trial_days - s.days_until_end) / s.trial_days))) : 100;
    const stateHead = { trial: t('Free trial: {n} days left', { n: s.days_until_end }), active: t('Active until {d}', { d: FX.fmtDate(s.ends) }),
      grace: t('Plan ended. Your shop is paused.'), expired: t('Plan ended') }[s.state] || s.state;
    const stateSub = s.state === 'grace' ? t('Renew within {n} days to keep everything.', { n: Math.max(0, Math.ceil((new Date(s.data_until) - Date.now()) / 864e5)) })
      : s.state === 'expired' ? t('Renew any time to restore your QR, customers and rewards.')
      : s.autorenew ? t('AutoPay is on. Next charge on {d}.', { d: FX.fmtDate(s.next_charge || s.ends) })
      : s.state === 'trial' ? t('Pick a plan before it ends to keep your shop live.') : t('Renew before it ends to avoid a pause.');
    const pendingBox = s.pending_payment ? h('div.banner.blue', h('div.grow', h('b', '⏳ ' + t('UPI payment verification pending')), h('div.small', t('Transaction reference: {utr}. Your plan activates after an admin verifies the payment.', { utr: s.pending_payment.utr || '—' })))) : null;
    const rejectedBox = s.last_rejected ? h('div.banner.red', h('div.grow', h('b', t('We could not verify your last UPI payment')), h('div.small', t('Reference {utr}. Check the amount and reference, then submit it again below.', { utr: s.last_rejected.utr || '—' })))) : null;
    const FEATURES = ['Unlimited customers and rewards', 'Counter code and instant approvals', 'Offers, boosts and bookings', 'Insights, CSV export and print kit', 'Hindi and English for your customers'];
    const planCard = k => {
      const p = plan(k), best = k === 'yearly', per = best ? p.amount / 100 / 12 : null;
      return h('div.plan' + (best ? '.best' : ''), best && saving ? h('span.ribbon', t('Save {a}', { a: FX.rupee(saving / 100) })) : null,
        h('div', h('h3', t(p.label)), h('div.price', FX.rupee(p.amount / 100), h('small', ' / ' + t(best ? 'year' : 'month')))),
        h('small.muted', best ? t('Just {a} a month. Includes GST.', { a: FX.rupee(Math.round(per)) }) : t('Includes GST. {n} days.', { n: p.days })),
        h('ul', FEATURES.map(f => h('li', t(f)))),
        methods.online ? h('button.btn.lg' + (best ? '.gold' : ''), { onclick: checkout(k) }, t('Pay securely with Razorpay')) : null,
        methods.upi ? h('button.btn.ghost', { onclick: () => payUpi(k) }, t('Pay by UPI and upload screenshot')) : null,
        s.autopay && !s.autorenew && !s.autopay_pending ? h('button.btn.ghost', { onclick: subscribe(k) }, t('Enable AutoPay')) : null,
        !methods.online && !methods.upi && !s.autopay ? h('p.small.muted', t('Online payments are not set up yet. Please contact support.')) : null);
    };
    /* AutoPay first: set it up once, never think about renewals again. No charge before the current period ends. */
    const firstCharge = s.state === 'trial' ? t('Nothing is charged until your free trial ends on {d}.', { d: FX.fmtDate(s.ends) })
      : s.state === 'active' ? t('The first AutoPay charge is on {d}, when your current plan ends.', { d: FX.fmtDate(s.ends) }) : t('Your first AutoPay charge is today.');
    const autoCard = s.autopay && !s.autorenew && !s.autopay_pending ? h('div.card.stack', { style: 'border:2px solid var(--brand)' },
      h('div.row.between.wrap', h('div', h('h3', '⚡ ' + t('Never miss a renewal')), h('p.muted.small', t('Set up AutoPay once with UPI or a card. Cancel any time from this screen.'))), pill(t('Recommended'), 'ok')),
      h('p.small', firstCharge),
      h('div.g2', Object.keys(s.plans).map(k => { const p = plan(k), best = k === 'yearly';
        return h('button.btn' + (best ? '.gold' : '') + '.lg', { onclick: subscribe(k) }, t(p.label) + ' · ' + FX.rupee(p.amount / 100) + ' / ' + t(best ? 'year' : 'month') + (best && saving ? ' · ' + t('Save {a}', { a: FX.rupee(saving / 100) }) : '')); }))) : null;
    const METHOD = { gateway: 'Razorpay', upi: 'UPI' }, STAT = { paid: ['Paid', 'ok'], pending: ['Verifying', 'warn'], rejected: ['Not verified', 'bad'], refunded: ['Refunded', ''] };
    return h('div.stack.l', { style: 'max-width:860px' }, h('h1', t('Billing')),
      h('div.state-card' + (live ? (s.state === 'trial' ? '.trial' : '') : '.bad'),
        h('div.row.between.wrap', h('div', h('h2', stateHead), h('p', stateSub)), pill(t(s.state), live ? 'ok' : 'bad')),
        s.state === 'trial' ? h('div.meter', h('i', { style: { width: pct + '%' } })) : null),
      pendingBox, rejectedBox,
      s.payment_mode === 'test' ? h('p.card.small.muted', t('Razorpay test mode: payments are simulated and will not charge a real account.')) : null,
      autoCard,
      h('div.plans', Object.keys(s.plans).map(planCard)),
      s.autopay_pending ? h('p.small.muted', t('AutoPay setup is waiting for your approval in your UPI or card app.')) : null,
      s.autorenew || s.autopay_pending ? h('button.btn.danger', { style: 'justify-self:start', onclick: async () => { if (await confirmBox(t('Turn off AutoPay? Your plan stays active until it ends.'), t('Turn off'), true)) { await api('billing/autopay/cancel/', 'POST'); toast(t('AutoPay turned off')); FX.render(); } } }, t('Turn off AutoPay')) : null,
      s.payments && s.payments.length ? h('div.card.paylist', h('h3', t('Payment history')), s.payments.map(p => {
        const inv = s.invoices.find(i => i.no && i.no === p.invoice_no), st = STAT[p.status] || [p.status, ''];
        return h('div.li', h('div.grow', h('b', FX.rupee(p.amount / 100) + ' · ' + t((s.plans[p.plan] || { label: p.plan }).label)), h('small.muted', FX.fmtDate(p.created_at) + ' · ' + (METHOD[p.method] || p.method) + (p.invoice_no ? ' · ' + p.invoice_no : ''))),
          pill(t(st[0]), st[1]), inv ? h('a.btn.ghost.sm', { href: inv.url, target: '_blank', rel: 'noopener' }, t('Invoice')) : null);
      })) : null,
      h('p.small.muted', t('If payments stop, your data is kept for {m} months before deletion.', { m: s.retention_months })),
      h('p.small.muted', h('a', { href: '/refund/' }, t('Refund policy')), ' · ', h('a', { href: '/contact/' }, t('Need help? Contact us'))));
  };
})(window.FX);
