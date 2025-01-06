// @ts-check
import { join } from "node:path";
import { BaseGenerator } from "../core/generator.mjs";
import { JavaCodeGen } from "./factory.mjs";
import { fetchLibTemplates } from "./templates/opensdk-lib.mjs";

export class JavaGenerator extends BaseGenerator {
  /**
   *
   * @param {JavaCodeGen} codeGen
   * @param {*} spec
   * @param {*} output
   */
  constructor(codeGen, spec, output) {
    super(codeGen, spec, output);
    this.codeGen = codeGen;
    const basePackage = spec.package || "com.opensdk.client";
    this.baseDir = join(output, "java", ...basePackage.split("."));
    this.resourceDir = join(this.baseDir, "resource");
    this.serviceDir = join(this.baseDir, "service");
    this.libDir = join(this.baseDir, "lib");
    this.basePackage = basePackage;
  }

  createDirectories() {
    [this.baseDir, this.resourceDir, this.serviceDir, this.libDir].forEach(
      (dir) => this.ensureDir(dir)
    );
  }

  generateLibrary() {
    for (const { file, template } of fetchLibTemplates()) {
      this.writeFile(
        join(this.libDir, file),
        `${this.codeGen.createStatement(
          `package ${this.basePackage}.lib`
        )}\n${template()}`
      );
    }
  }

  normalizeType(info) {
    if (info.type === "array") {
      return info.items.$ref
        ? `List<${this.cleanRef(info.items.$ref)}>`
        : `List<${this.normalizeJavaType(info.items.type)}>`;
    }
    if (info.$ref) {
      return this.cleanRef(info.$ref);
    }
    return this.normalizeJavaType(info.type);
  }

  normalizeJavaType(type) {
    const typeMap = {
      integer: "Integer",
      number: "Double",
      string: "String",
      boolean: "Boolean",
      object: "Map<String, Object>",
    };
    return typeMap[type] || "Object";
  }

  getMethodParameters(params, method, service) {
    const parameters = [];
    if (!this.isObjectEmpty(params.qs)) {
      parameters.push({
        type: `${this.capitalize(service)}${this.capitalize(method)}Query`,
        name: "query",
      });
    }
    if (!this.isObjectEmpty(params.body)) {
      parameters.push({
        type: `${this.capitalize(service)}${this.capitalize(method)}Command`,
        name: "body",
      });
    }
    return parameters;
  }

  generateResources() {
    // Generate record classes for all schemas
    for (const [name, schema] of Object.entries(this.spec.schemas)) {
      const { properties } = schema;
      this.writeFile(
        join(this.resourceDir, `${name}.java`),
        this.codeGen.createSyntax(
          "Program",
          {},
          `package ${this.basePackage}.resource;`,
          this.codeGen.createRecord(
            name,
            Object.entries(properties).map(([prop, info]) =>
              this.codeGen.createSyntax("Parameter", {
                name: prop,
                type: this.normalizeType(info),
              })
            )
          )
        )
      );
    }
  }

  generateRelatedResources(info, method, service) {
    let resourcePrefix = `${this.capitalize(service)}${this.capitalize(
      method
    )}`;
    let resources = [];

    const normalizeFieldName = (field = "") => {
      let [first, ...rest] = field.split(/[-_]/);
      return [first].concat(...rest.map(this.capitalize)).join("");
    };
    let { qs, body } = info.params;
    if (Object.keys(qs ?? {}).length > 0) {
      let className = `${resourcePrefix}Query`;
      let file = this.codeGen.createSyntax(
        "Program",
        {},
        `package ${this.basePackage}.resource;`,
        this.codeGen.createSyntax("Import", { path: `java.util` }),
        this.codeGen.createSyntax(
          "Class",
          {
            name: className,
            extends: "LinkedHashMap<String, List<String>>",
          },
          ...Object.entries(qs ?? {}).map(([name, details]) =>
            this.codeGen.createSyntax(
              "Method",
              {
                name: `${normalizeFieldName(name)}`,
                returnType: className,
                parameters: [
                  { type: "String", name: normalizeFieldName(name) },
                ],
              },
              this.codeGen.createStatement(
                `put("${name}", List.of(${normalizeFieldName(name)}))`
              ),
              this.codeGen.createStatement(`return this`)
            )
          )
        )
      );
      resources.push([className, file]);
    }
    if (Object.keys(body ?? {}).length > 0) {
      let className = `${resourcePrefix}Command`;
      let file = this.codeGen.createSyntax(
        "Program",
        {},
        `package ${this.basePackage}.resource;`,
        this.codeGen.createSyntax("Import", { path: `java.util` }),
        this.codeGen.createRecord(
          className,
          ...Object.keys(body ?? {}).map((name) => {
            this.codeGen.createSyntax("Parameter", {
              name,
              // TODO:
              type: "String",
            });
          })
        )
      );
      resources.push([className, file]);
    }
    return [method, resources];
  }

  generateServices() {
    // Generate service interfaces and implementations
    for (const [service, operations] of Object.entries(
      this.spec.OperationsWithTypeDef
    )) {
      const serviceName = this.capitalize(service);
      let relatedResources = Object.fromEntries(
        Object.entries(operations).map(([method, info]) =>
          this.generateRelatedResources(info, method, service)
        )
      );
      Object.values(relatedResources).forEach(([[className, file]]) => {
        this.writeFile(join(this.resourceDir, `${className}.java`), file);
      });
      // Generate service interface
      this.writeFile(
        join(this.serviceDir, `${serviceName}Service.java`),
        this.codeGen.createSyntax(
          "Program",
          {},
          `package ${this.basePackage}.service;`,
          this.codeGen.createSyntax("Import", { path: `java.util` }),
          this.codeGen.createSyntax("Import", {
            path: `${this.basePackage}.resource`,
          }),
          "\n",
          this.codeGen.createInterface(
            `${serviceName}Service`,
            {},
            ...Object.entries(operations).map(([method, info]) =>
              this.codeGen.createSyntax("MethodDeclaration", {
                name: method,
                returnType: this.getReturnType(info.schemas),
                parameters: this.getMethodParameters(
                  info.params,
                  method,
                  service
                ),
              })
            )
          )
        )
      );

      // Generate service implementation
      this.writeFile(
        join(this.serviceDir, `${serviceName}ServiceImpl.java`),
        this.codeGen.createSyntax(
          "Program",
          {},
          `package ${this.basePackage}.service;`,
          this.codeGen.createSyntax("Import", { path: `java.util` }),
          this.codeGen.createSyntax("Import", {
            path: `${this.basePackage}.lib`,
          }),
          this.codeGen.createSyntax("Import", {
            path: `${this.basePackage}.resource`,
          }),
          "\n",
          this.codeGen.createSyntax(
            "Class",
            {
              name: `${serviceName}ServiceImpl`,
              implements: [`${serviceName}Service`],
              final: true,
            },
            this.codeGen.createSyntax("Field", {
              name: "httpClient",
              type: "OpenSDKHttpClient",
              visibility: "private",
              final: true,
            }),
            this.codeGen.createSyntax(
              "Constructor",
              {
                name: `${serviceName}ServiceImpl`,
                parameters: [{ name: "httpClient", type: "OpenSDKHttpClient" }],
              },
              this.codeGen.createAssignment(
                "this.httpClient",
                "=",
                "httpClient"
              )
            ),
            ...Object.entries(operations).map(([method, info]) =>
              this.codeGen.createSyntax(
                "Method",
                {
                  name: method,
                  returnType: this.getReturnType(info.schemas),
                  parameters: this.getMethodParameters(info.params, method, service),
                },
                this.renderTemplate(info, this.getReturnType(info.schemas))
              )
            )
          )
        )
      );
    }
  }

  generateClient() {
    // Generate main API client
    let services = Object.keys(this.spec.OperationsWithTypeDef);
    this.writeFile(
      join(this.baseDir, "ApiClient.java"),
      this.codeGen.createSyntax(
        "Program",
        {},
        `package ${this.basePackage};`,
        this.codeGen.createSyntax("Import", {
          path: `${this.basePackage}.lib`,
          importName: "OpenSDKHttpClient",
        }),
        ...services.flatMap((service) => [
          this.codeGen.createSyntax("Import", {
            path: `${this.basePackage}.service`,
            importName: `${this.capitalize(service)}Service`,
          }),
          this.codeGen.createSyntax("Import", {
            path: `${this.basePackage}.service`,
            importName: `${this.capitalize(service)}ServiceImpl`,
          }),
        ]),
        this.codeGen.createSyntax(
          "Class",
          {
            name: "ApiClient",
            final: true,
          },
          ...services.map((service) =>
            this.codeGen.createSyntax("Field", {
              name: this.capitalize(service),
              type: `${this.capitalize(service)}Service`,
              visibility: "public",
              final: true,
            })
          ),
          this.codeGen.createSyntax(
            "Constructor",
            {
              name: "ApiClient",
              parameters: [{ name: "httpClient", type: "OpenSDKHttpClient" }],
            },
            ...services.map((service) =>
              this.codeGen.createAssignment(
                `this.${this.capitalize(service)}`,
                "=",
                `new ${this.capitalize(service)}ServiceImpl(httpClient)`
              )
            )
          )
        )
      )
    );
  }

  renderTemplate(info, returnType) {
    const { method, path, params } = info;
    const query = this.isObjectEmpty(params.qs)
      ? "Collections.emptyMap()"
      : "query";
    const body = this.isObjectEmpty(params.body) ? "null" : "body";
    let parameters = [];
    parameters.push(`"${method.toUpperCase()}"`);
    parameters.push(`"${path}"`);
    parameters.push(
      `new RequestDetails<>(${query}, Collections.emptyMap(), ${body})`
    );
    parameters.push(`${returnType}.class`);
    return `return this.httpClient.execute("${method.toUpperCase()}", "${path}", ${query}, ${body});`;
  }
}
