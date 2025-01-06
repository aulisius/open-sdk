// @ts-check
import { JavaCodeGen } from "../java/factory.mjs";
import { JavaGenerator } from "../java/generator.mjs";
import { PHPCodeGen } from "../php/factory.mjs";
import { PHPGenerator } from "../php/generator.mjs";
import { TypeScriptCodeGen } from "../typescript/factory.mjs";
import { TypeScriptGenerator } from "../typescript/generator.mjs";

const generators = {
  typescript: { CodeGen: TypeScriptCodeGen, Generator: TypeScriptGenerator },
  java: { CodeGen: JavaCodeGen, Generator: JavaGenerator },
  php: { CodeGen: PHPCodeGen, Generator: PHPGenerator },
};

/**
 * Create an SDK client for the specified language
 * @param {Record<string, any>} spec OpenAPI specification
 * @param {string} output Output directory
 * @param {keyof typeof generators} language Target language
 */
export function createClient(spec, output, language) {
  const { CodeGen, Generator } = generators[language];
  // @ts-expect-error
  const generator = new Generator(new CodeGen(), spec, output);
  generator.generate();
}
