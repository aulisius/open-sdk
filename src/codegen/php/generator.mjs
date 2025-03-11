// @ts-check
import { join } from "node:path";
import { BaseGenerator } from "../core/generator.mjs";
import { PHPCodeGen } from "./factory.mjs";
import { capitalize, cleanRef, isObjectEmpty } from "../../util.mjs";
import { fetchLibTemplates } from "./templates/index.mjs";
import { writeFileSync } from "node:fs";

function isPrimitive(type) {
  return ["int", "float", "string", "bool", "array", "mixed", "void"].includes(
    type
  );
}

export class PHPGenerator extends BaseGenerator {
  /**
   *
   * @param {PHPCodeGen} codeGen
   * @param {*} spec
   * @param {*} output
   */
  constructor(codeGen, spec, output) {
    super(codeGen, spec, output);
    this.codeGen = codeGen;
    this.baseNamespace = ["OpenSDK", capitalize(spec.service)];
    this.libNamespace = ["OpenSDK", "Client", "Library"];
    this.libDir = join(output, ...this.libNamespace);
    this.baseDir = join(output, ...this.baseNamespace);
    this.resourceDir = join(this.baseDir, "Resources");
  }

  createDirectories() {
    [this.baseDir, this.libDir, this.resourceDir].forEach((dir) =>
      this.ensureDir(dir)
    );
  }

  /**
   * Helper to write files
   * @protected
   * @param {string} path
   * @param {...string} content
   */
  writeFile(path, ...content) {
    writeFileSync(
      path,
      this.codeGen.syntax(
        "Program",
        {},
        this.codeGen.block(
          false,
          this.codeGen.comment(
            "This file was generated with OpenSDK",
            "Do not modify this file directly",
            "Please consult documentation at https://github.com/aulisius/open-sdk"
          )
        ),
        ...content
      )
    );
  }

  generateLibrary() {
    for (const { file, template } of fetchLibTemplates()) {
      this.writeFile(
        join(this.libDir, file),
        this.codeGen.syntax("Namespace", { name: this.libNamespace }),
        template()
      );
    }
  }

  /**
   *
   * @param {*} info
   * @returns {string}
   */
  normalizeType(info) {
    const typeMap = {
      integer: "int",
      number: "float",
      string: "string",
      boolean: "bool",
      object: "array",
    };

    if (info.type === "array") {
      return "array";
    }
    if (info.$ref) {
      return cleanRef(info.$ref);
    }
    return typeMap[info.type] || "mixed";
  }

  normalizeFieldName(field = "") {
    let [first, ...rest] = field.split(/[-_]/);
    return [first].concat(...rest.map(capitalize)).join("");
  }

  generateRequests(info, method, service) {
    let resourcePrefix = `${capitalize(method)}`;
    let resources = [];

    let { qs, path } = info.params;
    let className = `${resourcePrefix}Request`;
    let methods = [];

    let required = {
      /** @type {string[]} */
      queryParams: [],
      /** @type {string[]} */
      pathParams: [],
    };

    const createSetterMethod =
      (component) =>
      ([name, details]) => {
        if (details.required) {
          required[component].push(name);
        }
        let type = this.normalizeType(details);
        let fieldName = this.normalizeFieldName(name);
        let methodName =
          component === "queryParams"
            ? this.codeGen.stmt(`$this->setQuery("${name}", $${fieldName})`)
            : this.codeGen.stmt(
                `$this->pathParams["{${name}}"] = $${fieldName}`
              );
        return this.codeGen.syntax(
          "Method",
          {
            name: fieldName,
            returnType: className,
            visibility: "public",
            parameters: [{ type, name: fieldName }],
          },
          methodName,
          this.codeGen.stmt(`return $this`)
        );
      };

    if (info.method?.toLowerCase() !== "get") {
      methods.push(
        this.codeGen.syntax(
          "Method",
          { name: `method`, returnType: "string", visibility: "public" },
          this.codeGen.stmt(`return "${info.method.toUpperCase()}"`)
        )
      );
    }

    if (info.path) {
      methods.push(
        this.codeGen.syntax(
          "Method",
          { name: `pathRaw`, returnType: "string", visibility: "protected" },
          this.codeGen.stmt(`return "${info.path}"`)
        )
      );
    }

    const setMandatoryParams = (component, params) =>
      this.codeGen.syntax(
        "Method",
        {
          name: `mandatory${capitalize(component)}`,
          returnType: "array",
          visibility: "protected",
        },
        component === "queryParams"
          ? this.codeGen.stmt(
              `return [${params.map((q) => `"${q}"`).join(", ")}]`
            )
          : this.codeGen.stmt(
              `return [${params.map((q) => `"{${q}}"`).join(", ")}]`
            )
      );

    if (!isObjectEmpty(qs)) {
      methods.push(
        ...Object.entries(qs ?? {}).map(createSetterMethod("queryParams"))
      );
      if (required.queryParams.length > 0) {
        methods.push(setMandatoryParams("queryParams", required.queryParams));
      }
    }
    if (!isObjectEmpty(path)) {
      methods.push(
        ...Object.entries(path ?? {}).map(createSetterMethod("pathParams"))
      );
      if (required.pathParams.length > 0) {
        methods.push(setMandatoryParams("pathParams", required.pathParams));
      }
    }
    let Body = "Void";
    if (info.body) {
      if (info.body.contentType !== "void") {
        Body = this.normalizeType(info.body.schema);
        let contentType = `"${info.body.contentType}"`;
        if (info.body.contentType === "application/x-www-form-urlencoded") {
          Body = "array";
        }
        methods.push(
          this.codeGen.syntax(
            "Method",
            {
              name: `setBody`,
              returnType: "void",
              parameters: [{ name: "body", type: Body }],
              visibility: "public",
            },
            this.codeGen.stmt(
              `$this->setHeader("Content-Type", ${contentType})`
            ),
            this.codeGen.stmt(`$this->body = $body`)
          )
        );
        if (info.body.required) {
          methods.push(
            this.codeGen.syntax(
              "Method",
              {
                name: `isBodyMandatory`,
                returnType: "bool",
                visibility: "protected",
              },
              this.codeGen.stmt(`return true`)
            )
          );
        }
      }
    }
    let file = [
      this.codeGen.syntax("Namespace", {
        name: [...this.baseNamespace, capitalize(service), "Requests"],
      }),
      this.codeGen.import(
        `OpenSDK\\Client\\Library\\DefaultRequestDescription`
      ),
      !["Void", "array"].includes(Body)
        ? this.codeGen.import(
            [...this.baseNamespace, "Resources", Body].join("\\")
          )
        : "\n",
      this.codeGen.syntax(
        "Class",
        { name: className, extends: `DefaultRequestDescription` },
        ...methods
      ),
    ];
    resources.push([className, file]);
    return resources;
  }

  generateResources() {
    // Generate DTOs for all schemas
    for (const [name, schema] of Object.entries(this.spec.schemas)) {
      let schemaType = this.spec.schemaTypes[name] ?? {
        type: "application/json",
        component: "response",
      };
      const { properties, type } = schema;
      // if (type === "object" && schemaType.type === "application/json") {
      //   this.writeFile(
      //     join(this.resourceDir, `${name}.java`),
      //     this.codeGen.syntax(
      //       "Program",
      //       {},
      //       `package ${this.basePackage}.resource;`,
      //       this.codeGen.block(
      //         false,
      //         this.codeGen.block(false),
      //         this.codeGen.record(
      //           name,
      //           ...Object.entries(properties).map(
      //             ([prop, info]) =>
      //               `@JsonProperty("${prop}") ${this.codeGen.syntax(
      //                 "Parameter",
      //                 {
      //                   name: this.normalizeFieldName(prop),
      //                   type: this.normalizeType(info),
      //                 }
      //               )}`
      //           )
      //         )
      //       )
      //     )
      //   );
      // }
      if (type === "object" && schemaType.component === "response") {
        let methods = [];

        const createGetterMethod = ([field, details]) => {
          let returnType = this.normalizeType(details);
          let name = this.normalizeFieldName(field);
          return this.codeGen.syntax(
            "Method",
            { name, returnType, visibility: "public" },
            isPrimitive(returnType)
              ? this.codeGen.stmt(`return $this->body['${field}']`)
              : this.codeGen.stmt(
                  `return new ${returnType}($this->body['${field}'])`
                )
          );
        };

        methods.push(...Object.entries(properties).map(createGetterMethod));

        this.writeFile(
          join(this.resourceDir, `${name}.php`),
          ...[
            this.codeGen.block(
              false,
              this.codeGen.syntax("Namespace", {
                name: [...this.baseNamespace, "Resources"],
              }),
              this.codeGen.syntax(
                "Class",
                { name },
                this.codeGen.syntax("Field", {
                  name: "body",
                  type: "array",
                  visibility: "private",
                }),
                this.codeGen.syntax(
                  "Constructor",
                  { name, parameters: [{ name: "body", type: "array" }] },
                  this.codeGen.assignment(`$this->body`, "=", "$body")
                ),
                ...methods,
                this.codeGen.syntax(
                  "Method",
                  {
                    name: `toArray`,
                    returnType: "array",
                    visibility: "public",
                  },
                  this.codeGen.stmt(`return $this->body`)
                )
              )
            ),
          ]
        );
      } else if (
        type === "object"
        // schemaType.type === "application/x-www-form-urlencoded"
      ) {
        let methods = [];

        const createSetterMethod = ([field, details]) =>
          this.codeGen.syntax(
            "Method",
            {
              name: `${this.normalizeFieldName(field)}`,
              returnType: name,
              visibility: "public",
              parameters: [
                {
                  type: this.normalizeType(details),
                  name: this.normalizeFieldName(field),
                },
              ],
            },
            this.codeGen.stmt(
              `$this->body['${field}'] = $${this.normalizeFieldName(field)}`
            ),
            this.codeGen.stmt(`return $this`)
          );

        methods.push(...Object.entries(properties).map(createSetterMethod));

        this.writeFile(
          join(this.resourceDir, `${name}.php`),
          ...[
            this.codeGen.block(
              false,
              this.codeGen.syntax("Namespace", {
                name: [...this.baseNamespace, "Resources"],
              }),
              this.codeGen.syntax(
                "Class",
                { name },
                this.codeGen.syntax("Field", {
                  name: "body",
                  type: "array",
                  visibility: "private",
                }),
                this.codeGen.syntax(
                  "Constructor",
                  { name },
                  this.codeGen.assignment("$this->body", "=", "[]")
                ),
                ...methods,
                this.codeGen.syntax(
                  "Method",
                  {
                    name: `build`,
                    returnType: "array",
                    visibility: "public",
                  },
                  this.codeGen.stmt(`return $this->body`)
                )
              )
            ),
          ]
        );
      }
      // if (type === "string" && schema.enum) {
      //   this.writeFile(
      //     join(this.resourceDir, `${name}.java`),
      //     this.codeGen.syntax(
      //       "Program",
      //       {},
      //       `package ${this.basePackage}.resource;`,
      //       this.codeGen.block(
      //         false,
      //         this.codeGen.syntax("Enum", { name, values: schema.enum })
      //       )
      //     )
      //   );
      // }
    }
  }

  generateServices() {
    // Generate service interfaces and implementations
    for (const [service, operations] of Object.entries(
      this.spec.OperationsWithTypeDef
    )) {
      const serviceName = capitalize(service);
      let requests = Object.entries(operations).map(([method, info]) =>
        this.generateRequests(info, method, service)
      );
      let serviceDir = join(this.baseDir, capitalize(service));
      this.ensureDir(serviceDir);
      if (requests.length > 0) {
        this.ensureDir(join(serviceDir, "Requests"));
      }
      requests.forEach(([[className, file]]) =>
        this.writeFile(
          join(serviceDir, "Requests", `${className}.php`),
          ...file
        )
      );
      let resourceImports = new Set(
        Object.values(operations)
          .map((info) => this.getReturnType(info.schemas))
          .filter((type) => !isPrimitive(type?.toLowerCase()))
          .map((type) =>
            this.codeGen.import(
              [...this.baseNamespace, "Resources", type].join("\\")
            )
          )
      );
      // Generate service interface
      this.writeFile(
        join(serviceDir, `${serviceName}Service.php`),
        ...[
          this.codeGen.syntax("Namespace", { name: this.baseNamespace }),
          this.codeGen.block(
            false,
            ...requests.map(([[className]]) =>
              this.codeGen.import(
                [
                  ...this.baseNamespace,
                  capitalize(service),
                  "Requests",
                  className,
                ].join("\\")
              )
            ),
            ...resourceImports
          ),
          this.codeGen.createInterface(
            `${serviceName}Service`,
            {},
            ...Object.entries(operations).map(([method, info]) =>
              this.codeGen.stmt(
                this.codeGen.syntax("MethodDeclaration", {
                  name: method,
                  returnType:
                    this.getReturnType(info.schemas) === "Void"
                      ? "void"
                      : this.getReturnType(info.schemas),
                  parameters: [
                    { type: `${capitalize(method)}Request`, name: "request" },
                  ],
                })
              )
            )
          ),
        ]
      );

      // Generate service implementation
      this.writeFile(
        join(serviceDir, `${serviceName}ServiceImpl.php`),
        ...[
          this.codeGen.syntax("Namespace", { name: this.baseNamespace }),
          this.codeGen.block(
            false,
            ...requests.map(([[className]]) =>
              this.codeGen.import(
                [
                  ...this.baseNamespace,
                  capitalize(service),
                  "Requests",
                  className,
                ].join("\\")
              )
            ),
            this.codeGen.import(
              [...this.baseNamespace, `${serviceName}Service`].join("\\")
            ),
            this.codeGen.import(
              [...this.libNamespace, "OpenSDKHttpClient"].join("\\")
            ),
            ...resourceImports
          ),
          this.codeGen.syntax(
            "Class",
            {
              name: `${serviceName}ServiceImpl`,
              implements: [`${serviceName}Service`],
              final: true,
            },
            this.codeGen.syntax("Field", {
              name: "client",
              type: "OpenSDKHttpClient",
              visibility: "private",
            }),
            this.codeGen.syntax(
              "Constructor",
              {
                name: `${serviceName}ServiceImpl`,
                parameters: [{ name: "client", type: "OpenSDKHttpClient" }],
              },
              this.codeGen.assignment("$this->client", "=", "$client")
            ),
            ...Object.entries(operations).map(([method, info]) => {
              let returnType = this.getReturnType(info.schemas);
              return this.codeGen.syntax(
                "Method",
                {
                  name: method,
                  visibility: "public",
                  returnType: returnType === "Void" ? "void" : returnType,
                  parameters: [
                    { type: `${capitalize(method)}Request`, name: "request" },
                  ],
                },
                ...this.renderTemplate(info, returnType)
              );
            })
          ),
        ]
      );
    }
  }

  generateClient() {
    let services = Object.keys(this.spec.OperationsWithTypeDef);
    let clientName = `${capitalize(this.spec.service)}`;

    function serviceImpl(service) {
      return `${capitalize(service)}ServiceImpl`;
    }
    function serviceName(service) {
      return `${capitalize(service)}Service`;
    }

    this.writeFile(
      join(this.baseDir, `${clientName}.php`),
      ...[
        this.codeGen.syntax("Namespace", { name: this.baseNamespace }),
        this.codeGen.import(
          [...this.libNamespace, "OpenSDKHttpClient"].join("\\")
        ),
        ...services.flatMap((service) => [
          this.codeGen.import(
            [...this.baseNamespace, `${capitalize(service)}Service`].join("\\")
          ),
          this.codeGen.import(
            [...this.baseNamespace, `${capitalize(service)}ServiceImpl`].join(
              "\\"
            )
          ),
        ]),
        this.codeGen.syntax(
          "Class",
          { name: clientName },
          this.codeGen.syntax("Field", {
            name: "client",
            type: "OpenSDKHttpClient",
            visibility: "public",
            final: true,
          }),
          ...services.map((service) =>
            this.codeGen.syntax("Field", {
              name: service,
              type: `${capitalize(service)}Service`,
              visibility: "public",
              final: true,
            })
          ),
          this.codeGen.syntax(
            "Constructor",
            {
              name: clientName,
              parameters: [{ name: "client", type: "OpenSDKHttpClient" }],
            },
            this.codeGen.assignment(`$this->client`, "=", "$client"),
            ...services.map((service) =>
              this.codeGen.assignment(
                `$this->${service}`,
                "=",
                `new ${serviceImpl(service)}($client)`
              )
            )
          )
        ),
      ]
    );
  }

  renderTemplate(info, responseType) {
    let isVoidType = responseType?.toLowerCase() === "void";
    let methodDefn = [
      this.codeGen.stmt(
        `${isVoidType ? "" : "$response = "}$this->client->execute($request)`
      ),
    ];
    if (!isVoidType) {
      methodDefn.push(
        this.codeGen.stmt(`return new ${responseType}($response)`)
      );
    }
    return methodDefn;
  }
}
