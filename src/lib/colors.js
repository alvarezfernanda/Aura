// Mezcla dos colores hex (#rrggbb) en una proporción dada.
// Inputs no-string o no-hex se tratan como #000000.
export function mixColors(c1, c2, ratio = 0.5) {
  const parse = (c) => {
    if (!c || typeof c !== "string") return [0, 0, 0];
    const hex = c.replace("#", "");
    if (hex.length !== 6) return [0, 0, 0];
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const mix = (a, b) => Math.round(a * (1 - ratio) + b * ratio);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}
