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

const REFERENCE_ROLES = {
  STYLE_ARCHETYPE: "style_archetype_reference",
  MATERIAL: "material_reference",
  SUBJECT_ARCHETYPE: "subject_archetype_reference",
  ANGLE: "angle_reference"
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
  if (
    hasAny(text, genericPatterns) &&
    /\bred\b|\bsilver\b|\bchrome\b|\bmetallic\b/.test(text) &&
    !hasAny(text, [
      /\bstock\b/, /\bindex\b/, /\bcommodity\b/, /\bforex\b/, /\bforex pair\b/,
      /\bmarket\b/, /\boil\b/, /\bnvidia\b/, /\bamazon\b/, /\bapple\b/,
      /\bus500\b/, /\bus\s*500\b/, /\bjpy225\b/, /\bjpy\s*225\b/,
      /\beur\/usd\b/, /\bdxy\b/, /\bvix\b/, /\busoil\b/, /\bukoil\b/,
      /\bxauusd\b/, /\bxagusd\b/
    ])
  ) {
    return ASSET_CATEGORIES.GENERIC;
  }
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

function classifyMaterialWithReason(userPrompt, assetCategory) {
  const text = normalizePrompt(userPrompt);
  const explicitRedSilver = /\bred and silver\b|\bred\s*\+\s*silver\b|\bred-silver\b|\bred accent\b|\bsilver with red\b|\bchrome with red\b|\bred and silver chrome\b/.test(text);
  const explicitRed = /\bred chrome\b|\bred metallic\b|\bfully red\b|\bred icon\b|\bred number\b/.test(text);
  const explicitSilver = /\bsilver chrome\b|\bmetallic chrome\b|\bchrome\b|\bsilver\b/.test(text);

  if (assetCategory !== ASSET_CATEGORIES.GENERIC) {
    return {
      material: classifyMaterial(userPrompt, assetCategory),
      reason: "Category-specific material rule."
    };
  }

  if (explicitRedSilver) {
    return {
      material: MATERIALS.RED_SILVER_CHROME,
      reason: "Explicit user material request for red + silver chrome."
    };
  }
  if (explicitRed) {
    return {
      material: MATERIALS.PLAIN_RED_CHROME,
      reason: "Explicit user material request for red chrome."
    };
  }
  if (explicitSilver) {
    return {
      material: MATERIALS.PLAIN_CHROME,
      reason: "Explicit user material request for silver/chrome."
    };
  }

  const redSilverPatterns = [
    /\bshield\b/, /\bsupport\b/, /\bhelp\b/, /\bcustomer service\b/,
    /\bportfolio\b/, /\btransfer\b/, /\bsecurity\b/, /\bcommunity\b/,
    /\btrading concept\b/, /\bfinance concept\b/, /\bfintech concept\b/,
    /\bmulti[-\s]?part\b/, /\btrust\b/, /\bprotection\b/, /\bverification\b/
  ];
  const redPatterns = [
    /\d+\s*%/, /[$€£¥]\s*\d+/, /\bbonus\b/, /\bboost\b/, /\blightning\b/,
    /\balert\b/, /\burgent\b/, /\bdeposit\b/, /\bupward\b/, /\bup arrow\b/,
    /\barrow up\b/, /\bgrowth\b/, /\baction\b/, /\bpromo\b/, /\bpromotion\b/,
    /\bpromotional\b/, /\bdiscount\b/, /\boffer\b/, /\breward\b/, /\bwarning\b/
  ];

  if (hasAny(text, redSilverPatterns)) {
    return {
      material: MATERIALS.RED_SILVER_CHROME,
      reason: "Auto-selected red + silver metallic chrome for complex fintech, support, trust, security, or multi-part concept icon."
    };
  }
  if (hasAny(text, redPatterns)) {
    return {
      material: MATERIALS.PLAIN_RED_CHROME,
      reason: "Auto-selected plain red metallic chrome for promotional, action, urgency, boost, or emphasis asset."
    };
  }

  return {
    material: MATERIALS.PLAIN_CHROME,
    reason: "Auto-selected plain metallic chrome for a simple, neutral, utility, or UI-style icon."
  };
}

function normalizeSubjectText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9%$€£¥]+/g, "");
}

function tokenizeSubjectText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_+.-]+/g, " ")
    .replace(/[^a-z0-9%$€£¥\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const CONCEPT_DICTIONARY = [
  {
    concept: "support",
    aliases: ["support", "help", "customer service", "help centre", "help center"],
    metaphorTerms: ["headset", "agent", "lifebuoy", "chat bubble", "customer care"],
    preferredReferenceSubjects: ["help centre", "agent", "lifebuoy", "support"],
    preferredFormProfile: "complex_fintech_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "security",
    aliases: ["security", "shield", "protection", "safe", "secure"],
    metaphorTerms: ["shield", "lock", "safe", "protection", "identity"],
    preferredReferenceSubjects: ["identity", "shield", "security", "protection"],
    preferredFormProfile: "low_relief_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME,
    blockedReferenceSubjectsUnlessLiteral: ["fingerprint"]
  },
  {
    concept: "fingerprint",
    aliases: ["fingerprint", "biometric"],
    metaphorTerms: ["fingerprint", "identity", "verification"],
    preferredReferenceSubjects: ["fingerprint"],
    preferredFormProfile: "low_relief_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "portfolio",
    aliases: ["portfolio", "folder", "files", "file", "document stack"],
    metaphorTerms: ["folder", "files", "briefcase", "document", "container"],
    preferredReferenceSubjects: ["files", "portfolio", "protfolio", "folder", "document"],
    preferredFormProfile: "realistic_3d_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "leverage",
    aliases: ["leverage", "seesaw", "balance"],
    metaphorTerms: ["seesaw", "balance", "scale", "multiplier", "force", "advantage"],
    preferredReferenceSubjects: ["leverage", "seesaw", "balance"],
    preferredFormProfile: "realistic_3d_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "growth",
    aliases: ["growth", "arrow up", "upward", "increase"],
    metaphorTerms: ["arrow up", "chart", "rocket", "plant", "upward movement"],
    preferredReferenceSubjects: ["fast", "deposit", "trading", "arrow", "growth"],
    preferredFormProfile: "simple_glyph_icon",
    preferredMaterialBehavior: MATERIALS.PLAIN_RED_CHROME
  },
  {
    concept: "boost",
    aliases: ["boost", "speed", "fast", "accelerate"],
    metaphorTerms: ["rocket", "speedometer", "lightning", "upward arrow", "fast"],
    preferredReferenceSubjects: ["fast", "deposit", "lightning", "arrow"],
    preferredFormProfile: "simple_glyph_icon",
    preferredMaterialBehavior: MATERIALS.PLAIN_RED_CHROME
  },
  {
    concept: "alert",
    aliases: ["alert", "warning", "urgent"],
    metaphorTerms: ["warning triangle", "bell", "exclamation", "danger"],
    preferredReferenceSubjects: ["warning", "alert", "no"],
    preferredFormProfile: "low_relief_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "community",
    aliases: ["community", "people", "group", "network"],
    metaphorTerms: ["people", "group", "network", "connected nodes"],
    preferredReferenceSubjects: ["community", "mentorship", "network"],
    preferredFormProfile: "complex_fintech_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "transfer",
    aliases: ["transfer", "exchange", "move money", "movement"],
    metaphorTerms: ["arrows", "exchange", "movement", "bridge", "trading"],
    preferredReferenceSubjects: ["transfer", "trading", "p2p", "deposit"],
    preferredFormProfile: "complex_fintech_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "verification",
    aliases: ["verification", "verify", "verified", "check badge"],
    metaphorTerms: ["check", "badge", "shield-check", "identity"],
    preferredReferenceSubjects: ["check", "check button", "identity"],
    preferredFormProfile: "low_relief_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "timer",
    aliases: ["timer", "hourglass", "sand clock", "sandclock", "countdown"],
    metaphorTerms: ["stopwatch", "hourglass", "sandclock", "countdown"],
    preferredReferenceSubjects: ["sandclock", "hourglass"],
    preferredFormProfile: "realistic_3d_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  },
  {
    concept: "mail",
    aliases: ["mail", "email", "envelope", "message"],
    metaphorTerms: ["mail", "envelope", "message", "folded paper"],
    preferredReferenceSubjects: ["mail", "envelope"],
    preferredFormProfile: "low_relief_object",
    preferredMaterialBehavior: MATERIALS.RED_SILVER_CHROME
  }
];

function resolvePromptConcept(userPrompt, assetCategory) {
  const promptText = normalizePrompt(userPrompt);
  const promptTokens = new Set(tokenizeSubjectText(userPrompt));
  const exactTokens = assetCategory === ASSET_CATEGORIES.GENERIC ? extractExactContentTokens(userPrompt) : [];

  if (exactTokens.length) {
    return {
      detectedConcept: "literal_glyph",
      literalSubject: exactTokens.join(" "),
      metaphorTerms: [],
      searchedReferenceTerms: exactTokens,
      preferredReferenceSubjects: [],
      preferredFormProfile: "simple_glyph_icon",
      preferredMaterialBehavior: null,
      fallbackUsed: false
    };
  }

  const matched = CONCEPT_DICTIONARY.find(entry =>
    entry.aliases.some(alias => termMatchesPrompt(alias, promptText, promptTokens))
  );

  const literalTerms = tokenizeSubjectText(userPrompt)
    .filter(token => !["icon", "symbol", "asset", "chrome", "red", "silver", "metallic", "and", "the", "a", "an"].includes(token));

  if (!matched) {
    return {
      detectedConcept: null,
      literalSubject: literalTerms.join(" ") || String(userPrompt || "").trim(),
      metaphorTerms: [],
      searchedReferenceTerms: [...new Set(literalTerms)],
      preferredReferenceSubjects: [],
      preferredFormProfile: null,
      preferredMaterialBehavior: null,
      fallbackUsed: true
    };
  }

  const searchedReferenceTerms = [
    ...literalTerms,
    ...matched.aliases,
    ...matched.metaphorTerms,
    ...matched.preferredReferenceSubjects
  ];

  return {
    detectedConcept: matched.concept,
    literalSubject: literalTerms.join(" ") || matched.concept,
    metaphorTerms: matched.metaphorTerms,
    searchedReferenceTerms: [...new Set(searchedReferenceTerms.map(term => normalizePrompt(term)).filter(Boolean))],
    preferredReferenceSubjects: matched.preferredReferenceSubjects,
    preferredFormProfile: matched.preferredFormProfile,
    preferredMaterialBehavior: matched.preferredMaterialBehavior,
    blockedReferenceSubjectsUnlessLiteral: matched.blockedReferenceSubjectsUnlessLiteral || [],
    fallbackUsed: false
  };
}

// manual alias priority map for generic subject/structure references.
const GENERIC_SUBJECT_ALIASES = [
  {
    id: "gear_settings",
    prompt: ["gear", "settings", "cog"],
    reference: ["gear", "settings", "cog", "mechanical"],
    preferredReferenceIds: ["generic_red_silver_gear_red_plus_silver"]
  },
  {
    id: "fingerprint",
    prompt: ["fingerprint"],
    reference: ["fingerprint"],
    preferredReferenceIds: ["generic_red_silver_fingerprint_red_plus_silver"]
  },
  {
    id: "shield_security",
    prompt: ["shield", "security", "protection", "safe"],
    reference: ["shield", "security", "protection", "safe", "identity", "verification", "trust"],
    preferredReferenceIds: ["generic_red_silver_identity_red_plus_silver"],
    blockedReferenceIds: ["generic_red_silver_fingerprint_red_plus_silver"],
    blockedUnlessPrompt: ["fingerprint"]
  },
  {
    id: "support_help",
    prompt: ["support", "help", "customer", "service", "agent", "headset", "centre", "center", "lifebuoy"],
    reference: ["support", "help", "customer", "service", "agent", "headset", "centre", "center", "lifebuoy"],
    preferredReferenceIds: ["generic_red_silver_help_centre_red_plus_silver"]
  },
  {
    id: "profile_user",
    prompt: ["profile", "user", "account"],
    reference: ["profile", "user", "account", "identity"],
    preferredReferenceIds: [
      "generic_silver_profile_silver",
      "generic_red_profile_red",
      "generic_red_silver_identity_red_plus_silver"
    ]
  },
  {
    id: "arrow_growth",
    prompt: ["arrow", "growth", "upward"],
    reference: ["arrow", "growth", "upward", "fast", "deposit"],
    preferredReferenceIds: ["generic_red_fast_red", "generic_red_silver_deposit_red_plus_silver"]
  },
  {
    id: "mail_envelope",
    prompt: ["mail", "envelope", "message"],
    reference: ["mail", "envelope", "message"],
    preferredReferenceIds: ["generic_red_silver_mail_red_plus_silver"]
  },
  {
    id: "folder_portfolio",
    prompt: ["portfolio", "folder", "file", "files", "document", "container"],
    reference: ["portfolio", "protfolio", "folder", "file", "files", "document", "container"],
    preferredReferenceIds: ["generic_red_silver_files_protfolio_red_plus_silver"]
  },
  {
    id: "hourglass_timer",
    prompt: ["hourglass", "sandclock", "timer"],
    reference: ["hourglass", "sandclock", "timer"],
    preferredReferenceIds: ["generic_red_silver_sandclock_red_plus_silver"]
  },
  {
    id: "leverage_balance",
    prompt: ["leverage", "seesaw", "balance"],
    reference: ["leverage", "seesaw", "balance"],
    preferredReferenceIds: ["generic_red_silver_leverage_red_plus_silver"]
  }
];

function classifyGenericFormProfile(userPrompt, matchedSubjectReference = null) {
  const text = normalizePrompt(userPrompt);
  const referenceText = normalizePrompt(getReferenceSearchText(matchedSubjectReference || {}));
  const combined = `${text} ${referenceText}`;

  if (extractExactContentTokens(userPrompt).length) {
    return {
      id: "simple_glyph_icon",
      reason: "Literal text/number/symbol prompt; keep exact glyph as a clean 3D asset."
    };
  }
  if (/\bgear\b|\bsettings\b|\bcog\b/.test(combined)) {
    return {
      id: "mechanical_object",
      reason: "Mechanical gear/settings subject; use object depth and sidewalls without over-beveling the face."
    };
  }
  if (/\bhourglass\b|\bsandclock\b|\btimer\b|\blifebuoy\b|\bseesaw\b|\bleverage\b|\bcontainer\b|\bfolder\b|\bfiles?\b|\bportfolio\b|\bprotfolio\b/.test(combined)) {
    return {
      id: "realistic_3d_object",
      reason: "Object-like reference or prompt; preserve volumetric object form instead of a flat icon outline."
    };
  }
  if (/\bmail\b|\benvelope\b|\bcard\b|\bdocument\b|\bbadge\b|\bshield\b|\bsurface\b|\bfingerprint\b|\bidentity\b/.test(combined)) {
    return {
      id: "low_relief_object",
      reason: "Low-relief/surface object; use smooth planes, soft edge thickness, and minimal bevel."
    };
  }
  if (/\bsupport\b|\bhelp\b|\bcustomer\b|\bservice\b|\bagent\b|\bheadset\b|\bcentre\b|\bcenter\b|\btransfer\b|\bsecurity\b|\btrading\b|\bfinance\b|\bcommunity\b/.test(combined)) {
    return {
      id: "complex_fintech_object",
      reason: "Complex fintech/support concept; follow the closest reference structure and object complexity."
    };
  }

  return {
    id: "simple_glyph_icon",
    reason: "Simple generic symbol/UI prompt; use clean controlled depth without excessive bevel."
  };
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

function stripTrailingPunctuation(value) {
  return String(value || "").replace(/[.\s]+$/g, "");
}

function buildColorMaterialRule(assetCategory, material, userPrompt, modules) {
  const text = normalizePrompt(userPrompt);

  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    const redSilverRule = material === MATERIALS.RED_SILVER_CHROME
      ? "The final asset must visibly include both red metallic chrome and silver metallic chrome in a meaningful way. Do not output a plain silver asset when red_silver_metallic_chrome is selected. If the matched subject reference contains a red/silver balance, preserve a similar distribution."
      : "";
    return [
      stripTrailingPunctuation(stripLeadingUse(modules[`material_${material}`])),
      "Use controlled edge depth appropriate to the matched reference and selected form profile. Do not default to plain silver chrome unless the auto-selected material is plain_metallic_chrome. If the selected material is plain_red_metallic_chrome, use red metallic chrome clearly. If the selected material is plain_metallic_chrome, use silver metallic chrome clearly.",
      redSilverRule
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

function buildGenericFormProfileRule(formProfile, matchedSubjectReference) {
  const base = [
    `Form profile: ${formProfile.id}.`,
    `Form reason: ${formProfile.reason}.`
  ];

  if (matchedSubjectReference) {
    base.push("Match the closest subject reference's form profile and edge treatment. Do not default to a heavy beveled icon. Use bevels only where the reference uses them. Preserve smooth planar faces and low-relief construction when shown in the reference.");
  }

  const profileRules = {
    simple_glyph_icon: "Use a clean simple glyph or UI-symbol form with controlled chrome extrusion. Avoid excessive bevel, chunky rims, and heavy raised outlines.",
    low_relief_object: "Use smooth planes, soft edge thickness, minimal bevel, and low-relief construction. Do not turn the subject into a thick outline icon.",
    complex_fintech_object: "Use the closest reference structure and object complexity. Preserve multi-part construction and meaningful details instead of simplifying into a basic UI icon silhouette.",
    mechanical_object: "Use object depth and sidewalls where structurally needed, but do not over-bevel the face. Bevel only the outer edges and keep functional cutouts/forms clean.",
    realistic_3d_object: "Preserve object-like volumetric form, realistic parts, and reference depth level. Do not flatten it into an icon outline or add heavy rim stacking by default."
  };

  base.push(profileRules[formProfile.id] || profileRules.simple_glyph_icon);
  base.push("Use sidewall thickness only where the reference structure requires it. Avoid thick bevels, raised outlines, heavy rim stacking, and chunky extrusion by default.");

  return base.join(" ");
}

function getPresetInstruction(modules, assetCategory, userPrompt, colorMaterialRule, options = {}) {
  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    const formRule = options.formProfile ? ` ${buildGenericFormProfileRule(options.formProfile, options.matchedSubjectReference)}` : "";
    return `In the same polished Chrome Smith 3D style as the attached style reference image, create ${userPrompt}. Use ${stripTrailingPunctuation(colorMaterialRule)}.${formRule} Match the attached angle reference exactly. Transparent background.`;
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

function getMatchedSubjectReference(selectedReferences) {
  return selectedReferences.find(reference =>
    reference.reference_role === REFERENCE_ROLES.SUBJECT_ARCHETYPE ||
    (reference.reference_roles || []).includes(REFERENCE_ROLES.SUBJECT_ARCHETYPE)
  ) || null;
}

function buildReferenceRoleInstruction(modules, matchedSubjectReference, formProfile = null) {
  if (!matchedSubjectReference) return modules.reference_role_instruction;

  return [
    "Subject reference mode is active.",
    `primary subject reference id: ${matchedSubjectReference.id}`,
    `primary subject reference path: ${matchedSubjectReference.path}`,
    ...(formProfile ? [`form profile: ${formProfile.id}`, `form profile reason: ${formProfile.reason}`] : []),
    "User request controls the requested subject.",
    "The primary subject reference controls the object's structure, silhouette, complexity, form profile, edge treatment, depth level, and visual composition. Match the subject reference's form language closely. Use it as the primary guide for the same general type of object. Do not simplify it into a generic basic icon. Do not ignore complex parts that define the icon.",
    "Match whether the reference is flat, low-relief, object-like, mechanical, or fully volumetric. Do not convert every reference into a thick beveled icon. Do not add heavy bevels unless the closest reference clearly has heavy bevels.",
    "Adapt the matched subject reference to the user prompt and auto-selected material. Material selection controls final color/material treatment. Do not copy unwanted text, background, or artifacts.",
    "Style/material reference controls only surface material, color balance, lighting, and polish. If a style reference is not a close subject match, do not copy its subject.",
    "Angle reference image controls angle only. Auto-selected material controls final color/material treatment."
  ].join("\n");
}

function buildReferenceRetrievalBlock(selectedReferences, selectedAngle, conceptPlan = null) {
  const lines = [
    "Chrome Smith selected the internal reference based on the prompt's literal subject and metaphorical meaning. Use the selected internal reference as the visual archetype for style, material behavior, form language, color balance, lighting, complexity, and edge treatment. Create the user-requested subject in that same visual system. Do not copy the reference exactly, and do not ignore it.",
    `detectedConcept: ${conceptPlan?.detectedConcept || "none"}`,
    `literalSubject: ${conceptPlan?.literalSubject || "none"}`,
    `metaphorTerms: ${(conceptPlan?.metaphorTerms || []).join(", ") || "none"}`,
    `searchedReferenceTerms: ${(conceptPlan?.searchedReferenceTerms || []).join(", ") || "none"}`,
    `selected angle id: ${selectedAngle.id}`,
    `selected angle path: ${selectedAngle.path}`,
    `attached reference order: ${REFERENCE_ROLES.ANGLE}:${selectedAngle.path}`
  ];

  selectedReferences.forEach((reference, index) => {
    lines.push(
      `reference ${index + 1} role: ${reference.reference_role}`,
      `reference ${index + 1} id: ${reference.id}`,
      `reference ${index + 1} path: ${reference.path}`,
      `reference ${index + 1} reference score: ${reference.reference_score}`,
      `reference ${index + 1} selected reference reason: ${reference.reference_reason}`
    );
  });

  return lines.join("\n");
}

function buildNegativePresetRules() {
  return "No extra objects, no background, no watermark, no unrelated text, no copied reference subject, no floor shadow, no drop shadow, no reflection underneath, no ground plane, no surface plane.";
}

function getAngleById(angleId) {
  const registry = loadAngleRegistry();
  const angles = Array.isArray(registry.angles) ? registry.angles : [];
  return angles.find(angle => angle.id === angleId) || angles.find(angle => angle.id === "angle_center") || null;
}

function getReferenceSearchText(reference) {
  return [
    reference.id,
    reference.path,
    reference.subject_type,
    reference.shape_type,
    reference.color_behavior
  ].join(" ");
}

function termMatchesPrompt(term, promptText, promptTokens) {
  const normalized = normalizePrompt(term).trim();
  if (!normalized) return false;
  if (normalized.includes(" ")) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${escaped}\\b`).test(promptText);
  }
  return promptTokens.has(normalized);
}

function getGenericAliasMatches(userPrompt) {
  const promptText = normalizePrompt(userPrompt);
  const promptTokens = new Set(tokenizeSubjectText(userPrompt));
  return GENERIC_SUBJECT_ALIASES.filter(group =>
    group.prompt.some(term => termMatchesPrompt(term, promptText, promptTokens))
  );
}

function referenceBlockedByAlias(reference, aliasMatches, userPrompt) {
  const promptText = normalizePrompt(userPrompt);
  const promptTokens = new Set(tokenizeSubjectText(userPrompt));

  return aliasMatches.some(group => {
    const blockedIds = group.blockedReferenceIds || [];
    if (!blockedIds.includes(reference.id)) return false;

    const allowedTerms = group.blockedUnlessPrompt || [];
    return !allowedTerms.some(term => termMatchesPrompt(term, promptText, promptTokens));
  });
}

function getGenericSubjectTerms(userPrompt) {
  const promptTokens = new Set(tokenizeSubjectText(userPrompt));
  const terms = new Set();

  getGenericAliasMatches(userPrompt).forEach(group => {
    group.reference.forEach(term => terms.add(term));
  });

  promptTokens.forEach(token => {
    if (!["icon", "symbol", "asset", "chrome", "red", "silver", "metallic", "and", "the", "a", "an"].includes(token)) {
      terms.add(token);
    }
  });

  return [...terms];
}

function getReferenceSubjectTerms(userPrompt, assetCategory, conceptPlan = null) {
  const text = normalizePrompt(userPrompt);
  const promptTokens = new Set(tokenizeSubjectText(userPrompt));
  const terms = new Set(getGenericSubjectTerms(userPrompt));

  if (conceptPlan) {
    [
      conceptPlan.detectedConcept,
      conceptPlan.literalSubject,
      ...(conceptPlan.metaphorTerms || []),
      ...(conceptPlan.searchedReferenceTerms || []),
      ...(conceptPlan.preferredReferenceSubjects || [])
    ].forEach(term => {
      if (term) terms.add(term);
    });
  }

  if (assetCategory === ASSET_CATEGORIES.GENERIC) {
    if (/%/.test(text)) terms.add("percent");
    if (/[$€£¥]/.test(text)) terms.add("currency");
    if (/\bmail\b|\bemail\b|\benvelope\b/.test(text)) terms.add("mail");
    if (/\bfolder\b|\bportfolio\b|\bfiles?\b/.test(text)) terms.add("portfolio");
  }

  if (assetCategory === ASSET_CATEGORIES.CRYPTO) {
    if (/\bbtc\b|\bbitcoin\b/.test(text)) ["btc", "bitcoin"].forEach(term => terms.add(term));
    if (/\beth\b|\bether\b|\bethereum\b/.test(text)) ["eth", "ethereum"].forEach(term => terms.add(term));
    if (/\bsol\b|\bsolana\b/.test(text)) ["sol", "solana"].forEach(term => terms.add(term));
    if (/\bxrp\b|\bripple\b/.test(text)) ["xrp", "ripple"].forEach(term => terms.add(term));
    if (/\bdoge\b|\bdogecoin\b/.test(text)) ["doge", "dogecoin"].forEach(term => terms.add(term));
  }

  if (assetCategory === ASSET_CATEGORIES.PRODUCT_TILE) {
    [
      "instagram", "tiktok", "whatsapp", "youtube", "facebook", "linkedin",
      "mt5", "metatrader", "ctrader", "dbot", "deriv", "options"
    ].forEach(term => {
      if (promptTokens.has(term)) terms.add(term);
    });
  }

  if (assetCategory === ASSET_CATEGORIES.MARKET) {
    [
      "nvidia", "amazon", "amzn", "apple", "gold", "oil", "usoil", "eurusd",
      "eur", "usd", "jpy", "us500", "wall", "stock", "market"
    ].forEach(term => {
      if (text.includes(term)) terms.add(term);
    });
  }

  return [...terms].filter(Boolean);
}

function getReferenceFormProfile(reference) {
  if (!reference || reference.category !== ASSET_CATEGORIES.GENERIC) return null;
  return classifyGenericFormProfile(reference.subject_type || reference.id, reference).id;
}

function scoreGenericSubjectReference(reference, userPrompt, material) {
  const terms = getGenericSubjectTerms(userPrompt);
  if (!terms.length) return 0;

  const aliasMatches = getGenericAliasMatches(userPrompt);
  if (referenceBlockedByAlias(reference, aliasMatches, userPrompt)) return 0;

  const referenceTokens = new Set(tokenizeSubjectText(getReferenceSearchText(reference)));
  const referenceText = normalizeSubjectText(getReferenceSearchText(reference));
  let score = 0;

  aliasMatches.forEach(group => {
    if ((group.preferredReferenceIds || []).includes(reference.id)) {
      score += 1000;
    }
  });

  terms.forEach(term => {
    const normalized = normalizeSubjectText(term);
    if (referenceTokens.has(term)) score += 40;
    else if (normalized && referenceText.includes(normalized)) score += 24;
  });

  if (!score) return 0;
  if (reference.material === material) score += 35;
  if (reference.shape_type === "simple_icon") score += 8;
  if (reference.shape_type === "numerical") score -= 20;
  return score;
}

function buildReferenceScoreReason(parts) {
  return parts.length ? parts.join("; ") : "Low-priority category archetype fallback.";
}

function scoreInternalReference(reference, context) {
  const {
    assetCategory,
    material,
    userPrompt,
    formProfile,
    conceptPlan
  } = context;
  const terms = getReferenceSubjectTerms(userPrompt, assetCategory, conceptPlan);
  const aliasMatches = assetCategory === ASSET_CATEGORIES.GENERIC ? getGenericAliasMatches(userPrompt) : [];
  const referenceTokens = new Set(tokenizeSubjectText(getReferenceSearchText(reference)));
  const referenceText = normalizeSubjectText(getReferenceSearchText(reference));
  const reasons = [];
  let score = 0;
  let subjectScore = 0;

  if (reference.category === assetCategory) {
    score += 150;
    reasons.push("asset category match");
  } else {
    score -= 80;
  }

  if (reference.material === material) {
    score += 120;
    reasons.push("material/color behavior match");
  }

  if (assetCategory === ASSET_CATEGORIES.GENERIC && referenceBlockedByAlias(reference, aliasMatches, userPrompt)) {
    return {
      reference,
      score: 0,
      subjectScore: 0,
      reason: "Blocked by manual alias guard."
    };
  }

  if (
    conceptPlan?.blockedReferenceSubjectsUnlessLiteral?.length &&
    !conceptPlan.blockedReferenceSubjectsUnlessLiteral.some(term => termMatchesPrompt(term, normalizePrompt(userPrompt), new Set(tokenizeSubjectText(userPrompt))))
  ) {
    const blocked = conceptPlan.blockedReferenceSubjectsUnlessLiteral.some(term => referenceText.includes(normalizeSubjectText(term)));
    if (blocked) {
      return {
        reference,
        score: 0,
        subjectScore: 0,
        reason: "Blocked by concept/metaphor guard."
      };
    }
  }

  aliasMatches.forEach(group => {
    if ((group.preferredReferenceIds || []).includes(reference.id)) {
      score += 1000;
      subjectScore += 1000;
      reasons.push(`exact manual alias match: ${group.id}`);
    }
  });

  (conceptPlan?.preferredReferenceSubjects || []).forEach(term => {
    const normalized = normalizeSubjectText(term);
    if (!normalized) return;
    if (referenceTokens.has(term) || referenceText.includes(normalized)) {
      score += 260;
      subjectScore += 260;
      reasons.push(`strong metaphor match: ${term}`);
    }
  });

  terms.forEach(term => {
    const normalized = normalizeSubjectText(term);
    if (!normalized) return;
    if (referenceTokens.has(term)) {
      score += 90;
      subjectScore += 90;
      reasons.push(`filename/subject token match: ${term}`);
    } else if (referenceText.includes(normalized)) {
      score += 60;
      subjectScore += 60;
      reasons.push(`filename/subject partial match: ${term}`);
    }
  });

  if (assetCategory === ASSET_CATEGORIES.GENERIC && formProfile) {
    const referenceFormProfile = getReferenceFormProfile(reference);
    if (referenceFormProfile && referenceFormProfile === formProfile.id) {
      score += 75;
      reasons.push(`formProfile match: ${formProfile.id}`);
    }
  }

  if (reference.angle_id) {
    score += 20;
    reasons.push("angle compatibility metadata available");
  }

  if (reference.category === assetCategory && subjectScore === 0) {
    score += 15;
    reasons.push("category archetype fallback");
  }

  if (reference.shape_type === "numerical" && !extractExactContentTokens(userPrompt).length) {
    score -= 35;
    reasons.push("reduced numerical leak risk");
  }

  return {
    reference,
    score,
    subjectScore,
    reason: buildReferenceScoreReason([...new Set(reasons)])
  };
}

function decorateReference(reference, role, retrieval) {
  return {
    ...reference,
    reference_role: role,
    reference_roles: role === REFERENCE_ROLES.SUBJECT_ARCHETYPE
      ? [REFERENCE_ROLES.SUBJECT_ARCHETYPE, REFERENCE_ROLES.STYLE_ARCHETYPE]
      : [role],
    reference_score: retrieval.score,
    reference_reason: retrieval.reason
  };
}

function findGenericSubjectReference(references, { assetCategory, material, userPrompt }) {
  if (assetCategory !== ASSET_CATEGORIES.GENERIC) return null;
  if (extractExactContentTokens(userPrompt).length) return null;

  const candidates = references
    .filter(reference => reference.category === ASSET_CATEGORIES.GENERIC)
    .map(reference => ({
      reference,
      score: scoreGenericSubjectReference(reference, userPrompt, material)
    }))
    .filter(item => item.score >= 40)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.reference || null;
}

function selectStyleReferences({ assetCategory, material, userPrompt = "", formProfile = null, conceptPlan = null, max = 3 }) {
  const registry = loadReferenceRegistry();
  const references = Array.isArray(registry.references) ? registry.references : [];
  const exactTokens = assetCategory === ASSET_CATEGORIES.GENERIC
    ? extractExactContentTokens(userPrompt)
    : [];
  const context = { assetCategory, material, userPrompt, formProfile, conceptPlan };
  const scored = references
    .map(reference => scoreInternalReference(reference, context))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const categoryScored = scored.filter(item => item.reference.category === assetCategory);

  if (!categoryScored.length) return [];

  const primary = categoryScored[0];
  const isCloseSubject = !exactTokens.length && primary.subjectScore >= 60;
  const primaryRole = isCloseSubject
    ? REFERENCE_ROLES.SUBJECT_ARCHETYPE
    : REFERENCE_ROLES.STYLE_ARCHETYPE;
  const selected = [decorateReference(primary.reference, primaryRole, primary)];

  const needsMaterialReference = primary.reference.material !== material;
  if (needsMaterialReference && selected.length < Math.min(max, 2)) {
    const materialCandidate = categoryScored.find(item =>
      item.reference.id !== primary.reference.id &&
      item.reference.material === material &&
      item.reference.shape_type !== "numerical"
    ) || categoryScored.find(item =>
      item.reference.id !== primary.reference.id &&
      item.reference.material === material
    );

    if (materialCandidate) {
      selected.push(decorateReference(materialCandidate.reference, REFERENCE_ROLES.MATERIAL, materialCandidate));
    }
  }

  return selected.slice(0, Math.min(max, 2));
}

function getFeatureModule(modules, feature) {
  const featureKey = `feature_${feature}`;
  if (!modules[featureKey]) throw new Error(`Unsupported feature: ${feature}`);
  return modules[featureKey];
}

function applyConceptMaterialPreference(materialPlan, conceptPlan, assetCategory) {
  const isExplicit = /^Explicit user material request/.test(materialPlan.reason);
  if (
    assetCategory === ASSET_CATEGORIES.GENERIC &&
    conceptPlan?.preferredMaterialBehavior &&
    !isExplicit &&
    materialPlan.material !== conceptPlan.preferredMaterialBehavior
  ) {
    return {
      material: conceptPlan.preferredMaterialBehavior,
      reason: `Auto-selected ${conceptPlan.preferredMaterialBehavior} from concept/metaphor resolver for ${conceptPlan.detectedConcept}.`
    };
  }
  return materialPlan;
}

function buildConceptFormProfile(conceptPlan, fallbackProfile) {
  if (conceptPlan?.preferredFormProfile && conceptPlan.detectedConcept !== "literal_glyph") {
    return {
      id: conceptPlan.preferredFormProfile,
      reason: `Concept/metaphor resolver selected ${conceptPlan.preferredFormProfile} for ${conceptPlan.detectedConcept}.`
    };
  }
  return fallbackProfile;
}

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildOutputRequirements(resolution = "1K", transparentBackground = true) {
  return uniqueList([
    transparentBackground ? "transparent PNG" : "PNG output",
    "isolated centered asset",
    "no floor shadow",
    "no background",
    "no external reflection",
    `${resolution} final output`
  ]);
}

function createAssetPlan({ userPrompt, selectedAngleId, resolution = "1K", transparentBackground = true }) {
  const assetCategory = classifyAssetCategory(userPrompt);
  const conceptPlan = resolvePromptConcept(userPrompt, assetCategory);
  const materialPlan = applyConceptMaterialPreference(
    classifyMaterialWithReason(userPrompt, assetCategory),
    conceptPlan,
    assetCategory
  );
  const material = materialPlan.material;
  const formProfile = assetCategory === ASSET_CATEGORIES.GENERIC
    ? buildConceptFormProfile(conceptPlan, classifyGenericFormProfile(userPrompt, null))
    : null;

  const plan = {
    subject: String(userPrompt || "").trim(),
    literalSubject: conceptPlan.literalSubject || String(userPrompt || "").trim(),
    detectedConcept: conceptPlan.detectedConcept || null,
    assetCategory,
    material,
    materialReason: materialPlan.reason,
    formProfile: formProfile?.id || null,
    formReason: formProfile?.reason || "Category reference controls form profile.",
    visualMetaphors: conceptPlan.metaphorTerms || [],
    searchedReferenceTerms: conceptPlan.searchedReferenceTerms || [],
    preferredReferenceSubjects: conceptPlan.preferredReferenceSubjects || [],
    selectedAngleId,
    outputRequirements: buildOutputRequirements(resolution, transparentBackground),
    mustInclude: [],
    mustAvoid: [],
    plannerMetadata: {
      fallbackUsed: Boolean(conceptPlan.fallbackUsed),
      blockedReferenceSubjectsUnlessLiteral: conceptPlan.blockedReferenceSubjectsUnlessLiteral || []
    }
  };

  plan.mustInclude = uniqueList([
    "premium Chrome Smith 3D asset",
    material === MATERIALS.RED_SILVER_CHROME ? "red and silver material balance" : "",
    material === MATERIALS.PLAIN_RED_CHROME ? "red metallic chrome material" : "",
    material === MATERIALS.PLAIN_CHROME ? "silver metallic chrome material" : "",
    material === MATERIALS.MULTICOLORED_TILE ? "brand-colored smooth 3D tile body" : "",
    material === MATERIALS.MULTICOLORED_COIN ? "token-colored 3D coin with readable face mark" : "",
    plan.formProfile === "low_relief_object" ? "smooth planar construction" : "",
    plan.formProfile === "simple_glyph_icon" ? "clear readable glyph silhouette" : "",
    plan.formProfile === "realistic_3d_object" ? "object-like volumetric construction" : ""
  ]);
  plan.mustAvoid = uniqueList([
    "basic outline icon",
    "heavy bevel",
    material !== MATERIALS.PLAIN_CHROME ? "plain silver only" : "",
    "background",
    "floor reflection",
    "external shadow",
    "copied reference subject",
    assetCategory === ASSET_CATEGORIES.GENERIC && extractExactContentTokens(userPrompt).length ? "changed digits, symbols, letters, or punctuation" : ""
  ]);

  return plan;
}

function selectReferencesFromAssetPlan(assetPlan) {
  const conceptPlan = {
    detectedConcept: assetPlan.detectedConcept,
    literalSubject: assetPlan.literalSubject,
    metaphorTerms: assetPlan.visualMetaphors,
    searchedReferenceTerms: assetPlan.searchedReferenceTerms,
    preferredReferenceSubjects: assetPlan.preferredReferenceSubjects,
    blockedReferenceSubjectsUnlessLiteral: assetPlan.plannerMetadata?.blockedReferenceSubjectsUnlessLiteral || []
  };
  const registry = loadReferenceRegistry();
  const references = Array.isArray(registry.references) ? registry.references : [];
  const context = {
    assetCategory: assetPlan.assetCategory,
    material: assetPlan.material,
    userPrompt: assetPlan.subject,
    formProfile: assetPlan.formProfile ? { id: assetPlan.formProfile, reason: assetPlan.formReason } : null,
    conceptPlan
  };
  const scored = references
    .map(reference => scoreInternalReference(reference, context))
    .filter(item => item.score > 0 && item.reference.category === assetPlan.assetCategory)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  const primary = scored[0];
  const selected = [decorateReference(primary.reference, REFERENCE_ROLES.STYLE_ARCHETYPE, primary)];
  const materialReference = primary.reference.material !== assetPlan.material
    ? scored.find(item => item.reference.id !== primary.reference.id && item.reference.material === assetPlan.material)
    : null;

  if (materialReference) {
    selected.push(decorateReference(materialReference.reference, REFERENCE_ROLES.MATERIAL, materialReference));
  }

  return selected;
}

function composeFinalImagePrompt(assetPlan, selectedAngle, selectedReferences) {
  const primaryReference = selectedReferences[0] || null;
  const materialReference = selectedReferences.find(reference => reference.reference_role === REFERENCE_ROLES.MATERIAL);
  const exactTokens = assetPlan.assetCategory === ASSET_CATEGORIES.GENERIC ? extractExactContentTokens(assetPlan.subject) : [];
  return [
    `Create ${assetPlan.subject} as a premium Chrome Smith 3D asset.`,
    "Use the selected internal reference as the visual archetype for style, material behavior, color balance, form language, complexity, edge treatment, and lighting.",
    "Do not copy the reference exactly. Do not ignore the reference or replace it with a basic generic icon.",
    `Primary style archetype reference: ${primaryReference?.path || "none"}.`,
    materialReference ? `Optional material reference: ${materialReference.path}. Use it only for material/color polish.` : "",
    `Material plan: ${assetPlan.material}. ${assetPlan.materialReason}`,
    assetPlan.formProfile ? `Form plan: ${assetPlan.formProfile}. ${assetPlan.formReason}` : "",
    assetPlan.mustInclude.length ? `Must include: ${assetPlan.mustInclude.join("; ")}.` : "",
    exactTokens.length ? `Preserve exact literal content: ${exactTokens.join(", ")}.` : "",
    `Use the selected angle reference as the only source of truth for camera angle: ${selectedAngle.id} (${selectedAngle.path}). Do not mirror, reverse, swap, or reinterpret left/right.`,
    "Output isolated centered transparent PNG. No floor, no background, no external shadow, no reflection."
  ].filter(Boolean).join("\n");
}

function buildPrompt({ feature, userPrompt, selectedAngleId, resolution = "1K", transparentBackground = true }) {
  getFeatureModule(loadPromptModules(), feature);
  const selectedAngle = getAngleById(selectedAngleId);

  if (!selectedAngle) {
    throw new Error("Angle registry does not contain a center fallback angle.");
  }

  const assetPlan = createAssetPlan({ userPrompt, selectedAngleId: selectedAngle.id, resolution, transparentBackground });
  const selectedReferences = selectReferencesFromAssetPlan(assetPlan);
  const primaryReference = selectedReferences[0] || null;
  const materialReference = selectedReferences.find(reference => reference.reference_role === REFERENCE_ROLES.MATERIAL) || null;
  const attachedReferenceOrder = [
    `${REFERENCE_ROLES.ANGLE}:${selectedAngle.path}`,
    ...selectedReferences.map(reference => `${reference.reference_role}:${reference.path}`)
  ];
  const finalPrompt = composeFinalImagePrompt(assetPlan, selectedAngle, selectedReferences);
  const debugMetadata = {
    promptPlanningStage: "Prompt Planner",
    assetPlan,
    plannerJSON: assetPlan,
    detectedAssetCategory: assetPlan.assetCategory,
    detectedMaterial: assetPlan.material,
    detectedConcept: assetPlan.detectedConcept,
    literalSubject: assetPlan.literalSubject,
    visualMetaphors: assetPlan.visualMetaphors,
    searchedReferenceTerms: assetPlan.searchedReferenceTerms,
    preferredReferenceSubjects: assetPlan.preferredReferenceSubjects,
    autoSelectedMaterial: assetPlan.assetCategory === ASSET_CATEGORIES.GENERIC ? assetPlan.material : null,
    materialSelectionReason: assetPlan.materialReason,
    genericFormProfile: assetPlan.formProfile,
    formProfile: assetPlan.formProfile,
    formReason: assetPlan.formReason,
    selectedPrimaryReference: primaryReference ? {
      id: primaryReference.id,
      path: primaryReference.path,
      role: primaryReference.reference_role,
      score: primaryReference.reference_score,
      reason: primaryReference.reference_reason
    } : null,
    selectedMaterialReference: materialReference ? {
      id: materialReference.id,
      path: materialReference.path,
      role: materialReference.reference_role,
      score: materialReference.reference_score,
      reason: materialReference.reference_reason
    } : null,
    selectedReferenceReason: primaryReference?.reference_reason || null,
    selectedReferenceRole: primaryReference?.reference_role || null,
    selectedReferenceScore: primaryReference?.reference_score || null,
    fallbackUsed: Boolean(assetPlan.plannerMetadata?.fallbackUsed || !primaryReference),
    selectedReferenceIds: selectedReferences.map(reference => reference.id),
    selectedReferenceRoles: selectedReferences.map(reference => reference.reference_role),
    selectedAngleId: selectedAngle.id,
    selectedAnglePath: selectedAngle.path,
    selectedPrimaryReferencePath: primaryReference?.path || null,
    selectedAngleReferencePath: selectedAngle.path,
    attachedReferenceOrder,
    finalImagePrompt: finalPrompt
  };

  return {
    feature,
    userPrompt,
    assetPlan,
    plannerJSON: assetPlan,
    assetCategory: assetPlan.assetCategory,
    material: assetPlan.material,
    materialReason: assetPlan.materialReason,
    formProfile: assetPlan.formProfile,
    formProfileReason: assetPlan.formReason,
    subjectReferenceMode: Boolean(primaryReference),
    matchedSubjectReference: primaryReference,
    primarySubjectReference: primaryReference,
    selectedStyleReferences: selectedReferences.filter(reference => reference.reference_role !== REFERENCE_ROLES.MATERIAL),
    selectedAngle,
    selectedReferences,
    debugMetadata,
    finalPrompt,
    finalImagePrompt: finalPrompt
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
  createAssetPlan,
  selectReferencesFromAssetPlan,
  composeFinalImagePrompt,
  buildPrompt
};
