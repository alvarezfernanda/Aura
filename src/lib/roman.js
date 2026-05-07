export function toRoman(num) {
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return roman[num] || String(num);
}
