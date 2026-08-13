"use strict";

const deliveryRules = require("../data/woodson-delivery-rules.json");

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const BRANCH_BY_POSTAL = {
  "77833": "01",
  "77803": "02",
  "77836": "03",
  "78947": "04",
  "76642": "05",
  "76667": "06",
  "75831": "07"
};
const geocodeCache = new Map();
const GEOCODE_CACHE_MS = 30 * 60 * 1000;

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function postal5(value) {
  return cleanText(value, 12).match(/\d{5}/)?.[0] || "";
}

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return Math.max(0, Math.round((finite(value, 0) + Number.EPSILON) * 100) / 100);
}

function branchCodeForOrigin(origin) {
  const source = origin && typeof origin === "object" ? origin : {};
  const explicit = cleanText(source.branchCode, 2);
  if (/^\d{2}$/.test(explicit)) return explicit;
  const postalCode = postal5(source.postalCode || source.PostalCode);
  if (BRANCH_BY_POSTAL[postalCode]) return BRANCH_BY_POSTAL[postalCode];
  const name = cleanText(source.name || source.city, 80).toLowerCase();
  const area = deliveryRules.areas.find((item) => item.branchName.toLowerCase() === name);
  return area?.branchCode || "";
}

function coordinatePair(input) {
  if (Array.isArray(input) && input.length >= 2) {
    const longitude = finite(input[0]);
    const latitude = finite(input[1]);
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
  }
  const source = input && typeof input === "object" ? input : {};
  const longitude = finite(source.longitude ?? source.lon ?? source.x);
  const latitude = finite(source.latitude ?? source.lat ?? source.y);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

function pointOnSegment(point, left, right, epsilon = 1e-9) {
  const [x, y] = point;
  const [x1, y1] = left;
  const [x2, y2] = right;
  const cross = ((y - y1) * (x2 - x1)) - ((x - x1) * (y2 - y1));
  if (Math.abs(cross) > epsilon) return false;
  return x >= Math.min(x1, x2) - epsilon && x <= Math.max(x1, x2) + epsilon &&
    y >= Math.min(y1, y2) - epsilon && y <= Math.max(y1, y2) + epsilon;
}

function pointInPolygon(point, polygon) {
  if (!coordinatePair(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    const crosses = (yi > y) !== (yj > y) && x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function rateForWeight(area, totalWeight) {
  const rates = Array.isArray(area?.rates) ? area.rates : [];
  if (!rates.length) return null;
  const rawWeight = finite(totalWeight);
  const hasTrustedWeight = Number.isFinite(rawWeight) && rawWeight > 0;
  const weight = hasTrustedWeight ? Math.round(rawWeight * 100) / 100 : rates[0].weightFrom;
  const rate = rates.find((item) => weight >= Number(item.weightFrom) && weight <= Number(item.weightTo)) ||
    (weight > Number(rates[rates.length - 1].weightTo) ? rates[rates.length - 1] : rates[0]);
  const amount = money(rate?.amount);
  return amount > 0 ? { amount, weight, weightBasis: hasTrustedWeight ? "trusted" : "minimum-tier" } : null;
}

function matchingAreas(point, origin) {
  const branchCode = branchCodeForOrigin(origin);
  const candidates = branchCode
    ? deliveryRules.areas.filter((area) => area.branchCode === branchCode)
    : deliveryRules.areas;
  return candidates.filter((area) => area.polygons.some((polygon) => pointInPolygon(point, polygon)));
}

function quoteAtCoordinates({ shipFrom, coordinates, totalWeight }) {
  const point = coordinatePair(coordinates);
  if (!point) return { available: false, reason: "coordinates-unavailable" };
  const matches = matchingAreas(point, shipFrom)
    .map((area) => ({ area, rate: rateForWeight(area, totalWeight) }))
    .filter((item) => item.rate)
    .sort((left, right) => left.rate.amount - right.rate.amount || left.area.areaId - right.area.areaId);
  if (!matches.length) return { available: false, reason: "outside-delivery-area" };
  const selected = matches[0];
  return {
    available: true,
    mode: "delivery",
    serviceCode: "03",
    serviceName: "Woodson Local Delivery",
    amount: selected.rate.amount,
    currency: "USD",
    billingWeight: selected.rate.weight,
    weightBasis: selected.rate.weightBasis,
    area: {
      areaId: selected.area.areaId,
      areaCode: selected.area.areaCode,
      name: selected.area.name,
      branchCode: selected.area.branchCode,
      branchName: selected.area.branchName
    }
  };
}

function oneLineAddress(input) {
  const source = input && typeof input === "object" ? input : {};
  const lines = Array.isArray(source.addressLine) ? source.addressLine : [source.addressLine];
  const street = lines.map((line) => cleanText(line, 80)).filter(Boolean).join(" ");
  const city = cleanText(source.city, 50);
  const state = cleanText(source.state, 2).toUpperCase();
  const zip = postal5(source.postalCode);
  if (!street || !city || state !== "TX" || !zip) return "";
  return [street, city, state, zip].join(", ");
}

async function fetchWithTimeout(url, options, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeAddress(address, dependencies = {}) {
  const direct = coordinatePair(address?.coordinates || address);
  if (direct) return { coordinates: direct, matchedAddress: "provided coordinates", source: "provided" };
  const query = oneLineAddress(address);
  if (!query) return null;
  const cacheKey = query.toUpperCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const endpoint = dependencies.endpoint || process.env.CENSUS_GEOCODER_URL || CENSUS_GEOCODER_URL;
  const url = new URL(endpoint);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const fetcher = dependencies.fetch || fetchWithTimeout;
  const response = await fetcher(url.toString(), { headers: { Accept: "application/json" } });
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const match = payload?.result?.addressMatches?.[0];
  const coordinates = coordinatePair(match?.coordinates);
  if (!coordinates) return null;
  const value = {
    coordinates,
    matchedAddress: cleanText(match.matchedAddress, 160),
    source: "census"
  };
  geocodeCache.set(cacheKey, { value, expiresAt: Date.now() + GEOCODE_CACHE_MS });
  return value;
}

async function quoteWoodsonDelivery(input, dependencies = {}) {
  const source = input && typeof input === "object" ? input : {};
  const shipTo = source.shipTo && typeof source.shipTo === "object" ? source.shipTo : {};
  const state = cleanText(shipTo.state, 2).toUpperCase();
  if (state && state !== "TX") return { available: false, reason: "outside-texas" };
  let geocoded;
  try {
    geocoded = await (dependencies.geocodeAddress || geocodeAddress)(shipTo, dependencies);
  } catch {
    return { available: false, reason: "geocoder-unavailable" };
  }
  if (!geocoded?.coordinates) return { available: false, reason: "address-not-geocoded" };
  const quote = quoteAtCoordinates({
    shipFrom: source.shipFrom,
    coordinates: geocoded.coordinates,
    totalWeight: source.totalWeight
  });
  return quote.available
    ? { ...quote, geocodeSource: geocoded.source, matchedAddress: geocoded.matchedAddress }
    : quote;
}

function resetGeocodeCache() {
  geocodeCache.clear();
}

module.exports = {
  branchCodeForOrigin,
  geocodeAddress,
  matchingAreas,
  pointInPolygon,
  quoteAtCoordinates,
  quoteWoodsonDelivery,
  rateForWeight,
  resetGeocodeCache
};
