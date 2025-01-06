// @ts-check
import { extname, join, relative } from "node:path";
import { BaseGenerator } from "../core/generator.mjs";
import { TypeScriptCodeGen } from "./factory.mjs";

function normalizeNameToFile(resource) {
  return resource
    .split("")
    .map((s, i, arr) => {
      if (
        arr[i + 1]?.toLowerCase() === arr[i + 1] &&
        s.toUpperCase() === s &&
        i > 0
      ) {
        return "-" + s;
      }
      return s;
    })
    .join("")
    .toLowerCase();
}

export class TypeScriptGenerator extends BaseGenerator {
  /**
   *
   * @param {TypeScriptCodeGen} codeGen
   * @param {*} spec
   * @param {*} output
   */
  constructor(codeGen, spec, output) {
    super(codeGen, spec, output);
    this.codeGen = codeGen;
    this.baseDir = join(output, "typescript");
    this.resourceDir = join(this.baseDir, "resources");
    this.resources = [];
    this.services = [];
    this.serviceDir = join(this.baseDir, "services");
    this.libDir = join(this.baseDir, "lib");
  }

  createDirectories() {
    [this.baseDir, this.resourceDir, this.serviceDir, this.libDir].forEach(
      (dir) => this.ensureDir(dir)
    );
  }

  generateLibrary() {
    // Create HTTP client interface
    let path = join(this.libDir, "opensdk-http-client.ts");
    this.resources.push({ name: "OpenSDKHttpClient", path });
    this.writeFile(
      join(this.libDir, "opensdk-http-client.ts"),
      this.codeGen.createSyntax(
        "Program",
        {},
        this.codeGen.createSyntax(
          "Export",
          { isDefault: false },
          this.codeGen.createInterface(
            "OpenSDKHttpClient",
            {},
            this.codeGen.createSyntax("Method", {
              name: "execute",
              returnType: "Promise<any>",
              parameters: [
                { name: "method", type: "string" },
                { name: "path", type: "string" },
                { name: "query", type: "Record<string, any> | null" },
                { name: "body", type: "Record<string, any> | null" },
              ],
            })
          )
        )
      )
    );
  }

  normalizeType(info) {
    if (info.type === "array") {
      return info.items.$ref
        ? `${this.cleanRef(info.items.$ref)}[]`
        : `${info.items.type}[]`;
    }
    if (info.$ref) {
      return this.cleanRef(info.$ref);
    }
    const typeMap = {
      integer: "number",
      number: "number",
      string: "string",
      boolean: "boolean",
      object: "Record<string, any>",
    };
    return typeMap[info.type] || "any";
  }

  generateResources() {
    const findDependents = (schema) => {
      let deps = [];
      Object.values(schema.properties ?? {}).forEach((info) => {
        if (info.$ref) {
          deps.push(this.cleanRef(info.$ref));
        } else if (info.type === "array") {
          if (info.items.$ref) {
            deps.push(this.cleanRef(info.items.$ref));
          }
        }
      });
      return [...new Set(deps)];
    };
    // Generate interfaces for all schemas
    for (const [name, schema] of Object.entries(this.spec.schemas)) {
      const { properties, required = [] } = schema;
      let path = join(this.resourceDir, `${normalizeNameToFile(name)}.ts`);
      this.resources.push({ name, path });
      this.writeFile(
        path,
        this.codeGen.createSyntax(
          "Program",
          {},
          ...findDependents(schema).map((dependent) =>
            this.codeGen.createSyntax("Import", {
              importName: dependent,
              isDefault: false,
              path: `./${normalizeNameToFile(dependent)}`,
            })
          ),
          this.codeGen.createSyntax(
            "Export",
            { isDefault: false },
            this.codeGen.createInterface(
              name,
              {},
              ...Object.entries(properties).map(([prop, info]) =>
                this.codeGen.createStatement(
                  this.codeGen.createSyntax("Property", {
                    name: prop,
                    type: this.normalizeType(info),
                    required: required.includes(prop),
                  })
                )
              )
            )
          )
        )
      );
    }
  }

  generateServices() {
    const createRelatedResources = (info, method, service) => {
      let resources = [];
      let { qs, body } = info.params;
      if (Object.keys(qs ?? {}).length > 0) {
        let name = `${this.capitalize(service)}${this.capitalize(method)}Query`;
        resources.push([name, qs, "query", method]);
      }
      if (Object.keys(body ?? {}).length > 0) {
        let name = `${this.capitalize(service)}${this.capitalize(
          method
        )}Command`;
        resources.push([name, body, "body", method]);
      }
      return [method, resources];
    };
    // Generate service interfaces and implementations
    for (const [service, operations] of Object.entries(
      this.spec.OperationsWithTypeDef
    )) {
      const serviceName = this.capitalize(service);

      let path = join(this.serviceDir, `${normalizeNameToFile(service)}.ts`);
      this.services.push({ name: service, path });

      let relatedResources = Object.fromEntries(
        Object.entries(operations).map(([method, info]) =>
          createRelatedResources(info, method, service)
        )
      );
      const createParameter = ([name, _, argName]) => {
        return this.codeGen.createSyntax("Parameter", {
          name: argName,
          type: name,
        });
      };

      // Generate service interface
      this.writeFile(
        path,
        this.codeGen.createSyntax(
          "Program",
          {},
          this.codeGen.createBlock(
            false,
            ...this.resources.map((resource) =>
              this.codeGen.createSyntax("Import", {
                path: relative(
                  this.baseDir,
                  resource.path.replace(extname(resource.path), "")
                ),
                importName: resource.name,
              })
            )
          ),
          this.codeGen.createBlock(
            false,
            ...Object.values(relatedResources).flatMap(([[name, property]]) =>
              this.codeGen.createInterface(
                name,
                ...Object.entries(property).map(([name, details]) =>
                  this.codeGen.createSyntax("Property", { name, ...details })
                )
              )
            )
          ),
          //
          this.codeGen.createBlock(
            false,
            this.codeGen.createSyntax(
              "Export",
              {},
              this.codeGen.createInterface(
                `${serviceName}Service`,
                {},
                ...Object.entries(operations).map(([method, info]) =>
                  this.codeGen.createSyntax("MethodDeclaration", {
                    name: method,
                    returnType: `Promise<${this.getReturnType(info.schemas)}>`,
                    parameters: this.getMethodParameters(info.params),
                  })
                )
              )
            )
          ),
          this.codeGen.createBlock(
            false,
            this.codeGen.createSyntax(
              "Export",
              {},
              this.codeGen.createSyntax(
                "Class",
                {
                  name: `${serviceName}ServiceImpl`,
                  interfaces: [`${this.capitalize(service)}Service`],
                  members: [
                    {
                      name: "httpClient",
                      type: "OpenSDKHttpClient",
                      required: true,
                    },
                  ],
                },

                ...Object.entries(operations).map(([method, info]) =>
                  this.codeGen.createSyntax(
                    "MethodDefinition",
                    {
                      async: true,
                      name: method,
                      returnType: `Promise<${this.getReturnType(
                        info.schemas
                      )}>`,
                      parameters: this.getMethodParameters(info.params),
                    },
                    this.renderTemplate(info)
                  )
                )
              )
            )
          )
        )
      );
    }
  }

  generateClient() {
    // Generate main API client
    this.writeFile(
      join(this.baseDir, "client.ts"),
      this.codeGen.createSyntax(
        "Program",
        {},
        this.codeGen.createBlock(
          false,
          ...this.resources.map((resource) =>
            this.codeGen.createSyntax("Import", {
              path:
                "./" +
                relative(
                  this.baseDir,
                  resource.path.replace(extname(resource.path), "")
                ),
              importName: resource.name,
            })
          )
        ),
        this.codeGen.createBlock(
          false,
          ...this.services.map((service) =>
            this.codeGen.createSyntax("Import", {
              path:
                "./" +
                relative(
                  this.baseDir,
                  service.path.replace(extname(service.path), "")
                ),
              importName: [
                `${this.capitalize(service.name)}Service`,
                `${this.capitalize(service.name)}ServiceImpl`,
              ].join(", "),
            })
          )
        ),
        this.codeGen.createBlock(
          false,
          this.codeGen.createSyntax("Class", {
            name: `${this.capitalize(this.spec.service)}ClientFactory`,
            members: [
              {
                name: "#httpClient",
                type: "OpenSDKHttpClient",
                required: true,
              },
            ].concat(
              ...this.services.map((service) => ({
                name: this.capitalize(service.name),
                type: `${this.capitalize(service.name)}Service`,
                required: true,
              }))
            ),
          })
        ),
        this.codeGen.createBlock(
          false,
          this.codeGen.createSyntax(
            "Export",
            {},
            this.codeGen.createSyntax(
              "FunctionDefinition",
              {
                name: `create${this.capitalize(this.spec.service)}Client`,
                parameters: [
                  this.codeGen.createSyntax("Parameter", {
                    name: "httpClient",
                    type: "OpenSDKHttpClient",
                  }),
                ],
              },
              this.codeGen.createStatement(
                `return new ${this.capitalize(
                  this.spec.service
                )}ClientFactory(httpClient, ${this.services
                  .map(
                    (service) =>
                      `new ${this.capitalize(
                        service.name
                      )}ServiceImpl(httpClient)`
                  )
                  .join(",")})`
              )
            )
          )
        )
      )
    );
  }

  renderTemplate(info) {
    const { method, path, params } = info;
    const query = this.isObjectEmpty(params.qs) ? "null" : "query";
    const body = this.isObjectEmpty(params.body) ? "null" : "body";
    return `return this.#httpClient.execute("${method.toUpperCase()}", "${path}", ${query}, ${body});`;
  }
}
