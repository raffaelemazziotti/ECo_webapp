// 1) Your data: map region acronyms → normalized [0..1] intensity
const activations = {
  VISp: 0.7,
  MOs: 0.4,
  CA1: 0.9,
  // …etc
};

// 2) A simple “hot” colormap: white→yellow→orange→red
function valueToColor(v) {
  // clamp
  v = Math.max(0, Math.min(1, v));
  // ramp R from 255*v to 255, G from 255*v to 0, B=0
  const r = Math.round(255 * Math.max(v, 0.5));
  const g = Math.round(255 * (1 - v));
  return `rgb(${r},${g},0)`;
}

// 3) When the SVG is loaded, color each region
document.getElementById('brain').addEventListener('load', () => {
  const svgDoc = document.getElementById('brain').contentDocument;
  Object.entries(activations).forEach(([region, val]) => {
    const el = svgDoc.getElementById(region);
    if (el) {
      el.style.fill = valueToColor(val);
      el.style.stroke = "#333";      // optional: show borders
      el.style.strokeWidth = "0.5";   // optional
    }
  });
});
