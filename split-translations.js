import fs from "fs";
import path from "path";
import { TRANSLATIONS } from "./src/translations/allTranslations.js";

const outDir = "./src/translations";

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

Object.entries(TRANSLATIONS).forEach(([lang, data]) => {
  const filePath = path.join(outDir, `${lang}.json`);

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  console.log(`✅ Created ${lang}.json`);
});

console.log("🎉 All translation files generated!");