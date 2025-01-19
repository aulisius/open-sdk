// @ts-check
import { extname, join, relative } from "node:path";
import { BaseGenerator } from "../core/generator.mjs";
import { TypeScriptCodeGen } from "./factory.mjs";
import { capitalize, cleanRef, isObjectEmpty } from "../../util.mjs";

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
      this.codeGen.syntax(
        "Program",
        {},
        this.codeGen.syntax(
          "Export",
          { isDefault: false },
          this.codeGen.createInterface(
            "OpenSDKHttpClient",
            {},
            this.codeGen.syntax("Method", {
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
        ? `${cleanRef(info.items.$ref)}[]`
        : `${info.items.type}[]`;
    }
    if (info.$ref) {
      return cleanRef(info.$ref);
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
          deps.push(cleanRef(info.$ref));
        } else if (info.type === "array") {
          if (info.items.$ref) {
            deps.push(cleanRef(info.items.$ref));
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
        this.codeGen.syntax(
          "Program",
          {},
          ...findDependents(schema).map((dependent) =>
            this.codeGen.syntax("Import", {
              importName: dependent,
              isDefault: false,
              path: `./${normalizeNameToFile(dependent)}`,
            })
          ),
          this.codeGen.syntax(
            "Export",
            { isDefault: false },
            this.codeGen.createInterface(
              name,
              {},
              ...Object.entries(properties).map(([prop, info]) =>
                this.codeGen.stmt(
                  this.codeGen.syntax("Property", {
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
        let name = `${capitalize(service)}${capitalize(method)}Query`;
        resources.push([name, qs, "query", method]);
      }
      if (Object.keys(body ?? {}).length > 0) {
        let name = `${capitalize(service)}${capitalize(method)}Command`;
        resources.push([name, body, "body", method]);
      }
      return [method, resources];
    };
    // Generate service interfaces and implementations
    for (const [service, operations] of Object.entries(
      this.spec.OperationsWithTypeDef
    )) {
      const serviceName = capitalize(service);

      let path = join(this.serviceDir, `${normalizeNameToFile(service)}.ts`);
      this.services.push({ name: service, path });

      let relatedResources = Object.fromEntries(
        Object.entries(operations).map(([method, info]) =>
          createRelatedResources(info, method, service)
        )
      );
      const createParameter = ([name, _, argName]) => {
        return this.codeGen.syntax("Parameter", {
          name: argName,
          type: name,
        });
      };

      // Generate service interface
      this.writeFile(
        path,
        this.codeGen.syntax(
          "Program",
          {},
          this.codeGen.block(
            false,
            ...this.resources.map((resource) =>
              this.codeGen.syntax("Import", {
                path: relative(
                  this.baseDir,
                  resource.path.replace(extname(resource.path), "")
                ),
                importName: resource.name,
              })
            )
          ),
          this.codeGen.block(
            false,
            ...Object.values(relatedResources).flatMap(([[name, property]]) =>
              this.codeGen.createInterface(
                name,
                ...Object.entries(property).map(([name, details]) =>
                  this.codeGen.syntax("Property", { name, ...details })
                )
              )
            )
          ),
          //
          this.codeGen.block(
            false,
            this.codeGen.syntax(
              "Export",
              {},
              this.codeGen.createInterface(
                `${serviceName}Service`,
                {},
                ...Object.entries(operations).map(([method, info]) =>
                  this.codeGen.syntax("MethodDeclaration", {
                    name: method,
                    returnType: `Promise<${this.getReturnType(info.schemas)}>`,
                    parameters: this.getMethodParameters(info.params),
                  })
                )
              )
            )
          ),
          this.codeGen.block(
            false,
            this.codeGen.syntax(
              "Export",
              {},
              this.codeGen.syntax(
                "Class",
                {
                  name: `${serviceName}ServiceImpl`,
                  interfaces: [`${capitalize(service)}Service`],
                  members: [
                    {
                      name: "httpClient",
                      type: "OpenSDKHttpClient",
                      required: true,
                    },
                  ],
                },

                ...Object.entries(operations).map(([method, info]) =>
                  this.codeGen.syntax(
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
      this.codeGen.syntax(
        "Program",
        {},
        this.codeGen.block(
          false,
          ...this.resources.map((resource) =>
            this.codeGen.syntax("Import", {
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
        this.codeGen.block(
          false,
          ...this.services.map((service) =>
            this.codeGen.syntax("Import", {
              path:
                "./" +
                relative(
                  this.baseDir,
                  service.path.replace(extname(service.path), "")
                ),
              importName: [
                `${capitalize(service.name)}Service`,
                `${capitalize(service.name)}ServiceImpl`,
              ].join(", "),
            })
          )
        ),
        this.codeGen.block(
          false,
          this.codeGen.syntax("Class", {
            name: `${capitalize(this.spec.service)}ClientFactory`,
            members: [
              {
                name: "#httpClient",
                type: "OpenSDKHttpClient",
                required: true,
              },
            ].concat(
              ...this.services.map((service) => ({
                name: capitalize(service.name),
                type: `${capitalize(service.name)}Service`,
                required: true,
              }))
            ),
          })
        ),
        this.codeGen.block(
          false,
          this.codeGen.syntax(
            "Export",
            {},
            this.codeGen.syntax(
              "FunctionDefinition",
              {
                name: `create${capitalize(this.spec.service)}Client`,
                parameters: [
                  this.codeGen.syntax("Parameter", {
                    name: "httpClient",
                    type: "OpenSDKHttpClient",
                  }),
                ],
              },
              this.codeGen.stmt(
                `return new ${capitalize(
                  this.spec.service
                )}ClientFactory(httpClient, ${this.services
                  .map(
                    (service) =>
                      `new ${capitalize(service.name)}ServiceImpl(httpClient)`
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
    const query = isObjectEmpty(params.qs) ? "null" : "query";
    const body = isObjectEmpty(params.body) ? "null" : "body";
    return `return this.#httpClient.execute("${method.toUpperCase()}", "${path}", ${query}, ${body});`;
  }
}
