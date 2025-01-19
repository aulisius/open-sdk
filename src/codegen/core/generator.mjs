// @ts-check
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isObjectEmpty } from "../../util.mjs";

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
  generateRequests(info, method, service) {
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
    writeFileSync(
      path,
      `${this.codeGen.comment(
        "This file was generated with OpenSDK",
        "Do not modify this file directly",
        "Please consult documentation at https://github.com/aulisius/open-sdk"
      )}\n\n${content}`
    );
  }

  /**
   * Get parameters for a method
   * @protected
   * @param {Record<string, any>} params
   */
  getMethodParameters(params) {
    const parameters = [];
    if (!isObjectEmpty(params.qs)) {
      parameters.push({ name: "query", type: "array" });
    }
    if (!isObjectEmpty(params.body)) {
      parameters.push({ name: "body", type: "array" });
    }
    return parameters;
  }

  /**
   * Get the return type for a method
   * @protected
   * @param {Array<any>} responses
   * @returns {string}
   */
  getReturnType(responses) {
    return responses.map((response) => this.normalizeType(response[0]))[0];
  }

  /**
   * Normalize a type from OpenAPI to language specific type
   * @abstract
   * @protected
   * @param {Record<string, any>} info
   * @returns {string}
   */
  normalizeType(info) {
    throw new Error("Not implemented");
  }
}
