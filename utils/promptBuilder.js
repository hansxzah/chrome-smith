const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const ASSET_CATEGORIES = {
  GENERIC: "generic_assets_and_numericals",
  PRODUCT_TILE: "product_social_tiles",
  CRYPTO: "crypto_coins",
  MARKET: "logos_stocks_markets"
};

const MATERIALS = {
  PLAIN_CHROME: "plain_metallic_chrome",
  PLAIN_RED_CHROME: "plain_red_metallic_chrome",
  RED_SILVER_CHROME: "red_silver_metallic_chrome",
  CHROME_TILE_WITH_LOGO: "chrome_tile_with_logo",
  MULTICOLORED_TILE: "multicolored_tile",
  MULTICOLORED_COIN: "multicolored_coin",
  METALLIC_CHROME_BASE: "metallic_chrome_base"
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function normalizePrompt(userPrompt) {
  return String(userPrompt || "").toLowerCase();
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function loadPromptModules() {
  return readJson("prompts/prompt-modules.json");
}

function loadReferenceRegistry() {
  return readJson("reference-library/references.json");
}

function loadAngleRegistry() {
  return readJson("reference-library/angles.json");
}

function classifyAssetCategory(userPrompt) {
  const text = normalizePrompt(userPrompt);

  const cryptoPatterns = [
    /\bbtc\b/, /\beth\b/, /\bsol\b/, /\bxrp\b/, /\busdt\b/,
    /\bcrypto\b/, /\btoken\b/, /\bblockchain\b/, /\bcoin\b/
  ];
  const productPatterns = [
    /\bproduct\b/, /\bapp\b/, /\bplatform\b/, /\bsocial media\b/,
    /\btrading platform\b/, /\btile\b/, /\binstagram\b/, /\bfacebook\b/,
    /\btiktok\b/, /\byoutube\b/, /\blinkedin\b/, /\btwitter\b/, /\bx logo\b/,
    /\bmt5\b/, /\bmetatrader\b/, /\bderiv\b/, /\bctrader\b/
  ];
  const marketPatterns = [
    /\bstock\b/, /\bindex\b/, /\bcommodity\b/, /\bforex\b/, /\bforex pair\b/,
    /\bmarket\b/, /\boil\b/, /\bgold\b/, /\bsilver\b/, /\bnvidia\b/,
    /\bamazon\b/, /\bapple\b/, /\bus500\b/, /\bus\s*500\b/,
    /\bjpy225\b/, /\bjpy\s*225\b/, /\beur\/usd\b/, /\bdxy\b/, /\bvix\b/,
    /\busoil\b/, /\bukoil\b/, /\bxauusd\b/, /\bxagusd\b/
  ];
  const genericPatterns = [
    /\d/, /%/, /[$€£¥]/, /\bcheck\b/, /\bcheck mark\b/, /\barrow\b/,
    /\bui symbol\b/, /\bsymbol\b/, /\bicon\b/, /\bbadge\b/, /\bprofile\b/,
    /\buser\b/, /\bsettings\b/, /\bgear\b/, /\bshield\b/, /\bwarning\b/,
    /\bhelp\b/, /\bsupport\b/, /\bdeposit\b/, /\bwithdrawal\b/,
    /\bquote mark\b/, /\bfintech\b/
  ];

  if (hasAny(text, cryptoPatterns)) return ASSET_CATEGORIES.CRYPTO;
  if (hasAny(text, productPatterns)) return ASSET_CATEGORIES.PRODUCT_TILE;
  if (hasAny(text, marketPatterns)) return ASSET_CATEGORIES.MARKET;
  if (hasAny(text, genericPatterns)) return ASSET_CATEGORIES.GENERIC;

  return ASSET_CATEGORIES.GENERIC;
}

function classifyMaterial(userPrompt, assetCategory) {
  const text = normalizePrompt(userPrompt);

  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    if (/\bred and silver\b|\bred accent\b|\bsilver with red\b|\bchrome with red\b/.test(text)) {
      return MATERIALS.RED_SILVER_CHROME;
    }
    if (/\bred chrome\b|\bred metallic\b|\bfully red\b|\bred icon\b|\bred number\b/.test(text)) {
      return MATERIALS.PLAIN_RED_CHROME;
    }
    if (/\bsilver chrome\b|\bmetallic chrome\b|\bchrome\b|\bsilver\b/.test(text)) {
      return MATERIALS.PLAIN_CHROME;
    }
    return MATERIALS.PLAIN_CHROME;
  }

  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE) {
    if (/\bchrome tile\b|\bmetallic tile\b|\bsilver tile\b/.test(text)) {
      return MATERIALS.CHROME_TILE_WITH_LOGO;
    }
    return MATERIALS.MULTICOLORED_TILE;
  }

  if (assetCategory === ASSET_CATEGORIES.CRYPTO) {
    return MATERIALS.MULTICOLORED_COIN;
  }

  if (assetCategory === ASSET_CATEGORIES.MARKET) {
    return MATERIALS.METALLIC_CHROME_BASE;
  }

  return MATERIALS.PLAIN_CHROME;
}

function normalizeSubjectText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9%$€£¥]+/g, "");
}

function extractExactContentTokens(userPrompt) {
  const prompt = String(userPrompt || "");
  const tokens = new Set();
  const patterns = [
    /[$€£¥]\s*\d+(?:[.,]\d+)?/g,
    /\b\d+(?:[.,]\d+)?\s*%/g,
    /\b\d+(?:[.,]\d+)?\b/g,
    /\b[A-Z0-9]{2,8}\b/g
  ];

  patterns.forEach(pattern => {
    for (const match of prompt.matchAll(pattern)) {
      const token = match[0].replace(/\s+/g, "");
      if (/[0-9%$€£¥]/.test(token) || /^[A-Z0-9]{2,8}$/.test(token)) {
        tokens.add(token);
      }
    }
  });

  return [...tokens].filter(token => {
    const normalized = normalizeSubjectText(token);
    return ![...tokens].some(other => {
      if (other === token) return false;
      const otherNormalized = normalizeSubjectText(other);
      return otherNormalized.length > normalized.length && otherNormalized.includes(normalized);
    });
  });
}

function buildSubjectLockBlock(userPrompt, assetCategory) {
  const exactTokens = assetCategory === ASSET_CATEGORIES.GENERIC ? extractExactContentTokens(userPrompt) : [];
  const lines = [
    "The user request is the source of truth for the subject. Do not copy the object, text, number, logo, or symbol from any reference image unless it exactly matches the user request.",
    "The reference images are not content sources. The requested subject/content must come from the user request only."
  ];

  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    lines.push("For exact text, number, and symbol requests such as 20%, 50%, 100%, $20, VIP, or 43, preserve the complete glyph sequence exactly.");
  }

  exactTokens.forEach(token => {
    lines.push(`Exact glyph lock: the output must include the complete \"${token}\" exactly as typed. Do not render only part of \"${token}\". Do not omit punctuation, currency symbols, percent signs, letters, or digits. Do not change the order or value. Treat \"${token}\" as one complete 3D asset.`);
  });

  return lines.join("\n");
}

function buildReferenceRolesBlock() {
  return [
    "Reference image roles:",
    "- Angle reference image: use only for perspective, camera direction, tilt, visible sidewall, extrusion direction, and angle.",
    "- Style/material reference images: use only for material, bevel thickness, chrome lighting, reflection quality, shadow softness, and surface treatment.",
    "- Do not copy the subject/content from style/material references.",
    "- Do not let style/material references override the selected angle.",
    "- Do not let the angle reference override the requested subject."
  ].join("\n");
}

function buildAnglePriorityBlock(selectedAngle) {
  const id = selectedAngle.id || "";
  const isRightFacing = /_right(?:_|$)/.test(id);
  const isThreeQuarterRight = id === "angle_45_right_facing";
  const isSideRight = id === "angle_22_5_right_facing";
  const lines = [
    selectedAngle.promptDirection,
    "The selected angle reference image is the source of truth. The selected angle reference has highest priority for perspective. Match the selected angle thumbnail exactly. Do not default to front view unless selectedAngleId is angle_center. Do not mirror, reverse, swap, or reinterpret left/right.",
    "Preserve the same visible sidewall direction, top or bottom tilt, object rotation, extrusion direction, and perspective shown in the selected angle reference."
  ];

  if (isRightFacing) {
    lines.push("Right-facing angle enforcement: the asset must face toward the viewer's right. Do not mirror it into a left-facing angle. Preserve the same right-facing visible sidewall direction as the selected angle reference.");
  }
  if (isThreeQuarterRight) {
    lines.push("For 3/4 R specifically, the output must remain right-facing with the right-side perspective visible. If the output faces left when 3/4 R is selected, that is wrong.");
  }
  if (isSideRight) {
    lines.push("For Side R specifically, the output must remain side-right-facing. If the output faces left when Side R is selected, that is wrong.");
  }

  return lines.join("\n");
}

function buildSubjectSpecificGuidanceBlock(assetCategory, userPrompt) {
  const text = normalizePrompt(userPrompt);
  const lines = [];

  if (assetCategory === ASSET_CATEGORIES.CRYPTO) {
    lines.push(
      "Crypto coin logo rule:",
      "The coin body/face should use the token/logo color treatment with polished metallic/chrome finishing. The coin must include the correct token/logo mark on the front face. The token/logo symbol must be visible, centered, and readable as a clean flat decal or smooth inlaid mark on the coin face. Do not bevel, extrude, emboss, or make the token symbol a separate 3D object. Only the coin rim, outer edge, sidewall, and body thickness should create 3D depth. Do not omit the token symbol. Do not create a blank coin face. Do not generate only random lines, generic markings, or unrelated symbols. Preserve circular coin form, beveled rim, sidewall, thickness, and selected angle."
    );
    if (/\bbtc\b|\bbitcoin\b/.test(text)) {
      lines.push(
        "BTC / Bitcoin rule:",
        "Treat this as a Bitcoin coin request. Use an orange/gold Bitcoin-style coin body that follows Bitcoin logo color recognition. Place a smooth flat white or light Bitcoin \u20bf symbol/logo mark on the coin face. The coin face must include a visible centered Bitcoin \u20bf symbol or recognizable Bitcoin logo mark. Do not make the \u20bf symbol thick, beveled, embossed, extruded, or separate from the coin face. Do not create a blank coin face. Do not generate only random lines, generic markings, or unrelated symbols. Preserve the circular coin body, beveled rim, sidewall, thickness, selected angle, and circular coin structure."
      );
    }
  }

  if (assetCategory === ASSET_CATEGORIES.MARKET && /\bnvidia\b/.test(text)) {
    lines.push(
      "NVIDIA logo/color rule:",
      "Preserve a recognizable NVIDIA-style logo/icon. Preserve NVIDIA-style green and black color recognition where possible. Do not convert the logo into plain silver unless the user specifically asks for silver/chrome only. Keep Chrome Smith metallic polish, bevels, lighting, and the selected angle."
    );
  }

  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE) {
    lines.push(
      "Product/social tile surface rule:",
      "The tile must be a smooth rounded-square 3D slab. The tile body/face should use the brand/logo color treatment with polished metallic/chrome finishing. The logo must be a clean flat decal or smooth inlaid mark on the front face. Do not bevel, extrude, emboss, or make the logo a separate 3D object. The logo should look printed or inset smoothly into the tile surface. Only the tile body, outer edges, sidewall, and bevel should provide 3D depth. Preserve visible tile thickness and sidewall when the selected angle requires it."
    );
  }

  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE && /\binstagram\b/.test(text)) {
    lines.push(
      "Instagram tile rule:",
      "Generate a smooth rounded-square 3D tile/slab. Use Instagram-inspired gradient/color treatment across the whole tile body with a polished metallic finish. Use a smooth flat Instagram-style camera glyph on the tile face. Do not make the camera glyph thick, beveled, embossed, extruded, or separate from the tile. The tile surface should feel smooth and premium, not chunky. Keep visible tile thickness, bevel, sidewall, and back edge for 3/4 angles."
    );
  }

  return [
    ...lines
  ].join("\n");
}

function buildMaterialOverrideBlock(assetCategory, material, userPrompt) {
  const text = normalizePrompt(userPrompt);
  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE && material === MATERIALS.MULTICOLORED_TILE) {
    return [
      "multicolored tile rule:",
      "The entire main tile face/body should use the relevant brand/logo color treatment. Chrome or silver material may be used only for rim, sidewall, bevel, frame, or subtle highlights. Do not make the whole tile plain silver chrome unless the prompt specifically asks for chrome tile.",
      "For an Instagram tile, the tile body should be multicolored/brand-colored with an Instagram-inspired gradient/color treatment, the camera glyph should remain clean, flat, smooth, and readable as a decal or smooth inlaid mark, and chrome may appear only on sidewalls, rim, bevel, frame, or subtle highlights. Do not bevel, emboss, extrude, or separate the camera glyph from the tile face."
    ].join("\n");
  }

  if (assetCategory === ASSET_CATEGORIES.CRYPTO && material === MATERIALS.MULTICOLORED_COIN) {
    const btcInstruction = /\bbtc\b|\bbitcoin\b/.test(text)
      ? "For a BTC coin, the coin body should be orange/gold Bitcoin-style, the coin face must include a smooth flat white or light centered Bitcoin \u20bf symbol or recognizable Bitcoin logo mark, and chrome may appear only on rim, sidewall, bevel, or supporting highlights. Do not make the \u20bf symbol thick, beveled, embossed, extruded, or separate."
      : "The correct token/logo mark must remain visible, centered, readable, flat, and smooth on the coin face, and chrome may appear only on rim, sidewall, bevel, or supporting highlights. Do not bevel, emboss, extrude, or separate the token/logo mark.";
    return [
      "multicolored coin rule:",
      "The coin body/face should follow the token or logo color treatment with polished metallic/chrome finishing. Chrome or silver may be used only for rim, sidewall, bevel, frame, or supporting highlights. Do not make the whole coin plain silver chrome unless the prompt specifically asks for silver chrome. Only the coin rim, outer edge, sidewall, and body thickness should create 3D depth.",
      btcInstruction
    ].join("\n");
  }

  return "";
}

function interpolatePreset(template, userPrompt, colorMaterialRule) {
  return String(template || "")
    .replaceAll("[USER PROMPT]", userPrompt)
    .replaceAll("[MATERIAL/COLOR RULE]", colorMaterialRule)
    .replaceAll("[BRAND/COLOR RULE]", colorMaterialRule)
    .replaceAll("[TOKEN/COLOR RULE]", colorMaterialRule);
}

function stripLeadingUse(value) {
  return String(value || "").replace(/^Use\s+/i, "");
}

function buildColorMaterialRule(assetCategory, material, userPrompt, modules) {
  const text = normalizePrompt(userPrompt);

  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    return [
      stripLeadingUse(modules[`material_${material}`]),
      "The whole object can be 3D, beveled, extruded, and metallic"
    ].join(" ");
  }

  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE) {
    if (/\binstagram\b/.test(text)) {
      return "Instagram-inspired gradient/color treatment across the whole tile body with polished metallic/chrome finishing. The Instagram camera glyph must be a flat printed surface graphic or flush inlay on the tile face, not beveled, embossed, extruded, raised, or separate. Keep tile thickness, sidewall, rounded edges, and a smooth premium tile surface";
    }
    if (material === MATERIALS.CHROME_TILE_WITH_LOGO) {
      return "a polished metallic chrome tile body because the user asked for a chrome/metallic tile. Keep the logo as a flat printed surface graphic or flush inlay on the tile face, not a 3D object. Keep tile thickness, sidewall, and rounded edges";
    }
    return "the relevant brand/logo color treatment across the whole tile body with polished metallic/chrome finishing. The logo must be a flat printed surface graphic or flush inlay on the tile face, not beveled, embossed, extruded, raised, or separate. Keep tile thickness, sidewall, and rounded edges";
  }

  if (assetCategory === ASSET_CATEGORIES.CRYPTO) {
    if (/\bbtc\b|\bbitcoin\b/.test(text)) {
      return "an orange/gold Bitcoin-style coin body that follows Bitcoin logo color recognition. Place a smooth flat white or light Bitcoin \u20bf symbol/logo mark on the coin face as a flat printed surface graphic or flush inlay, not beveled, embossed, extruded, raised, or separate. Keep coin thickness, rim, sidewall, and circular form";
    }
    return "the token/logo color treatment for the coin body with polished metallic/chrome finishing. The token/logo symbol must be a flat printed surface graphic or flush inlay on the coin face, not beveled, embossed, extruded, raised, or separate. Keep coin thickness, rim, sidewall, and circular form";
  }

  if (assetCategory === ASSET_CATEGORIES.MARKET) {
    if (/\bnvidia\b/.test(text)) {
      return "recognizable NVIDIA-style green/black color recognition where possible. Do not turn the whole logo into plain silver unless the user explicitly asks for silver chrome. Keep Chrome Smith metallic polish and premium lighting, with the recognizable NVIDIA icon as the main visual mark";
    }
    if (/\bgold\b|\bxauusd\b/.test(text)) {
      return "gold/commodity-appropriate color and metallic material logic while preserving a premium Chrome Smith finish";
    }
    if (/\bsilver\b|\bxagusd\b/.test(text)) {
      return "silver/commodity-appropriate color and metallic material logic while preserving a premium Chrome Smith finish";
    }
    return "recognizable logo, stock, market, or commodity color when color is important. Use metallic chrome as the base, rim, frame, badge, or object body only when appropriate. Do not turn brand logos plain silver unless the user asks";
  }

  return stripLeadingUse(modules[`material_${material}`]);
}

function getPresetInstruction(modules, assetCategory, userPrompt, colorMaterialRule) {
  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    return `In the same polished Chrome Smith 3D style as the attached style reference image, create ${userPrompt}. Use ${colorMaterialRule}. Match the attached angle reference exactly. Transparent background.`;
  }
  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE) {
    return `Product/social tile preset: In the same smooth 3D tile style as the attached tile reference image, create ${userPrompt}. Use ${colorMaterialRule}. The logo must be a flat printed surface graphic or flush inlay, not beveled, embossed, extruded, raised, or separate. Match the attached angle reference exactly. Transparent background.`;
  }
  if (assetCategory === ASSET_CATEGORIES.CRYPTO) {
    return `Crypto coin preset: In the same smooth 3D coin style as the attached coin reference image, create ${userPrompt}. Use ${colorMaterialRule}. The token/logo symbol must be a flat printed surface graphic or flush inlay, not beveled, embossed, extruded, raised, or separate. Match the attached angle reference exactly. Transparent background.`;
  }
  if (assetCategory === ASSET_CATEGORIES.MARKET) {
    return `In the same premium Chrome Smith 3D asset style as the attached reference image, create ${userPrompt}. Preserve recognizable logo/market color when color is important. Use ${colorMaterialRule}. Match the attached angle reference exactly. Transparent background.`;
  }
  return interpolatePreset(modules[`preset_${assetCategory}`], userPrompt, colorMaterialRule);
}

function buildAngleInstruction(selectedAngle) {
  return [
    "Match attached selected angle reference exactly. Do not mirror, reverse, swap, or reinterpret left/right.",
    "The selected angle reference image is the source of truth for perspective, visible sidewall direction, tilt, extrusion direction, and camera angle.",
    selectedAngle.promptDirection
  ].join(" ");
}

function buildNegativePresetRules() {
  return "No extra objects, no background, no watermark, no unrelated text, no copied reference subject, no floor shadow, no drop shadow, no reflection underneath, no ground plane, no surface plane.";
}

function getAngleById(angleId) {
  const registry = loadAngleRegistry();
  const angles = Array.isArray(registry.angles) ? registry.angles : [];
  return angles.find(angle => angle.id === angleId) || angles.find(angle => angle.id === "angle_center") || null;
}

function selectStyleReferences({ assetCategory, material, userPrompt = "", max = 3 }) {
  const registry = loadReferenceRegistry();
  const references = Array.isArray(registry.references) ? registry.references : [];
  const matches = references.filter(reference => reference.category === assetCategory && reference.material === material);
  const exactTokens = extractExactContentTokens(userPrompt).map(normalizeSubjectText).filter(Boolean);

  if (!exactTokens.length) return matches.slice(0, max);

  const scored = matches.map((reference, index) => {
    const subject = normalizeSubjectText(reference.subject_type);
    const exactSubjectMatch = exactTokens.some(token => subject === token || subject.includes(token));
    const numericLeakRisk = reference.shape_type === "numerical" && !exactSubjectMatch;
    const simpleMaterialAnchor = reference.shape_type === "simple_icon" || reference.shape_type === "tile" || reference.shape_type === "coin" || reference.shape_type === "market_asset";
    return {
      reference,
      score: (exactSubjectMatch ? 30 : 0) + (simpleMaterialAnchor ? 10 : 0) - (numericLeakRisk ? 25 : 0) - index / 1000
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(item => item.reference)
    .slice(0, max);
}

function getFeatureModule(modules, feature) {
  const featureKey = `feature_${feature}`;
  if (!modules[featureKey]) throw new Error(`Unsupported feature: ${feature}`);
  return modules[featureKey];
}

function buildPrompt({ feature, userPrompt, selectedAngleId }) {
  const modules = loadPromptModules();
  const assetCategory = classifyAssetCategory(userPrompt);
  const material = classifyMaterial(userPrompt, assetCategory);
  const selectedAngle = getAngleById(selectedAngleId);
  const selectedReferences = selectStyleReferences({ assetCategory, material, userPrompt });

  if (!selectedAngle) {
    throw new Error("Angle registry does not contain a center fallback angle.");
  }

  const colorMaterialRule = buildColorMaterialRule(assetCategory, material, userPrompt, modules);
  const presetInstruction = getPresetInstruction(modules, assetCategory, userPrompt, colorMaterialRule);
  const exactGlyphLock = assetCategory === ASSET_CATEGORIES.GENERIC ? buildSubjectLockBlock(userPrompt, assetCategory) : "";

  const finalPrompt = [
    "User request:",
    userPrompt,
    "",
    "Category:",
    assetCategory,
    "",
    "Preset instruction:",
    presetInstruction,
    "",
    "Color/material rule:",
    colorMaterialRule,
    "",
    ...(exactGlyphLock ? ["Exact glyph lock:", exactGlyphLock, ""] : []),
    "Angle instruction:",
    buildAngleInstruction(selectedAngle),
    "",
    "Reference role instruction:",
    modules.reference_role_instruction,
    "",
    "Shadow/output rule:",
    modules.shadow_output_rule,
    "",
    "Negative rules:",
    buildNegativePresetRules()
  ].join("\n");

  return {
    feature,
    userPrompt,
    assetCategory,
    material,
    selectedAngle,
    selectedReferences,
    finalPrompt
  };
}

module.exports = {
  loadPromptModules,
  loadReferenceRegistry,
  loadAngleRegistry,
  classifyAssetCategory,
  classifyMaterial,
  getAngleById,
  selectStyleReferences,
  buildPrompt
};
