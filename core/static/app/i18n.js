/* i18n: English strings are the keys. Hindi lookup order: new dictionary -> classic exact table -> (server messages
   only) classic phrase table. Anything missing simply stays in English, so a gap never breaks a screen.
   Native-speaker review of the Hindi wording is recommended before launch. */
window.FX = window.FX || {};
(function (FX) {
  const HI = window.FX_HI || {};
  const EX = window.HI_EX || {}, PT = window.HI_PT || {};
  const phrases = Object.keys(PT).sort((a, b) => b.length - a.length);
  FX.lang = localStorage.l || ((navigator.language || 'en').slice(0, 2) === 'hi' ? 'hi' : 'en');
  FX.setLang = l => { localStorage.l = l; FX.lang = l; document.documentElement.lang = l; };
  const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s);
  FX.t = (s, v) => {
    let out = s;
    if (FX.lang === 'hi') out = HI[s] != null ? HI[s] : EX[s] != null ? EX[s] : s;
    return fill(out, v);
  };
  /* server error/notification text: also tries phrase-level replacement from the classic table */
  FX.tr = s => {
    if (FX.lang !== 'hi' || !s) return s;
    if (HI[s] != null) return HI[s];
    if (EX[s] != null) return EX[s];
    let out = s;
    for (const p of phrases) if (out.includes(p)) out = out.split(p).join(PT[p]);
    return out;
  };
  document.documentElement.lang = FX.lang;
})(window.FX);
