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

function getAngleById(angleId) {
  const registry = loadAngleRegistry();
  const angles = Array.isArray(registry.angles) ? registry.angles : [];
  return angles.find(angle => angle.id === angleId) || angles.find(angle => angle.id === "angle_center") || null;
}

function selectStyleReferences({ assetCategory, material, max = 3 }) {
  const registry = loadReferenceRegistry();
  const references = Array.isArray(registry.references) ? registry.references : [];
  return references
    .filter(reference => reference.category === assetCategory && reference.material === material)
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
  const selectedReferences = selectStyleReferences({ assetCategory, material });

  if (!selectedAngle) {
    throw new Error("Angle registry does not contain a center fallback angle.");
  }

  const finalPrompt = [
    "User request:",
    userPrompt,
    "",
    "Core style:",
    modules.core_identity,
    "",
    "Feature behavior:",
    getFeatureModule(modules, feature),
    "",
    "Asset category:",
    modules[assetCategory],
    "",
    "Material behavior:",
    modules[`material_${material}`],
    "",
    "Reference behavior:",
    modules.reference_behavior,
    "",
    "Angle behavior:",
    modules.angle_behavior,
    selectedAngle.promptDirection,
    "",
    "Output rules:",
    modules.output_rules,
    "",
    "Negative rules:",
    modules.negative_rules
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
