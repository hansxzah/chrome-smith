# Chrome Smith Tool Instruction Guide

## Purpose
This guide defines how Chrome Smith should think, classify prompts, select references, and assemble prompts in order to generate on-brand 3D assets.

## 1. Core Tool Identity
Chrome Smith is a 3D asset generation tool for creating on-brand, reusable, premium fintech-style 3D assets.

Every output should feel:
- Premium
- Polished
- Fintech-oriented
- Clean
- Minimal
- Design-ready
- Consistent with the internal Chrome Smith 3D asset library

Every output should prioritize:
- Clear asset identity
- Smooth beveled geometry
- Controlled chrome reflections
- Premium studio lighting
- Clean silhouette
- Transparent PNG output
- Reusable design asset format

## 2. Runtime Logic Overview
Chrome Smith should not rely on a single long prompt. The tool should assemble prompts from smaller modules depending on the request.

Runtime flow:
User prompt
-> Detect feature
-> Detect asset category
-> Detect material behavior
-> Select internal reference images
-> Select angle reference
-> Assemble prompt modules
-> Send final request to image model
-> Return transparent PNG output

## 3. Required Tool Files
List the internal files:
- /prompts/chrome-smith-tool-guide.md
- /prompts/prompt-modules.json
- /reference-library/references.json
- /reference-library/angles.json
- /reference-library/

## 4. Prompt Assembly Formula
Every request should be assembled using:
Core identity block
+ Feature behavior block
+ Asset category block
+ Material behavior block
+ Reference behavior block
+ Angle behavior block
+ Output rules block
+ Negative rules block

## 5. Reference Library Principle
Chrome Smith should use the internal reference library every time. Reference images are style anchors and should guide material, bevels, lighting, reflections, shape treatment, and angle/perspective.

References should not force:
- the exact same subject
- the exact same logo
- text from the reference
- background artifacts
- layout artifacts
- unwanted labels
- extra decoration

## 6. Angle Principle
The selected angle thumbnail is the source of truth. The tool must not rely only on the angle text label.

Locked angle rule:
"Match the selected Chrome Smith angle reference exactly. Do not mirror, reverse, swap, or reinterpret the angle. Preserve the same visible sidewall direction, top or bottom tilt, object rotation, extrusion direction, and perspective shown in the selected angle reference."

## 7. Feature Modules
Chrome Smith has three feature modules:
- Generate
- Re-angle
- Array

Generate creates a new asset from a prompt.
Re-angle preserves an existing asset and changes only the perspective.
Array preserves multiple assets and arranges them into a composition.

## 8. Asset Classifier

Chrome Smith should classify the user prompt into one of four asset categories:

1. generic_assets_and_numericals
2. product_social_tiles
3. crypto_coins
4. logos_stocks_markets

Classification logic:

- If the prompt contains a number, percentage, currency symbol, check mark, arrow, basic UI symbol, simple icon, badge, profile, user, settings, gear, shield, warning, help, support, deposit, withdrawal, quote mark, or generic fintech object:
  category = generic_assets_and_numericals

- If the prompt contains a product name, app name, platform name, social media name, trading platform name, or asks for a tile for a recognizable app/product/platform:
  category = product_social_tiles

- If the prompt contains BTC, ETH, SOL, XRP, USDT, crypto, token, blockchain, coin, or similar:
  category = crypto_coins

- If the prompt contains stock, index, commodity, forex pair, market, oil, gold, silver, NVIDIA, Amazon, Apple, US500, US 500, JPY225, JPY 225, EUR/USD, DXY, VIX, or similar:
  category = logos_stocks_markets

If there is ambiguity:
- prefer the more specific category
- crypto_coins beats logos_stocks_markets when the prompt clearly mentions a crypto token
- product_social_tiles beats generic_assets_and_numericals when the prompt mentions a known app, product, or platform
- logos_stocks_markets beats generic_assets_and_numericals when the prompt mentions a market, stock, index, commodity, or forex pair

Examples:
- "20% icon" -> generic_assets_and_numericals
- "red chrome profile icon" -> generic_assets_and_numericals
- "Instagram tile" -> product_social_tiles
- "MT5 tile" -> product_social_tiles
- "BTC coin" -> crypto_coins
- "ETH coin" -> crypto_coins
- "NVIDIA asset" -> logos_stocks_markets
- "USOil asset" -> logos_stocks_markets
- "EUR/USD tile" -> logos_stocks_markets

## 9. Material Classifier

Chrome Smith should infer material behavior from the prompt and asset category.

Material options:

1. plain_metallic_chrome
2. plain_red_metallic_chrome
3. red_silver_metallic_chrome
4. chrome_tile_with_logo
5. multicolored_tile
6. multicolored_coin
7. metallic_chrome_base

Material logic:

- If category = generic_assets_and_numericals:
  - If prompt includes red chrome, red metallic, fully red, red icon, red number:
    material = plain_red_metallic_chrome
  - If prompt includes silver chrome, metallic chrome, chrome, silver:
    material = plain_metallic_chrome
  - If prompt includes red and silver, red accent, silver with red, chrome with red:
    material = red_silver_metallic_chrome
  - If prompt does not specify:
    material = plain_metallic_chrome unless a matching red or red+silver reference is stronger

- If category = product_social_tiles:
  - If prompt includes chrome tile, metallic tile, silver tile:
    material = chrome_tile_with_logo
  - Otherwise:
    material = multicolored_tile

- If category = crypto_coins:
  - material = multicolored_coin
  - coin color depends on token/logo
  - metallic chrome may be used as rim, base, or supporting material

- If category = logos_stocks_markets:
  - If logo/item recognition depends on color:
    material = metallic_chrome_base with multicolor details
  - If prompt asks for chrome, silver, metallic, or object can be represented through chrome:
    material = metallic_chrome_base
  - Shape and color depend on the logo, market, or item

Interchangeability rule:
For generic_assets_and_numericals only, plain_metallic_chrome and plain_red_metallic_chrome are interchangeable material variants. The icon shape, bevels, extrusion, angle, lighting, and composition should stay the same. Only the material color changes.

## 10. Classifier Output Format

When Chrome Smith classifies a prompt internally, it should produce this object:

```json
{
  "feature": "generate | reangle | array",
  "userPrompt": "original user prompt",
  "assetCategory": "generic_assets_and_numericals | product_social_tiles | crypto_coins | logos_stocks_markets",
  "material": "plain_metallic_chrome | plain_red_metallic_chrome | red_silver_metallic_chrome | chrome_tile_with_logo | multicolored_tile | multicolored_coin | metallic_chrome_base",
  "selectedAngleId": "angle id from angles.json",
  "referenceQuery": {
    "category": "same as assetCategory",
    "material": "same as material",
    "shape_type": "simple_icon | numerical | tile | coin | market_asset | logo_asset",
    "complexity": "simple | medium | complex"
  }
}
```
