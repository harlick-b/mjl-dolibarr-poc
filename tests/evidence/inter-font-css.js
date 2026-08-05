const requiredWeights = [400, 500, 600, 700];

function declaration(block, property) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function descriptorCovers(descriptor, weight) {
  const values = descriptor.match(/\d+/g);
  if (!values || values.length === 0) return false;
  const numbers = values.map(Number);
  if (numbers.length === 1) return numbers[0] === weight;
  return weight >= Math.min(numbers[0], numbers[1]) && weight <= Math.max(numbers[0], numbers[1]);
}

function inspectInterFontCss(css) {
  const faces = Array.from(String(css).matchAll(/@font-face\s*\{([^}]+)\}/gi), (match) => ({
    block: match[1],
    display: declaration(match[1], 'font-display'),
    source: declaration(match[1], 'src'),
    weight: declaration(match[1], 'font-weight'),
  }));

  if (faces.length === 0) throw new Error('Google CSS contains no @font-face blocks');

  for (const weight of requiredWeights) {
    const covering = faces.filter((face) => descriptorCovers(face.weight, weight));
    if (covering.length === 0) throw new Error(`Google CSS does not cover Inter weight ${weight}`);
    for (const face of covering) {
      if (face.display.toLowerCase() !== 'swap') throw new Error(`Inter weight ${weight} does not use font-display: swap`);
      if (!/url\(["']?https:\/\/fonts\.gstatic\.com\//i.test(face.source)) {
        throw new Error(`Inter weight ${weight} does not use an HTTPS gstatic font source`);
      }
    }
  }

  return { faceCount: faces.length, coveredWeights: requiredWeights.slice() };
}

module.exports = { inspectInterFontCss };
