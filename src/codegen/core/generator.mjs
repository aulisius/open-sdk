// @ts-check
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

export class BaseGenerator {
  /**
   * @param {import("./factory.mjs").CodeGen} codeGen
   * @param {Record<string, any>} spec
   * @param {string} output 
   */
  constructor(codeGen, spec, output) {
    this.codeGen = codeGen;
    this.spec = spec;
    this.output = output;
    this.baseDir = null;
    this.resourceDir = null;
    this.serviceDir = null;
    this.libDir = null;
  }

  /**
   * @protected
   * @param {string} str
   */
  capitalize(str) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
  }

  /**
   * @protected
   * @param {Record<string, any>} obj
   */
  isObjectEmpty(obj) {
    return Object.keys(obj ?? {}).length === 0;
  }

  /**
   * @protected
   * @param {string} ref
   */
  cleanRef(ref) {
    return this.capitalize(ref.replace(`#/components/schemas/`, ""));
  }

  /**
   * Create all required directories
   * @abstract
   */
  createDirectories() {
    throw new Error("Not implemented");
  }

  /**
   * Generate SDK library files
   * @abstract
   */
  generateLibrary() {
    throw new Error("Not implemented");
  }

  /**
   * Generate resource/model files
   * @abstract
   */
  generateResources() {
    throw new Error("Not implemented");
  }

  /**
   * Generate service related resources
   * @abstract
   */
  generateRelatedResources(info, method, service) {
    throw new Error("Not implemented");
  }

  /**
   * Generate service interfaces and implementations
   * @abstract
   */
  generateServices() {
    throw new Error("Not implemented");
  }

  /**
   * Generate the main API client
   * @abstract
   */
  generateClient() {
    throw new Error("Not implemented");
  }

  /**
   * Main entry point to generate the SDK
   */
  generate() {
    this.createDirectories();
    this.generateLibrary();
    this.generateResources();
    this.generateServices();
    this.generateClient();
  }

  /**
   * Helper to create directories if they don't exist
   * @protected
   * @param {string} dir
   */
  ensureDir(dir) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Helper to write files
   * @protected
   * @param {string} path
   * @param {string} content
   */
  writeFile(path, content) {
    writeFileSync(path, content);
  }

  /**
   * Get parameters for a method
   * @protected
   * @param {Record<string, any>} params
   */
  getMethodParameters(params) {
    const parameters = [];
    if (!this.isObjectEmpty(params.qs)) {
      parameters.push({ name: "query", type: "array" });
    }
    if (!this.isObjectEmpty(params.body)) {
      parameters.push({ name: "body", type: "array" });
    }
    return parameters;
  }

  /**
   * Get the return type for a method
   * @protected
   * @param {Array<any>} responses
   */
  getReturnType(responses) {
    return responses.map((response) => this.normalizeType(response[0]))[0];
  }

  /**
   * Normalize a type from OpenAPI to language specific type
   * @abstract
   * @protected
   * @param {Record<string, any>} info
   */
  normalizeType(info) {
    throw new Error("Not implemented");
  }
}
