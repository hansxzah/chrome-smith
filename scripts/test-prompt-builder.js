const { buildPrompt } = require("../utils/promptBuilder");

const examples = [
  { userPrompt: "red chrome 20%", selectedAngleId: "angle_center", feature: "generate" },
  { userPrompt: "Instagram tile", selectedAngleId: "angle_22_5_right_facing", feature: "generate" },
  { userPrompt: "BTC coin", selectedAngleId: "angle_45_left_up", feature: "generate" },
  { userPrompt: "NVIDIA asset", selectedAngleId: "angle_45_right_down", feature: "generate" }
];

for (const example of examples) {
  const result = buildPrompt(example);
  console.log("=".repeat(80));
  console.log(`userPrompt: ${result.userPrompt}`);
  console.log(`assetCategory: ${result.assetCategory}`);
  console.log(`material: ${result.material}`);
  console.log(`selectedAngle.label: ${result.selectedAngle.label}`);
  console.log(`selectedReferences count: ${result.selectedReferences.length}`);
  console.log("finalPrompt preview:");
  console.log(result.finalPrompt.slice(0, 1200));
  if (result.finalPrompt.length > 1200) console.log("...");
}
