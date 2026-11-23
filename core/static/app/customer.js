/* Firaao v2 customer screens: wallet home, shop page (earn / rewards / book / history / invite), rewards, bookings. */
(function (FX) {
  'use strict';
  const { h, t, api, S, field, inp, sel, pill, empty, avatar, stampRow, tierPill, toast, modal, busy } = Object.assign({}, FX, { t: FX.t, S: FX.S });
  const R = FX.routes.customer;
  const TYPE_HINT = { count: 'How many?', amount: 'Bill amount (₹)', visit: 'Visit' };

  /* ---------- home: one punch card per shop ---------- */
  function shopCard(s) {
    const b = s.best, tier = s.tier;
    return h('a.shopcard' + (s.active_rewards ? '.ready' : ''), { href: '/b/' + s.shop_code + '/', style: FX.shopVars(s.brand_color), 'aria-label': s.shop },
      h('div.row', h('div.logo-s', s.logo_url ? h('img', { src: s.logo_url, alt: '' }) : FX.initial(s.shop)), h('div.grow', h('h3', s.shop), h('small', t(s.category === 'other' ? 'Shop' : s.category.charAt(0).toUpperCase() + s.category.slice(1)))),
        tierPill(tier.tier)),
      b ? h('div.stack.s', h('div.row.between', h('small', b.title), h('small.num', FX.fmtVal(b.type, b.current) + ' / ' + FX.fmtVal(b.type, b.target))),
        stampRow(b.current, b.target, b.type) || h('div.meter', h('i', { style: { width: b.pct + '%' } })),
        b.rewards[0] ? h('small', t('Reward: {r}', { r: b.rewards[0].title })) : null) : h('small', t('Make your first purchase to start collecting.')),
      h('div.meta', s.active_rewards ? h('span.pill.glow', '🎁 ' + t('{n} reward ready', { n: s.active_rewards })) : null,
        s.streak ? h('span.pill', '🔥 ' + t('{n}-week streak', { n: s.streak })) : null,
        s.boosts_now[0] ? h('span.pill', '⚡ ' + s.boosts_now[0].multiplier + 'x ' + t('today')) : null,
        s.next_booking ? h('span.pill', '📅 ' + FX.fmtDT(s.next_booking.starts_at)) : null,
        tier.next ? h('small', t('{n} more visits to {tier}', { n: tier.to_next, tier: t(tier.next === 'gold' ? 'Gold' : 'Silver') })) : null));
  }
  R[''] = async function () {
    const w = await api('me/wallet/');
    const code = inp({ ph: 'Shop code', maxlength: 12, 'aria-label': t('Shop code') });
    const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const name = (S.user && S.user.name) || '';
    const hero = h('div.hero-me', h('div', h('h1', t(hello) + (name ? ', ' + name : '')),
      h('p', w.total_rewards ? t('{n} rewards ready to use', { n: w.total_rewards }) : w.shops.length ? t('Keep collecting. Your next reward is closer than you think.') : t('Scan a shop QR code to get your first stamp.'))),
      w.shops.length ? h('div.hero-stats', h('div.hero-stat', h('b', w.total_rewards), h('span', t('Rewards ready'))), h('div.hero-stat', h('b', w.shops.length), h('span', t('Shops'))), h('div.hero-stat', h('b', w.total_visits), h('span', t('Visits')))) : null);
    const how = h('div.card.stack', h('h3', t('How it works')),
      [['📷', 'Scan the QR code at the counter'], ['✅', 'Tap once after you buy to collect a stamp'], ['🎁', 'Show your reward pass and enjoy']].map(([e, x]) => h('div.row', h('span', { style: 'font-size:calc(26px * var(--font-scale, .8))' }, e), h('span', t(x)))));
    const tiles = FX.tiles([['🏪', 'Add shop', () => { code.focus(); code.scrollIntoView({ behavior: 'smooth', block: 'center' }); }], ['🎁', 'My rewards', '#/rewards', w.total_rewards || null], ['🔔', 'Alerts', FX.inbox, S.unread || null], ['👤', 'Account', '#/account']]);
    return h('div.stack.l', hero, tiles,
      w.shops.length ? h('div.section-t', t('My shops')) : null,
      w.shops.length ? h('div.g2', w.shops.map(shopCard)) : how,
      h('div.card.stack', h('h3', t('Add a shop by code')), h('div.row', code, h('button.btn', { onclick: () => { const c = code.value.trim(); if (c) location.href = '/b/' + encodeURIComponent(c) + '/'; } }, t('Open')))));
  };

  /* ---------- logged-out shop page (QR landing) ---------- */
  FX.publicShop = async function (code) {
    let biz;
    try { biz = await api('b/' + code + '/'); } catch (e) { return h('div.page', empty('Shop not found', 'Check the code and try again.', h('a.btn', { href: '/app/' }, t('Go to Firaao')))); }
    if (biz.paused) return h('div.page', empty(biz.name, 'This shop is not taking rewards right now.'));
    const perk = biz.perks && biz.perks.welcome;
    return h('div.page', { style: 'max-width:720px' }, head(biz),
      h('div.card.stack', { style: 'margin-top:16px' }, h('h2', t('Collect rewards at {shop}', { shop: biz.name })),
        h('p.muted', t('Join in 10 seconds with your mobile number. No app to install.')),
        perk ? h('div.banner.green', '🎁 ' + t('Welcome gift: {r}', { r: perk.title })) : null,
        biz.wheel ? h('div.banner.gold', '🎡 ' + t('Try your luck: {title}', { title: biz.wheel.title }) + ' · ' + biz.wheel.prizes.map(p => p.icon + ' ' + p.title).join('  ·  ')) : null,
        biz.boosts_now.length ? h('div.boost', '⚡ ' + biz.boosts_now[0].title + ' (' + biz.boosts_now[0].multiplier + 'x)') : null,
        biz.programs.slice(0, 1).map(p => h('div.stack.s', p.tasks.map(tk => h('div.li', h('span', '✦'), h('div.grow', h('b', tk.title), tk.rewards[0] ? h('div.small.muted', t('Reward: {r}', { r: tk.rewards[0].title })) : null))))),
        h('button.btn.lg', { onclick: () => { const m = modal(t('Join {shop}', { shop: biz.name }), FX.authScreen({ mode: 'register', role: 'customer' }).querySelector('.form')); } }, t('Join and start earning')),
        h('button.btn.ghost', { onclick: () => { const m = modal(t('Log in'), FX.authScreen({ mode: 'login' }).querySelector('.form')); } }, t('I already have an account'))),
      biz.services.length ? h('div.card', h('h3', t('Services')), biz.services.map(s => h('div.li', h('span.grow', s.name), h('b.num', FX.rupee(s.price))))) : null);
  };

  function head(biz) {
    const c = FX.shopVars(biz.brand_color);
    const links = [biz.phone && h('a.btn.ghost.sm', { href: 'tel:' + biz.phone }, t('Call')), biz.whatsapp && h('a.btn.ghost.sm', { href: 'https://wa.me/' + biz.whatsapp.replace(/\D/g, ''), target: '_blank', rel: 'noopener' }, 'WhatsApp'), biz.maps_url && h('a.btn.ghost.sm', { href: biz.maps_url, target: '_blank', rel: 'noopener' }, t('Directions'))].filter(Boolean);
    return h('div.stack', h('div.shophead', { style: c }, h('div.logo-s', biz.logo_url ? h('img', { src: biz.logo_url, alt: '' }) : FX.initial(biz.name)),
      h('div.grow', h('h1', biz.name), h('div.small', biz.tagline || biz.address || ''))),
      biz.about ? h('p.muted', biz.about) : null, biz.hours ? h('p.small.muted', t('Open: {h}', { h: biz.hours })) : null, links.length ? h('div.row.wrap', links) : null);
  }

  /* ---------- logged-in shop page ---------- */
  FX.shopPage = async function (code, tab) {
    let biz = await api('b/' + code + '/'), me;
    if (biz.paused) return empty(biz.name, 'This shop is not taking rewards right now.');
    try { me = await api('me/shop/' + code + '/'); } catch (e) { me = null; }
    if (!me) return joinView(biz);
    const asked = new URLSearchParams(location.search).get('tab');  // set when a notification is tapped
    tab = tab || (['earn', 'rewards', 'book', 'history', 'invite'].includes(asked) ? asked : null) || sessionStorage['tab_' + code] || 'earn';
    const body = h('div.stack');
    const tabs = [['earn', 'Earn'], ['rewards', 'Rewards' + (me.active_rewards ? ' (' + me.active_rewards + ')' : '')]];
    if (biz.bookings_enabled && biz.services.length) tabs.push(['book', 'Book']);
    tabs.push(['history', 'History'], ['invite', 'Invite']);
    const bar = h('div.seg', { role: 'tablist', style: 'overflow:auto;max-width:100%' });
    const draw = () => {
      sessionStorage['tab_' + code] = tab;
      bar.replaceChildren(...tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(k === tab), onclick: () => { tab = k; draw(); } }, t(l.split(' (')[0]) + (l.includes('(') ? ' (' + me.active_rewards + ')' : ''))));
      body.replaceChildren(({ earn: earnTab, rewards: rewardsTab, book: bookTab, history: historyTab, invite: inviteTab })[tab](biz, me));
    };
    const goTab = k => { tab = k; draw(); window.scrollTo({ top: bar.offsetTop - 70, behavior: 'smooth' }); };
    draw();
    watchPending(biz, me);
    const ti = me.tier;
    return h('div.stack.l', { style: Object.assign({ maxWidth: '760px', margin: '0 auto', width: '100%' }, FX.shopVars(biz.brand_color)) }, head(biz), focusCard(biz, me, goTab),
      h('div.card.row.between.wrap', h('div.row', tierPill(ti.tier), h('div', h('div.bold', t('{n} visits', { n: ti.visits })), ti.perk ? h('small.muted', ti.perk) : null)),
        ti.next ? h('small.muted', t('{n} more visits to {tier}', { n: ti.to_next, tier: t(ti.next === 'gold' ? 'Gold' : 'Silver') }) + (ti.next_perk ? ': ' + ti.next_perk : '')) : h('small.muted', t('Top tier reached')),
        streakView(me)),
      me.boosts_now[0] ? h('div.boost', '⚡ ' + t('{t}: earn {n}x stamps right now', { t: me.boosts_now[0].title, n: me.boosts_now[0].multiplier })) : null,
      bar, body);
  };

  /* what matters most right now: a ready reward, or how close the next one is */
  function focusCard(biz, me, goTab) {
    if (me.active_rewards) {
      return h('div.focus.ready', FX.ring(100, '🎁', '', 84), h('div.stack.s', h('h3', t('{n} reward ready to use', { n: me.active_rewards })),
        h('div.row.wrap', h('button.btn.gold', { onclick: () => goTab('rewards') }, t('Show my reward')), me.next_expiry ? h('small.muted', FX.until(me.next_expiry)) : null)));
    }
    const b = me.best;
    if (!b) return null;
    const left = Math.max(0, Number(b.target) - Number(b.current)), whole = Math.ceil(left - 1e-9);
    const msg = b.type === 'amount' ? t('Spend {a} more to unlock: {r}', { a: FX.rupee(left), r: b.rewards[0].title })
      : whole <= 1 ? t('One more to unlock: {r}', { r: b.rewards[0].title }) : t('{n} more to unlock: {r}', { n: whole, r: b.rewards[0].title });
    return h('div.focus', FX.ring(b.pct, Math.round(b.pct) + '%', t('done'), 84), h('div.stack.s', h('small.muted', b.title), h('h3', b.rewards[0].title), h('div.nudge', msg)));
  }
  function streakView(me) {
    if (!me.streak) return h('small.muted', t('Visit this week to start a streak'));
    const dots = h('div.week', Array.from({ length: Math.min(me.streak, 8) }, (_, i) => h('i.on' + (i === Math.min(me.streak, 8) - 1 && me.streak_this_week ? '.now' : ''), '🔥')));
    return h('div.stack.s', h('span.flame', '🔥 ' + t('{n}-week streak', { n: me.streak })), dots,
      me.streak_this_week ? null : h('small', { style: 'color:var(--red)' }, t('Visit this week to keep your streak')));
  }

  /* While a purchase waits for the shop, quietly check and celebrate the moment it is approved. */
  let watcher = null;
  function watchPending(biz, me) {
    clearInterval(watcher);
    const waiting = new Set(me.entries.filter(e => e.status === 'pending').map(e => e.id));
    if (!waiting.size) return;
    const seen = new Set(me.rewards.map(g => g.code));
    watcher = setInterval(async () => {
      if (document.hidden) return;
      if (!document.querySelector('.focus, .shophead')) { clearInterval(watcher); return; }
      let fresh;
      try { fresh = await api('me/shop/' + biz.shop_code + '/'); } catch (e) { return; }
      const done = fresh.entries.filter(e => waiting.has(e.id) && e.status !== 'pending');
      if (!done.length) return;
      clearInterval(watcher);
      await afterEntry(biz, fresh, seen, done.some(e => e.status === 'approved') ? 'approved' : 'rejected');
    }, 6000);
  }
  async function refreshShop(code) { const v = document.querySelector('#view'); if (v) v.replaceChildren(await FX.shopPage(code)); }
  /* one place decides the right celebration: reward unlocked > stamp added > declined > sent */
  async function afterEntry(biz, me, seenCodes, status) {
    const fresh = me.rewards.filter(g => g.status === 'active' && !seenCodes.has(g.code));
    if (fresh.length) {
      FX.celebrate({ icon: '🎁', big: true, title: t('Reward unlocked!'), text: fresh[0].title + (fresh.length > 1 ? ' +' + (fresh.length - 1) : ''),
        actions: [[t('Show reward pass'), () => passModal(fresh[0], biz.brand_color, biz.name)]] });
    } else if (status === 'approved') {
      const b = me.best;
      FX.celebrate({ icon: '✅', ok: true, title: t('Stamp added!'), text: b && b.rewards[0] ? t('{p}% of the way to: {r}', { p: Math.round(b.pct), r: b.rewards[0].title }) : '' });
    } else if (status === 'rejected') {
      FX.toast(t('The shop could not confirm your last purchase.'), true);
    } else {
      FX.toast(t('Sent to the shop for confirmation.'));
    }
    await refreshShop(biz.shop_code);
  }

  function joinView(biz) {
    const consent = h('input', { type: 'checkbox', checked: true });
    const ref = new URLSearchParams(location.search).get('ref') || '';
    const perk = biz.perks && biz.perks.welcome;
    return h('div.stack.l', { style: 'max-width:720px;margin:0 auto' }, head(biz), h('div.card.stack', h('h2', t('Join {shop}', { shop: biz.name })),
      perk ? h('div.banner.green', '🎁 ' + t('Welcome gift: {r}', { r: perk.title })) : null,
      biz.tiers.length ? h('p.muted', biz.tiers.map(x => t(x.tier === 'gold' ? 'Gold' : 'Silver') + ' = ' + x.visits + ' ' + t('visits')).join('  ·  ')) : null,
      h('label.check', consent, h('span', t('Send me offers from this shop (you can turn this off any time)'))),
      h('button.btn.lg', { onclick: e => busy(e.target, async () => { await api('b/' + biz.shop_code + '/join/', 'POST', { consent: consent.checked, ref }); await FX.start(true); if (perk) FX.celebrate({ icon: '🎁', title: t('Welcome!'), text: t('Your welcome gift unlocks after your first purchase: {r}', { r: perk.title }) }); }) }, t('Join now'))));
  }

  /* ---------- earn: one big tap ---------- */
  const mmss = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  function claimBtn(biz, me, tk, live, seen) {
    const b = h('button.claim', { type: 'button' });
    let left = me.cooldown_seconds || 0;
    const paint = () => {
      b.disabled = true;
      if (!live) return b.replaceChildren(t('Not taking rewards right now'));
      if (me.entries_left_today <= 0) return b.replaceChildren(t('Daily limit reached. See you tomorrow!'));
      if (left > 0) return b.replaceChildren('⏱ ' + t('Next entry in {m}', { m: mmss(left) }));
      b.disabled = false;
      b.replaceChildren(h('span', tk.type === 'visit' ? '📍' : '✨'), t(tk.type === 'visit' ? 'Check in' : 'I made a purchase'));
    };
    paint();
    if (live && left > 0 && me.entries_left_today > 0) {
      const iv = setInterval(() => { if (!document.body.contains(b)) { if (b.dataset.seen) clearInterval(iv); return; } b.dataset.seen = '1'; left -= 1; paint(); if (left <= 0) clearInterval(iv); }, 1000);
    }
    b.addEventListener('click', e => { FX.ripple(b, e); FX.haptic(); submitSheet(biz, me, tk, seen); });
    return b;
  }
  function earnTab(biz, me) {
    const live = me.live && me.status === 'active';
    const pend = me.entries.filter(e => e.status === 'pending');
    const seen = new Set(me.rewards.map(g => g.code));
    const list = me.tasks.map(tk => h('div.task' + (pend.length ? '.waiting' : ''), h('div.row.between', h('b', tk.title), tk.repeatable && tk.completed ? pill(t('Earned {n}x', { n: tk.completed }), 'ok') : null),
      stampRow(tk.current, tk.target, tk.type, true) || null,
      h('div.bar', h('i', { style: { width: tk.pct + '%' } })),
      h('div.row.between', h('small.muted', FX.fmtVal(tk.type, tk.current) + ' / ' + FX.fmtVal(tk.type, tk.target)), tk.rewards[0] ? h('small', '🎁 ' + tk.rewards[0].title) : null),
      claimBtn(biz, me, tk, live, seen),
      live && me.entries_left_today > 0 ? h('div.claim-note', me.approval_mode === 'auto' ? t('Approved instantly at this shop') : t('Scan the counter QR for instant approval')) : null));
    return h('div.stack', me.status === 'blocked' ? h('div.banner.red', t('This shop has paused your account.')) : null,
      me.wheel ? wheelCard(biz, me.wheel, me.live && me.status === 'active') : null,
      pend.length ? h('div.banner.blue', '⏳ ' + t('{n} purchase waiting for the shop to confirm', { n: pend.length }) + ' · ' + t('We will tell you the moment it is approved.')) : null,
      list.length ? list : empty('No rewards running right now', 'Check back soon.'),
      biz.pay_link ? h('a.btn.ghost', { href: biz.pay_link }, t('Pay with UPI')) : null);
  }
  function wheelCard(biz, wheel, canUseShop) {
    const colors = ['#6c4bd3', '#f3a712', '#e65d73', '#1b9b78', '#3979d4', '#e88428', '#8e56b0', '#238f9a', '#cb5364', '#62983c', '#d8792f', '#4b65b8'];
    const total = wheel.prizes.reduce((sum, p) => sum + Number(p.weight || 1), 0);
    let start = 0;
    const arcs = wheel.prizes.map(p => {
      const span = total ? 360 * Number(p.weight || 1) / total : 360;
      const arc = { center: start + span / 2, end: start + span };
      start += span;
      return arc;
    });
    const gradient = wheel.prizes.map((p, i) => `${colors[i % colors.length]} ${i ? arcs[i - 1].end : 0}deg ${arcs[i].end}deg`).join(', ');
    const face = h('div.wheel-face', { style: { background: gradient ? `conic-gradient(${gradient})` : '#dfe3ed' } },
      wheel.prizes.map((p, i) => {
        const angle = arcs[i].center;
        return h('div.wheel-label', { style: { '--wheel-angle': angle + 'deg' } }, h('span', p.icon), h('small', p.title));
      }), h('div.wheel-hub', '🎡'));
    const result = wheel.result;
    const spin = h('button.btn.lg', { disabled: !wheel.can_spin || !canUseShop, type: 'button' }, t('Spin now'));
    spin.onclick = () => busy(spin, async () => {
      try {
        const r = await api('me/shop/' + biz.shop_code + '/wheel/', 'POST');
        const center = arcs[r.prize_index] ? arcs[r.prize_index].center : 0;
        face.style.transform = `rotate(${360 * 6 + 360 - center}deg)`;
        await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 4300));
        if (!document.body.contains(face)) return;
        FX.haptic([20, 40, 20]);
        if (r.empty) FX.celebrate({ icon: r.icon || '✨', title: t('Better luck next time'), text: t('Come back for another spin soon.') });
        else FX.celebrate({ icon: r.icon || '🎁', big: true, title: r.title, text: r.terms || t('Your reward is ready to use.') });
        await refreshShop(biz.shop_code);
      } catch (e) { toast(e.message, true); }
    });
    const status = result ? h('div.banner.' + (result.empty ? 'blue' : 'green'), result.icon + ' ' + (result.empty ? t('Better luck next time') : t('You won: {prize}', { prize: result.title })),
      result.terms ? h('small', result.terms) : null,
      result.code ? h('button.btn.sm', { onclick: () => passModal({ title: result.title, code: result.code, expires_at: result.expires_at, terms: result.terms }, biz.brand_color, biz.name) }, t('Show reward code')) : null)
      : wheel.message === 'already_played' ? h('p.small.muted', t('Your new-customer spin has already been used.'))
        : wheel.message === 'not_new' ? h('p.small.muted', t('This spin is only for customers who have not made an approved purchase yet.'))
          : wheel.available_today ? h('p.small.muted', t(wheel.mode === 'new_customer' ? 'New customers can spin once before their first approved purchase.' : 'One spin per day. Today’s prizes may change by weekday.'))
        : h('p.small.muted', t('No prizes are scheduled for today.'));
    return h('div.wheel-card', h('div.row.between.wrap', h('div', h('h3', '🎡 ' + wheel.title), h('small.muted', t(wheel.mode === 'daily' ? 'Daily rewards' : 'Welcome spin'))),
      h('span.pill', t('Spin & win'))), h('div.wheel-stage', h('i.wheel-pointer', '▼'), face),
      spin, status);
  }
  async function submitSheet(biz, me, tk, seen) {
    const q = new URLSearchParams(location.search), isVisit = tk.type === 'visit';
    const cc = inp({ inputmode: 'numeric', maxlength: 6, value: q.get('c') || '', ph: '6-digit counter code', autocomplete: 'one-time-code' });
    const bill = h('input', { type: 'file', accept: 'image/*', capture: 'environment', required: biz.require_bill_photo });
    const err = h('div.err', { role: 'alert' });
    const note = h('div.instant');
    const setNote = () => { const fast = cc.value.trim() || me.approval_mode === 'auto'; note.className = 'instant' + (fast ? '' : ' wait'); note.replaceChildren(h('span', fast ? '⚡' : '⏳'), t(fast ? 'This will be approved instantly.' : 'The shop will confirm this shortly.')); };
    cc.addEventListener('input', setNote); setNote();
    let val = null, quick = null;
    if (!isVisit) {
      const amt = tk.type === 'amount', vals = amt ? [100, 200, 500, 1000] : [1, 2, 3, 5];
      val = inp({ type: 'number', inputmode: amt ? 'decimal' : 'numeric', min: '1', step: amt ? '0.01' : '1', value: amt ? '' : '1', 'aria-label': t(TYPE_HINT[tk.type]) });
      const paint = () => [...quick.children].forEach((x, i) => x.setAttribute('aria-pressed', String(String(vals[i]) === String(val.value))));
      quick = h('div.quick', vals.map(v => h('button', { type: 'button', onclick: () => { val.value = v; paint(); FX.haptic(8); } }, amt ? FX.rupee(v) : '×' + v)));
      val.addEventListener('input', paint); paint();
      if (!amt) {
        const step = d => () => { val.value = Math.max(1, (parseInt(val.value, 10) || 1) + d); paint(); FX.haptic(8); };
        val._wrap = h('div.qty', h('button', { type: 'button', 'aria-label': '−1', onclick: step(-1) }, '−'), val, h('button', { type: 'button', 'aria-label': '+1', onclick: step(1) }, '+'));
      } else { val.style.cssText = 'height:56px;text-align:center;font-size:calc(26px * var(--font-scale, .8));font-family:var(--f-d);font-weight:700'; val._wrap = val; }
    }
    const go = h('button.claim', { type: 'button', onclick: () => busy(go, async () => {
      err.textContent = '';
      const fd = new FormData();
      fd.append('task', tk.task_id); fd.append('value', val ? val.value : '1');
      if (cc.value.trim()) fd.append('counter_code', cc.value.trim());
      if (bill && bill.files[0]) fd.append('bill_photo', bill.files[0]);
      const pos = await FX.getPos(); if (pos) { fd.append('lat', pos.latitude); fd.append('lng', pos.longitude); }
      try {
        const r = await api('entries/', 'POST', fd); m.close();
        const fresh = await api('me/shop/' + biz.shop_code + '/');
        await afterEntry(biz, fresh, seen, r.status);
      } catch (x) { err.textContent = x.message; FX.haptic([30, 40, 30]); }
    }) }, h('span', '✓'), t(isVisit ? 'Confirm check-in' : 'Confirm'));
    const m = modal(tk.title, h('div.stack', h('div.grab'),
      tk.rewards[0] ? h('div.row', h('span', { style: 'font-size:calc(22px * var(--font-scale, .8))' }, '🎁'), h('small.muted', t('Reward: {r}', { r: tk.rewards[0].title }))) : null,
      isVisit ? h('p.muted', t('Records one visit.')) : [h('div.field', h('span', t(TYPE_HINT[tk.type])), val._wrap), quick],
      field('Counter code', cc, 'Optional. Scan the QR at the counter for instant approval.'),
      field(biz.require_bill_photo ? 'Bill photo (required)' : 'Bill photo (optional)', bill), note, err, go), { cls: 'sheet' });
    if (val) setTimeout(() => val.focus && val.focus(), 250);
  }

  /* ---------- rewards ---------- */
  function passModal(g, color, shop) {
    modal(t('Reward pass'), h('div.passbody', shop ? h('small', shop) : null, h('div.t', g.title),
      h('div.qrw', h('img', { src: '/api/rewards/qr/' + encodeURIComponent(g.code) + '.png', alt: t('QR code for this reward'), width: 230, height: 230 })),
      h('div.big', g.code), h('small', FX.until(g.expires_at)), g.terms ? h('small', g.terms) : null,
      h('small', t('Show this to the staff. They scan it or type the code.')),
      h('button.btn.block', { style: 'background:#fff;color:#15192b;background-image:none', onclick: () => FX.copy(g.code) }, t('Copy code'))),
      { cls: 'pass', style: FX.shopVars(color) });
  }
  const ticket = (g, shop, color, shopName) => h('div.ticket.' + g.status, h('div.main', h('b', g.title), shop ? h('small.muted', shop) : null,
    g.terms ? h('small.muted', g.terms) : null, h('small', g.status === 'active' ? FX.until(g.expires_at) : t(g.status === 'used' ? 'Used' : g.status === 'expired' ? 'Expired' : 'Cancelled')),
    g.trigger === 'welcome' ? pill(t('Welcome gift'), 'ok') : g.trigger === 'winback' ? pill(t('Welcome-back gift'), 'ok') : g.trigger === 'referral' ? pill(t('Referral reward'), 'info') : g.trigger === 'wheel' ? pill(t('Spin wheel'), 'info') : null),
    h('div.stub', h('small.muted', t('Show this code')), h('div.code', g.code),
      g.status === 'active' ? h('button.btn.sm', { onclick: () => passModal(g, color, shopName || shop) }, t('Show at counter')) : null,
      g.status === 'active' ? h('button.btn.ghost.sm', { onclick: () => FX.copy(g.code) }, t('Copy')) : null));
  function rewardsTab(biz, me) {
    const act = me.rewards.filter(g => g.status === 'active'), old = me.rewards.filter(g => g.status !== 'active');
    return h('div.stack', act.length ? act.map(g => ticket(g, null, biz.brand_color, biz.name)) : empty('No rewards ready', 'Keep collecting stamps. Your rewards appear here.'),
      old.length ? h('details', h('summary.muted', t('Past rewards ({n})', { n: old.length })), h('div.stack', { style: 'margin-top:10px' }, old.map(g => ticket(g)))) : null);
  }
  R.rewards = async function () {
    const w = await api('me/wallet/'), groups = [];
    for (const s of w.shops) { if (!s.active_rewards) continue; const me = await api('me/shop/' + s.shop_code + '/'); groups.push([s, me.rewards.filter(g => g.status === 'active')]); }
    return h('div.stack.l', h('h1', t('My rewards')), groups.length ? groups.map(([s, gs]) => h('div.stack', h('h3', s.shop), gs.map(g => ticket(g, null, s.brand_color, s.shop)))) : empty('No rewards ready', 'Keep collecting stamps. Your rewards appear here.'));
  };

  /* ---------- history + rating ---------- */
  function rateModal(entry) {
    let v = 0; const c = inp({ maxlength: 300, ph: 'Tell the shop how it went (optional)' });
    const m = modal(t('Rate your visit'), h('div.stack', FX.stars(0, n => { v = n; }), c, h('button.btn', { onclick: e => busy(e.target, async () => { if (!v) throw new Error(t('Choose a rating from 1 to 5.')); await api('feedback/', 'POST', Object.assign({ rating: v, comment: c.value }, entry)); m.close(); toast(t('Thanks for your feedback!')); FX.start(true); }) }, t('Send'))));
  }
  function historyTab(biz, me) {
    return h('div.card', me.entries.length ? me.entries.map(e => h('div.li', h('div.grow', h('b', e.task_title), h('div.small.muted', FX.fmtDT(e.created_at))),
      e.multiplier > 1 ? pill(e.multiplier + 'x', 'warn') : null,
      e.status === 'approved' && !e.rated ? h('button.btn.ghost.sm', { onclick: () => rateModal({ entry: e.id }) }, '★ ' + t('Rate')) : null,
      pill(t(e.status === 'approved' ? 'Approved' : e.status === 'pending' ? 'Waiting' : e.status === 'rejected' ? 'Declined' : 'Reversed'), e.status === 'approved' ? 'ok' : e.status === 'pending' ? 'warn' : 'bad'))) : empty('No activity yet'));
  }

  /* ---------- invite ---------- */
  function inviteTab(biz, me) {
    const text = t('Join me at {shop} and earn rewards!', { shop: biz.name });
    return h('div.card.stack', h('h3', t('Invite friends')), h('p.muted', me.referral_reward ? t('When a friend makes their first purchase, you get: {r}', { r: me.referral_reward }) : t('Share this shop with friends.')),
      h('div.row.between', h('div', h('small.muted', t('Your code')), h('div.num.bold', { style: 'font-size:calc(26px * var(--font-scale, .8));letter-spacing:.1em' }, me.referral_code)), h('small.muted', t('{n} friends joined', { n: me.friends_referred }))),
      h('div.row.wrap', h('button.btn', { onclick: () => FX.share(text, me.referral_url) }, t('Share on WhatsApp')), h('button.btn.ghost', { onclick: () => FX.copy(me.referral_url) }, t('Copy link'))));
  }

  /* ---------- booking ---------- */
  function bookTab(biz, me) {
    const svc = sel(biz.services.map(s => [s.id, s.name + ' (' + FX.rupee(s.price) + ', ' + s.duration_min + ' min)']), biz.services[0].id);
    const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const when = inp({ type: 'datetime-local', value: iso, min: iso }), note = inp({ maxlength: 200, ph: 'Note for the shop (optional)' });
    const mine = me.bookings.filter(b => ['requested', 'confirmed'].includes(b.status));
    return h('div.stack', h('div.card.stack', h('h3', t('Book a service')), field('Service', svc), field('Date and time', when), field('Note', note),
      h('button.btn.lg', { onclick: e => busy(e.target, async () => { await api('b/' + biz.shop_code + '/bookings/', 'POST', { service: svc.value, starts_at: new Date(when.value).toISOString(), note: note.value }); toast(t('Booking requested. The shop will confirm.')); FX.start(true); }) }, t('Request booking'))),
      mine.length ? h('div.card', h('h3', t('Upcoming')), mine.map(bookingRow)) : null);
  }
  const bookingRow = b => h('div.li', h('div.grow', h('b', b.service_name), h('div.small.muted', FX.fmtDT(b.starts_at) + (b.shop ? ' · ' + b.shop : ''))),
    pill(t(b.status.replace('_', ' ')), b.status === 'confirmed' ? 'ok' : b.status === 'requested' ? 'warn' : b.status === 'completed' ? 'info' : 'bad'),
    ['requested', 'confirmed'].includes(b.status) ? h('button.btn.ghost.sm', { onclick: async () => { if (await FX.confirmBox(t('Cancel this booking?'), t('Cancel booking'), true)) { await api('bookings/' + b.id + '/action/', 'POST', { action: 'cancel' }); FX.render(true); FX.start(true); } } }, t('Cancel')) : null,
    b.status === 'completed' && !b.rated ? h('button.btn.ghost.sm', { onclick: () => rateModal({ booking: b.id }) }, '★ ' + t('Rate')) : null);
  R.bookings = async function () {
    const list = await api('me/bookings/');
    return h('div.stack.l', h('h1', t('My bookings')), h('div.card', list.length ? list.map(bookingRow) : empty('No bookings yet', 'Open a shop that takes bookings to book a service.')));
  };
})(window.FX);
