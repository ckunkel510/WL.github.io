"use strict";

const DEFAULT_CARTONS = [
  { code: "XS-444", length: 4, width: 4, height: 4 },
  { code: "XS-644", length: 6, width: 4, height: 4 },
  { code: "XS-862", length: 8, width: 6, height: 2 },
  { code: "S-666", length: 6, width: 6, height: 6 },
  { code: "S-865", length: 8, width: 6, height: 5 },
  { code: "M-888", length: 8, width: 8, height: 8 },
  { code: "S-1292", length: 12, width: 9, height: 2 },
  { code: "M-13112", length: 13, width: 11, height: 2 },
  { code: "L-101010", length: 10, width: 10, height: 10 },
  { code: "M-1296", length: 12, width: 9, height: 6 },
  { code: "L-12127", length: 12, width: 12, height: 7 },
  { code: "XL-121212", length: 12, width: 12, height: 12 },
  { code: "L-15116", length: 15, width: 11, height: 6 },
  { code: "XL-16129", length: 16, width: 12, height: 9 },
  { code: "XL-18126", length: 18, width: 12, height: 6 }
];

const MAX_UNITS = 2000;
const MAX_PACKAGES = 50;
const EPSILON = 1e-9;

function number(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value, fallback = NaN) {
  const parsed = number(value, fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function moneyWeight(value) {
  return Math.ceil((number(value, 0) - EPSILON) * 100) / 100;
}

function volume(item) {
  return item.length * item.width * item.height;
}

function uniqueOrientations(item) {
  const values = [item.length, item.width, item.height];
  const permutations = [
    [values[0], values[1], values[2]],
    [values[0], values[2], values[1]],
    [values[1], values[0], values[2]],
    [values[1], values[2], values[0]],
    [values[2], values[0], values[1]],
    [values[2], values[1], values[0]]
  ];
  const seen = new Set();
  return permutations.filter((candidate) => {
    const key = candidate.join("x");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(([length, width, height]) => ({ length, width, height }));
}

function normalizeLine(line, index) {
  const source = line && typeof line === "object" ? line : {};
  const quantity = Math.trunc(positive(source.quantity, 0));
  const normalized = {
    productId: String(source.productId || source.id || "").trim(),
    productCode: String(source.productCode || source.code || "").trim(),
    quantity,
    weight: positive(source.weight),
    length: positive(source.length),
    width: positive(source.width),
    height: positive(source.height)
  };
  if (quantity < 1) throw new Error(`Cart line ${index + 1} requires a positive quantity.`);
  for (const field of ["weight", "length", "width", "height"]) {
    if (!Number.isFinite(normalized[field])) throw new Error(`Cart line ${index + 1} requires ${field}.`);
  }
  return normalized;
}

function expandUnits(lines) {
  const normalized = lines.map(normalizeLine);
  const total = normalized.reduce((sum, line) => sum + line.quantity, 0);
  if (!total || total > MAX_UNITS) throw new Error(`Cartonization supports between 1 and ${MAX_UNITS} units.`);
  const units = [];
  normalized.forEach((line) => {
    for (let copy = 0; copy < line.quantity; copy += 1) {
      units.push({
        productId: line.productId,
        productCode: line.productCode,
        weight: line.weight,
        length: line.length,
        width: line.width,
        height: line.height
      });
    }
  });
  return units.sort((left, right) => {
    const dimensionDifference = Math.max(right.length, right.width, right.height)
      - Math.max(left.length, left.width, left.height);
    return dimensionDifference || volume(right) - volume(left) || right.weight - left.weight;
  });
}

function normalizeCarton(carton, index, settings) {
  const source = carton && typeof carton === "object" ? carton : {};
  const result = {
    code: String(source.code || `BOX-${index + 1}`),
    length: positive(source.length),
    width: positive(source.width),
    height: positive(source.height),
    maxWeight: positive(source.maxWeight, settings.maxCartonWeight),
    tareWeight: positive(source.tareWeight, settings.tareWeight)
  };
  if (![result.length, result.width, result.height, result.maxWeight, result.tareWeight].every(Number.isFinite)) {
    throw new Error(`Carton ${index + 1} is incomplete.`);
  }
  return result;
}

function fits(item, space) {
  return item.length <= space.length + EPSILON
    && item.width <= space.width + EPSILON
    && item.height <= space.height + EPSILON;
}

function contains(outer, inner) {
  return inner.x >= outer.x - EPSILON
    && inner.y >= outer.y - EPSILON
    && inner.z >= outer.z - EPSILON
    && inner.x + inner.length <= outer.x + outer.length + EPSILON
    && inner.y + inner.width <= outer.y + outer.width + EPSILON
    && inner.z + inner.height <= outer.z + outer.height + EPSILON;
}

function pruneSpaces(spaces) {
  return spaces.filter((space, index) => {
    if (space.length <= EPSILON || space.width <= EPSILON || space.height <= EPSILON) return false;
    return !spaces.some((candidate, otherIndex) => otherIndex !== index && contains(candidate, space));
  });
}

function placementFor(bin, unit) {
  if (bin.itemWeight + unit.weight > bin.carton.maxWeight + EPSILON) return null;
  let best = null;
  const orientations = uniqueOrientations(unit);
  bin.spaces.forEach((space, spaceIndex) => {
    orientations.forEach((orientation) => {
      if (!fits(orientation, space)) return;
      const leftover = volume(space) - volume(orientation);
      const score = leftover + ((space.length - orientation.length) + (space.width - orientation.width) + (space.height - orientation.height));
      if (!best || score < best.score) best = { orientation, space, spaceIndex, score };
    });
  });
  return best;
}

function place(bin, unit, placement) {
  const { orientation: item, space, spaceIndex } = placement;
  bin.spaces.splice(spaceIndex, 1);
  bin.spaces.push(
    {
      x: space.x + item.length,
      y: space.y,
      z: space.z,
      length: space.length - item.length,
      width: space.width,
      height: space.height
    },
    {
      x: space.x,
      y: space.y + item.width,
      z: space.z,
      length: item.length,
      width: space.width - item.width,
      height: space.height
    },
    {
      x: space.x,
      y: space.y,
      z: space.z + item.height,
      length: item.length,
      width: item.width,
      height: space.height - item.height
    }
  );
  bin.spaces = pruneSpaces(bin.spaces);
  bin.itemWeight += unit.weight;
  bin.items.push({
    productId: unit.productId,
    productCode: unit.productCode,
    weight: unit.weight,
    ...item
  });
}

function createBin(carton) {
  return {
    carton,
    itemWeight: 0,
    items: [],
    spaces: [{ x: 0, y: 0, z: 0, length: carton.length, width: carton.width, height: carton.height }]
  };
}

function packWithCarton(units, carton) {
  const bins = [];
  for (const unit of units) {
    let selectedBin = null;
    let selectedPlacement = null;
    for (const bin of bins) {
      const candidate = placementFor(bin, unit);
      if (!candidate) continue;
      if (!selectedPlacement || candidate.score < selectedPlacement.score) {
        selectedBin = bin;
        selectedPlacement = candidate;
      }
    }
    if (!selectedBin) {
      selectedBin = createBin(carton);
      selectedPlacement = placementFor(selectedBin, unit);
      if (!selectedPlacement) return null;
      bins.push(selectedBin);
      if (bins.length > MAX_PACKAGES) return null;
    }
    place(selectedBin, unit, selectedPlacement);
  }

  return bins.map((bin) => ({
    cartonCode: carton.code,
    length: carton.length,
    width: carton.width,
    height: carton.height,
    weight: moneyWeight(bin.itemWeight + carton.tareWeight),
    unitCount: bin.items.length,
    items: bin.items
  }));
}

function dimensionalWeight(packageItem, divisor) {
  return (packageItem.length * packageItem.width * packageItem.height) / divisor;
}

function planScore(packages, settings) {
  const billableWeight = packages.reduce(
    (sum, item) => sum + Math.max(item.weight, dimensionalWeight(item, settings.dimDivisor)),
    0
  );
  return billableWeight + (packages.length * settings.packagePenalty);
}

function customCartons(units, settings) {
  const cartons = [];
  const seen = new Set();
  units.forEach((unit) => {
    const dimensions = [unit.length, unit.width, unit.height]
      .map((value) => Math.ceil(value + settings.customCartonPadding))
      .sort((left, right) => right - left);
    const key = dimensions.join("x");
    if (seen.has(key)) return;
    seen.add(key);
    const [length, width, height] = dimensions;
    if (length > 108 || length + (2 * width) + (2 * height) > 165) return;
    cartons.push({
      code: `CUSTOM-${key}`,
      length,
      width,
      height,
      maxWeight: Math.max(settings.maxCartonWeight, Math.min(150, unit.weight + settings.tareWeight)),
      tareWeight: settings.tareWeight
    });
  });
  return cartons;
}

function settingsFromEnv(env = process.env) {
  return {
    maxCartonWeight: positive(env.SHIPPING_CARTON_MAX_WEIGHT_LB, 50),
    tareWeight: positive(env.SHIPPING_CARTON_TARE_WEIGHT_LB, 0.5),
    dimDivisor: positive(env.SHIPPING_DIM_DIVISOR, 139),
    packagePenalty: positive(env.SHIPPING_CARTON_PACKAGE_PENALTY_LB, 1),
    customCartonPadding: number(env.SHIPPING_CUSTOM_CARTON_PADDING_IN, 1)
  };
}

function cartonizeCandidates(lines, options = {}) {
  if (!Array.isArray(lines) || !lines.length) throw new Error("At least one cart line is required.");
  const settings = { ...settingsFromEnv(options.env), ...(options.settings || {}) };
  const units = expandUnits(lines);
  const supplied = Array.isArray(options.cartons) && options.cartons.length ? options.cartons : DEFAULT_CARTONS;
  const cartons = supplied.map((carton, index) => normalizeCarton(carton, index, settings));
  cartons.push(...customCartons(units, settings));

  const plans = [];
  const seen = new Set();
  cartons.forEach((carton) => {
    const packages = packWithCarton(units, carton);
    if (!packages || !packages.length || packages.length > MAX_PACKAGES) return;
    const signature = packages.map((item) => [item.length, item.width, item.height, item.weight].join("x")).sort().join("|");
    if (seen.has(signature)) return;
    seen.add(signature);
    plans.push({
      cartonCode: carton.code,
      packages,
      packageCount: packages.length,
      totalWeight: moneyWeight(packages.reduce((sum, item) => sum + item.weight, 0)),
      score: planScore(packages, settings)
    });
  });

  return plans.sort((left, right) => left.score - right.score || left.packageCount - right.packageCount).slice(0, 3);
}

function cartonize(lines, options = {}) {
  const candidates = cartonizeCandidates(lines, options);
  if (!candidates.length) throw new Error("The cart could not be packed into a supported UPS shipment.");
  return candidates[0];
}

module.exports = {
  DEFAULT_CARTONS,
  MAX_PACKAGES,
  MAX_UNITS,
  cartonize,
  cartonizeCandidates,
  packWithCarton,
  settingsFromEnv,
  uniqueOrientations
};
