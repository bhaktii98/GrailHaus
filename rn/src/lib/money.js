// Money is integer cents everywhere. No float ever touches a balance.

export function fmt(cents, opts) {
  const o = opts || {};
  const neg = cents < 0;
  const v = Math.abs(Math.round(cents));
  const whole = Math.floor(v / 100);
  const frac = String(v % 100).padStart(2, '0');
  const grouped = whole.toLocaleString('en-US');
  const sign = neg ? '-' : (o.signed ? '+' : '');
  if (o.compact) return sign + '$' + grouped;
  return sign + '$' + grouped + '.' + frac;
}

export function pct(a, b) {
  if (!b) return '0%';
  const v = ((a - b) / b) * 100;
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
