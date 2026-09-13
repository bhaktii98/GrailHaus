/* GrailHaus — Heritage tier, read from GrailHaus_Luxury_Watch_Catalog.xlsx (sheet "Heritage").
   Every visual property of a watch is derived from these columns, so a new row
   renders in the Reserve case without touching the builder. */

export const HERITAGE = [
  { name: 'Oyster Perpetual', edition: 'Turquoise Blue', ref: 'GH-W-H01', collection: 'GrailHaus: Heritage Icons', style: 'Everyday Luxury', caseMaterial: 'Oystersteel', dial: 'Turquoise Blue', movement: 'Automatic Mechanical', size: '41mm', tagline: 'The simplest watches often become the ones history remembers.' },
  { name: 'Datejust', edition: 'Wimbledon', ref: 'GH-W-H02', collection: 'GrailHaus: Heritage Icons', style: 'Classic Dress', caseMaterial: 'Oystersteel', dial: 'Slate Grey / Green', movement: 'Automatic Mechanical', size: '41mm', tagline: "Elegance doesn't chase attention. It simply arrives first." },
  { name: 'Explorer', edition: 'Black Dial', ref: 'GH-W-H03', collection: 'GrailHaus: Heritage Icons', style: 'Tool / Explorer', caseMaterial: 'Oystersteel', dial: 'Black', movement: 'Automatic Mechanical', size: '40mm', tagline: 'Built for the places where confidence matters more than comfort.' },
  { name: 'Seamaster', edition: 'Diver 300M', ref: 'GH-W-H04', collection: 'GrailHaus: Deepwater', style: 'Diver', caseMaterial: 'Stainless Steel', dial: 'Blue', movement: 'Automatic Mechanical', size: '42mm', tagline: 'Below the surface, calm becomes a kind of power.' },
  { name: 'Speedmaster', edition: 'Moonwatch Professional', ref: 'GH-W-H05', collection: 'GrailHaus: Heritage Icons', style: 'Chronograph', caseMaterial: 'Stainless Steel', dial: 'Black', movement: 'Manual-Wind Mechanical', size: '42mm', tagline: 'Some watches measure time. This one remembers where humanity went.' },
  { name: 'Tank', edition: 'Must', ref: 'GH-W-H06', collection: 'GrailHaus: Design Icons', style: 'Dress', caseMaterial: 'Stainless Steel', dial: 'Silver / White', movement: 'Quartz', size: 'Large', tagline: 'A rectangle that became more recognizable than a thousand circles.' },
  { name: 'Santos', edition: 'Medium', ref: 'GH-W-H07', collection: 'GrailHaus: Design Icons', style: 'Luxury Sport', caseMaterial: 'Stainless Steel', dial: 'Silver / White', movement: 'Automatic Mechanical', size: 'Medium', tagline: 'Born for the sky. Perfected for the wrist.' },
  { name: 'Carrera', edition: 'Glassbox', ref: 'GH-W-H08', collection: 'GrailHaus: Velocity', style: 'Chronograph', caseMaterial: 'Stainless Steel', dial: 'Black', movement: 'Automatic Mechanical', size: '39mm', tagline: 'Speed fades. A great design never does.' },
  { name: 'Monaco', edition: 'Gulf', ref: 'GH-W-H09', collection: 'GrailHaus: Velocity', style: 'Chronograph', caseMaterial: 'Stainless Steel', dial: 'Blue / Orange', movement: 'Automatic Mechanical', size: '39mm', tagline: 'Square, loud and impossible to mistake for anything else.', squareCase: true },
  { name: 'Black Bay', edition: 'Burgundy', ref: 'GH-W-H10', collection: 'GrailHaus: Heritage Icons', style: 'Diver', caseMaterial: 'Stainless Steel', dial: 'Black / Burgundy Bezel', movement: 'Automatic Mechanical', size: '41mm', tagline: 'Vintage spirit. Modern nerve.' },
  { name: 'Pelagos', edition: 'Titanium', ref: 'GH-W-H11', collection: 'GrailHaus: Deepwater', style: 'Professional Diver', caseMaterial: 'Titanium', dial: 'Black', movement: 'Automatic Mechanical', size: '42mm', tagline: 'Light on the wrist. Heavy on capability.' },
  { name: 'Grand Seiko', edition: 'White Birch', ref: 'GH-W-H12', collection: 'GrailHaus: Japanese Craft', style: 'Dress / Sport', caseMaterial: 'Titanium', dial: 'Silver White', movement: 'Spring Drive', size: '40mm', tagline: 'A landscape captured in a dial.', dialTexture: 'birch' },
  { name: 'Black Bay Chrono', edition: 'Heritage', ref: 'GH-W-H13', collection: 'GrailHaus: Velocity', style: 'Chronograph', caseMaterial: 'Stainless Steel', dial: 'Black / White', movement: 'Automatic Mechanical', size: '41mm', tagline: 'Two worlds meet here: the sea and the starting line.' },
  { name: 'Reverso', edition: 'Classic Monoface', ref: 'GH-W-H14', collection: 'GrailHaus: Design Icons', style: 'Dress', caseMaterial: 'Stainless Steel', dial: 'Silver', movement: 'Manual-Wind Mechanical', size: 'Medium', tagline: 'The only watch that knows when to turn the other cheek.', godrons: true },
];

/* ---- column → geometry/material resolution ---- */

const ARCHETYPE_BY_STYLE = {
  'Diver': 'diver',
  'Professional Diver': 'diver',
  'Tool / Explorer': 'dress',
  'Chronograph': 'chronograph',
  'Dress': 'rectangular',
  'Classic Dress': 'dress',
  'Everyday Luxury': 'dress',
  'Dress / Sport': 'dress',
  'Luxury Sport': 'integrated',
};

const METALS = {
  'Oystersteel':   { color: 0xdfe4e8, polish: 0.09, brushed: 0.22, name: 'oystersteel' },
  'Stainless Steel': { color: 0xdae0e4, polish: 0.10, brushed: 0.24, name: 'stainless_steel' },
  'Titanium':      { color: 0xbcc1c5, polish: 0.20, brushed: 0.34, name: 'titanium' },
  '18K Gold':      { color: 0xc9a44c, polish: 0.18, brushed: 0.34, name: 'yellow_gold' },
  'White Gold':    { color: 0xdcdfe2, polish: 0.12, brushed: 0.28, name: 'white_gold' },
  'Platinum':      { color: 0xcfd2d2, polish: 0.17, brushed: 0.32, name: 'platinum' },
};

// dial column can carry two colors ("Black / Burgundy Bezel") — first is the dial,
// second becomes the bezel insert or the chrono accent.
const DIAL_COLORS = {
  'turquoise blue': 0x3fb8c4,
  'slate grey': 0x4d5257,
  'green': 0x1f4632,
  'black': 0x14161a,
  'blue': 0x1b3a63,
  'silver': 0xcdd0d2,
  'white': 0xe8e8e6,
  'silver white': 0xd9dcdc,
  'burgundy': 0x4e1520,
  'orange': 0xd2691a,
  'khaki green': 0x5a5f3c,
  'skeleton': 0x2a2c30,
};

const SIZE_ALIAS = { medium: 37, large: 40 };

function colorFor(token, fallback) {
  const t = token.trim().toLowerCase().replace(/\s*bezel\s*$/, '');
  if (DIAL_COLORS[t] != null) return DIAL_COLORS[t];
  const hit = Object.keys(DIAL_COLORS).find((k) => t.includes(k));
  return hit ? DIAL_COLORS[hit] : fallback;
}

export function specFor(row) {
  const archetype = ARCHETYPE_BY_STYLE[row.style] || 'dress';
  const metal = METALS[row.caseMaterial] || METALS['Stainless Steel'];
  const tokens = row.dial.split('/');
  const dialColor = colorFor(tokens[0], 0x14161a);
  const accent = tokens[1] ? colorFor(tokens[1], dialColor) : null;

  const mm = parseFloat(row.size) || SIZE_ALIAS[row.size.toLowerCase()] || 40;
  const caseR = (mm / 1000) / 2;

  const strap = archetype === 'rectangular' ? 'leather'
    : archetype === 'integrated' ? 'integrated'
    : archetype === 'chronograph' && row.squareCase ? 'leather'
    : 'link';

  return {
    ref: row.ref,
    archetype,
    squareCase: !!row.squareCase,
    godrons: !!row.godrons,
    dialTexture: row.dialTexture || (archetype === 'chronograph' ? 'matte' : 'sunburst'),
    metal,
    caseR,
    dialColor,
    accent,
    strap,
    subdials: archetype === 'chronograph',
    dateWindow: /Datejust|Oyster Perpetual|Seamaster/.test(row.name),
    lume: archetype === 'diver' || /Tool/.test(row.style),
    romanIndices: archetype === 'rectangular',
  };
}
