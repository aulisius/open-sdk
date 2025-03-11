import { readdirSync, readFileSync } from "fs";
import { join } from "path";

function readTemplate(name) {
  return readFileSync(join(import.meta.dirname, name), "utf-8");
}

const templateFiles = readdirSync(import.meta.dirname).filter((file) =>
  file.endsWith(".php")
);

export function fetchLibTemplates() {
  return templateFiles.map((file) => ({
    file,
    template: () => readTemplate(file),
  }));
}
