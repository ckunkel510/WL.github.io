"use strict";

const policyData = require("../data/cut-to-ship-products.json");

class CutToShipSelectionError extends Error {
  constructor(issues) {
    super("One or more custom cut requests are invalid.");
    this.name = "CutToShipSelectionError";
    this.code = "invalid-cut-to-ship-selection";
    this.shippingIssues = Array.isArray(issues) ? issues : [];
  }
}

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function quantity(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function measurement(value) {
  const number = positive(value);
  return number ? Math.round(number * 1000) / 1000 : 0;
}

function normalizeRule(source) {
  const rule = source && typeof source === "object" ? source : {};
  const productId = cleanText(rule.productId, 40);
  const productCode = cleanText(rule.productCode, 80).toUpperCase();
  const optionId = cleanText(rule.optionId, 80);
  const stockLengthIn = positive(rule.stockLengthIn);
  const minimumPieceLengthIn = positive(rule.minimumPieceLengthIn) || 1;
  const maximumPiecesPerUnit = quantity(rule.maximumPiecesPerUnit) || 48;
  const cutAndPackagingFeePerUnit = positive(rule.cutAndPackagingFeePerUnit);
  if (!productId || !optionId || !stockLengthIn || maximumPiecesPerUnit < 2 || !cutAndPackagingFeePerUnit) {
    throw new Error("Custom cut product rules require productId, optionId, stock length, piece limit, and a positive fee.");
  }
  return {
    productId,
    productCode,
    optionId,
    label: cleanText(rule.label, 160),
    stockLengthIn,
    minimumPieceLengthIn,
    maximumPiecesPerUnit,
    cutAndPackagingFeePerUnit,
    nonRefundable: rule.nonRefundable !== false,
    customerNote: cleanText(rule.customerNote, 320)
  };
}

function rules(data = policyData) {
  return (Array.isArray(data?.products) ? data.products : []).map(normalizeRule);
}

function ruleForItem(item, data = policyData) {
  const productId = cleanText(item?.productId || item?.id, 40);
  const productCode = cleanText(item?.productCode || item?.code, 80).toUpperCase();
  return rules(data).find((rule) => (
    (productId && rule.productId === productId) ||
    (productCode && rule.productCode && rule.productCode === productCode)
  )) || null;
}

function selectedRequest(item) {
  const selected = item?.cutToShip;
  return selected && typeof selected === "object" && !Array.isArray(selected) ? selected : null;
}

function selectedOption(item) {
  const selected = selectedRequest(item);
  if (selected) return cleanText(selected.optionId || selected.id, 80);
  return cleanText(item?.cutToShip || item?.cutOptionId, 80);
}

function requestedLengths(item) {
  const selected = selectedRequest(item);
  if (!Array.isArray(selected?.cutLengthsIn)) return [];
  return selected.cutLengthsIn.map(measurement).filter(Boolean);
}

function summarizeLengths(lengths) {
  const counts = new Map();
  lengths.forEach((length) => counts.set(length, (counts.get(length) || 0) + 1));
  return Array.from(counts.entries())
    .map(([length, count]) => `${count} × ${length} in.`)
    .join(", ");
}

function availableCutToShipOptions(cart, data = policyData) {
  return (Array.isArray(cart) ? cart : []).flatMap((item) => {
    const rule = ruleForItem(item, data);
    if (!rule) return [];
    const lengths = requestedLengths(item);
    return [{
      productId: rule.productId,
      productCode: rule.productCode,
      optionId: rule.optionId,
      label: rule.label,
      stockLengthIn: rule.stockLengthIn,
      minimumPieceLengthIn: rule.minimumPieceLengthIn,
      maximumPiecesPerUnit: rule.maximumPiecesPerUnit,
      cutAndPackagingFeePerUnit: rule.cutAndPackagingFeePerUnit,
      nonRefundable: rule.nonRefundable,
      customerNote: rule.customerNote,
      cutLengthsIn: lengths,
      selected: selectedOption(item) === rule.optionId && lengths.length >= 2
    }];
  });
}

function cutDimensions(line, pieceLengthIn) {
  const dimensions = [positive(line.length), positive(line.width), positive(line.height)];
  const longestIndex = dimensions.indexOf(Math.max(...dimensions));
  dimensions[longestIndex] = pieceLengthIn;
  return { length: dimensions[0], width: dimensions[1], height: dimensions[2] };
}

function selectionIssue(rule, label, reason, message) {
  return {
    productId: rule?.productId || "",
    productCode: rule?.productCode || "",
    reason,
    message: `${rule?.productCode || label}: ${message}`
  };
}

function validateCutRequest(item, rule, label) {
  const selected = selectedRequest(item);
  const lengths = requestedLengths(item);
  if (!selected || !Array.isArray(selected.cutLengthsIn)) {
    return { issue: selectionIssue(rule, label, "cut-lengths-required", "Enter the requested finished lengths in inches.") };
  }
  if (selected.acknowledgedNonRefundable !== true) {
    return { issue: selectionIssue(rule, label, "cut-terms-required", "The non-refundable special-order terms must be accepted.") };
  }
  if (lengths.length < 2 || lengths.length !== selected.cutLengthsIn.length) {
    return { issue: selectionIssue(rule, label, "invalid-cut-length", "At least two valid cut lengths are required.") };
  }
  if (lengths.length > rule.maximumPiecesPerUnit) {
    return { issue: selectionIssue(rule, label, "too-many-cut-pieces", `No more than ${rule.maximumPiecesPerUnit} pieces may be requested per stock length.`) };
  }
  if (lengths.some((length) => length < rule.minimumPieceLengthIn || length > rule.stockLengthIn)) {
    return { issue: selectionIssue(rule, label, "invalid-cut-length", `Each finished piece must be between ${rule.minimumPieceLengthIn} and ${rule.stockLengthIn} inches.`) };
  }
  const requestedTotal = measurement(lengths.reduce((sum, length) => sum + length, 0));
  if (Math.abs(requestedTotal - rule.stockLengthIn) > 0.01) {
    return { issue: selectionIssue(rule, label, "cut-length-total-mismatch", `The requested lengths must total ${rule.stockLengthIn} inches with no cut loss.`) };
  }
  return { lengths, requestedTotal };
}

function normalizeCutApprovalCart(cart, data = policyData) {
  const requestedCart = Array.isArray(cart) ? cart.slice(0, 100) : [];
  const issues = [];
  const selections = [];

  requestedCart.forEach((item) => {
    const optionId = selectedOption(item);
    if (!optionId) return;
    const rule = ruleForItem(item, data);
    const label = cleanText(item?.productCode || item?.code, 80) || `Item ${cleanText(item?.productId || item?.id, 40)}`;
    if (!rule || optionId !== rule.optionId) {
      issues.push({
        productId: cleanText(item?.productId || item?.id, 40),
        productCode: cleanText(item?.productCode || item?.code, 80),
        reason: "invalid-cut-option",
        message: `${label} is not eligible for the requested custom cut option.`
      });
      return;
    }
    const lineQuantity = quantity(item?.quantity);
    if (!lineQuantity) {
      issues.push(selectionIssue(rule, label, "invalid-quantity", "A positive cart quantity is required."));
      return;
    }
    const validation = validateCutRequest(item, rule, label);
    if (validation.issue) {
      issues.push(validation.issue);
      return;
    }
    selections.push({
      productId: rule.productId,
      productCode: rule.productCode,
      optionId: rule.optionId,
      originalQuantity: lineQuantity,
      stockLengthIn: rule.stockLengthIn,
      piecesPerUnit: validation.lengths.length,
      cutLengthsIn: validation.lengths,
      cutSummary: summarizeLengths(validation.lengths),
      cutAndPackagingFeePerUnit: rule.cutAndPackagingFeePerUnit,
      addedCharge: money(rule.cutAndPackagingFeePerUnit * lineQuantity),
      specialOrder: true,
      nonRefundable: rule.nonRefundable
    });
  });

  if (!selections.length && !issues.length) {
    issues.push({
      productId: "",
      productCode: "",
      reason: "cut-selection-required",
      message: "At least one eligible custom cut request is required."
    });
  }
  if (issues.length) throw new CutToShipSelectionError(issues);
  selections.sort((left, right) => (
    `${left.productId}:${left.productCode}:${left.optionId}`.localeCompare(`${right.productId}:${right.productCode}:${right.optionId}`)
  ));
  return {
    policyVersion: cleanText(data?.version, 80),
    selections,
    addedCharge: money(selections.reduce((sum, selection) => sum + selection.addedCharge, 0))
  };
}

function applyCutToShipSelections(lines, cart, data = policyData) {
  const trustedLines = Array.isArray(lines) ? lines : [];
  const requestedCart = Array.isArray(cart) ? cart : [];
  const issues = [];
  const selections = [];
  const packingLines = [];

  trustedLines.forEach((line, index) => {
    const requested = requestedCart[index] || {};
    const optionId = selectedOption(requested);
    if (!optionId) {
      packingLines.push({ ...line });
      return;
    }

    const rule = ruleForItem(line, data);
    const label = cleanText(line?.productCode || requested?.productCode, 80) || `Item ${cleanText(line?.productId || requested?.productId, 40)}`;
    if (!rule || optionId !== rule.optionId) {
      issues.push({
        productId: cleanText(line?.productId || requested?.productId, 40),
        productCode: cleanText(line?.productCode || requested?.productCode, 80),
        reason: "invalid-cut-option",
        message: `${label} is not eligible for the requested custom cut option.`
      });
      packingLines.push({ ...line });
      return;
    }

    const lineQuantity = quantity(line.quantity);
    const weight = positive(line.weight);
    const originalDimensions = [positive(line.length), positive(line.width), positive(line.height)];
    if (!lineQuantity || !weight || originalDimensions.some((value) => !value)) {
      issues.push(selectionIssue(rule, label, "cut-option-missing-package-data", "Trusted weight and dimensions are required before it can be custom cut and shipped by UPS."));
      packingLines.push({ ...line });
      return;
    }

    const originalLength = Math.max(...originalDimensions);
    if (Math.abs(originalLength - rule.stockLengthIn) > 0.25) {
      issues.push(selectionIssue(rule, label, "cut-stock-length-mismatch", `The trusted stock length must be ${rule.stockLengthIn} inches before custom cuts can be rated.`));
      packingLines.push({ ...line });
      return;
    }

    const validation = validateCutRequest(requested, rule, label);
    if (validation.issue) {
      issues.push(validation.issue);
      packingLines.push({ ...line });
      return;
    }

    const lengthCounts = new Map();
    validation.lengths.forEach((length) => lengthCounts.set(length, (lengthCounts.get(length) || 0) + 1));
    lengthCounts.forEach((count, pieceLengthIn) => {
      packingLines.push({
        ...line,
        quantity: lineQuantity * count,
        weight: weight * (pieceLengthIn / rule.stockLengthIn),
        ...cutDimensions(line, pieceLengthIn)
      });
    });

    const addedCharge = money(rule.cutAndPackagingFeePerUnit * lineQuantity);
    selections.push({
      productId: rule.productId,
      productCode: rule.productCode,
      optionId: rule.optionId,
      label: rule.label,
      originalQuantity: lineQuantity,
      stockLengthIn: rule.stockLengthIn,
      piecesPerUnit: validation.lengths.length,
      cutLengthsIn: validation.lengths,
      cutSummary: summarizeLengths(validation.lengths),
      cutAndPackagingFeePerUnit: rule.cutAndPackagingFeePerUnit,
      addedCharge,
      specialOrder: true,
      nonRefundable: rule.nonRefundable,
      customerNote: rule.customerNote
    });
  });

  if (issues.length) throw new CutToShipSelectionError(issues);
  return {
    packingLines,
    selections,
    addedCharge: money(selections.reduce((sum, selection) => sum + selection.addedCharge, 0))
  };
}

function applyCutToShipCharge(rated, cutPlan) {
  const addedCharge = money(positive(cutPlan?.addedCharge));
  if (!rated || !Array.isArray(rated.rates) || !addedCharge) return rated;
  const rates = rated.rates.map((rate) => ({
    ...rate,
    amount: money(positive(rate?.amount) + addedCharge)
  }));
  const ground = rates.find((rate) => String(rate?.serviceCode || "") === "03") || null;
  return {
    ...rated,
    rates,
    shippingOffer: rated.shippingOffer ? {
      ...rated.shippingOffer,
      customerGroundAmount: ground ? ground.amount : rated.shippingOffer.customerGroundAmount,
      cutAndPackagingCharge: addedCharge,
      cutAndPackagingNonRefundable: true
    } : rated.shippingOffer,
    cutToShip: {
      applied: true,
      addedCharge,
      specialOrder: true,
      nonRefundable: true,
      customParcelEligible: cutPlan.customParcelEligible === true,
      selections: cutPlan.selections
    }
  };
}

module.exports = {
  CutToShipSelectionError,
  applyCutToShipCharge,
  applyCutToShipSelections,
  availableCutToShipOptions,
  cutDimensions,
  normalizeCutApprovalCart,
  normalizeRule,
  requestedLengths,
  ruleForItem,
  selectedOption,
  summarizeLengths,
  validateCutRequest
};
