// @ts-check
import { join } from "node:path";
import { capitalize, cleanRef, isObjectEmpty } from "../../util.mjs";
import { BaseGenerator } from "../core/generator.mjs";
import { JavaCodeGen } from "./factory.mjs";
import { fetchLibTemplates } from "./templates/index.mjs";

/**
 *
 * @param {string} type
 * @param {string} field
 * @returns {string}
 */
const castToString = (type, field) => {
  if (type === "String") {
    return field;
  }

  if (
    type === "Integer" ||
    type === "int" ||
    type === "Boolean" ||
    type === "boolean"
  ) {
    return `String.valueOf(${field})`;
  }
  return `${field}.toString()`;
};

/**
 *
 * @param {string} type
 * @param {boolean} enabled
 * @returns {string}
 */
function toList(type, enabled = true) {
  if (enabled) {
    return `List.of(${type})`;
  }
  return type;
}

const ScalarBoxedMap = { int: "Integer", boolean: "Boolean", void: "Void" };

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
    const basePackage = `com.opensdk.${spec.service.toLowerCase()}`;
    this.baseDir = join(output, "java", ...basePackage.split("."));
    this.resourceDir = join(this.baseDir, "resource");
    this.libDir = join(this.baseDir, "..", "lib");
    this.libPackage = `com.opensdk.lib`;
    this.basePackage = basePackage;
  }

  createDirectories() {
    [this.baseDir, this.resourceDir, this.libDir].forEach((dir) =>
      this.ensureDir(dir)
    );
  }

  generateLibrary() {
    for (const { file, template } of fetchLibTemplates()) {
      this.writeFile(
        join(this.libDir, file),
        `${this.codeGen.stmt(`package ${this.libPackage}`)}\n${template()}`
      );
    }
  }

  /**
   *
   * @param {*} info
   * @returns {string}
   */
  normalizeType(info) {
    if (info.type === "array") {
      return info.items.$ref
        ? `${cleanRef(info.items.$ref)}[]`
        : `${this.normalizeJavaType(info.items.type)}[]`;
    }
    if (info.$ref === "NoContentResponse") {
      return "Void";
    }
    if (info.type?.startsWith("#")) {
      return cleanRef(info.type);
    }
    if (info.type === "object" && info.additionalProperties) {
      return `Map<String, ${this.normalizeType(info.additionalProperties)}>`;
    }
    if (info.$ref) {
      return cleanRef(info.$ref);
    }
    return this.normalizeJavaType(info.type);
  }

  normalizeJavaType(type) {
    const typeMap = {
      integer: "int",
      number: "int",
      string: "String",
      boolean: "boolean",
    };
    return typeMap[type] || "Map<String, Object>";
  }

  normalizeFieldName(field = "") {
    let [first, ...rest] = field.split(/[-_]/);
    return [first].concat(...rest.map(capitalize)).join("");
  }

  generateResources() {
    // Generate record classes for all schemas
    for (const [name, schema] of Object.entries(this.spec.schemas)) {
      let schemaType = this.spec.schemaTypes[name] ?? {
        type: "application/json",
        component: "response",
      };
      const { properties, type } = schema;
      if (type === "object" && schemaType.type === "application/json") {
        let needsUtilPackage = Object.values(properties)
          .map((info) => this.normalizeType(info))
          .find((type) => {
            if (type.startsWith("Map<")) {
              return true;
            }
            return false;
          });
        this.writeFile(
          join(this.resourceDir, `${name}.java`),
          this.codeGen.syntax(
            "Program",
            {},
            `package ${this.basePackage}.resource;`,
            this.codeGen.block(
              false,
              this.codeGen.block(
                false,
                needsUtilPackage ? this.codeGen.import("java.util") : "",
                // TODO: This needs to be configurable
                this.codeGen.import("com.fasterxml.jackson.annotation", {
                  name: "JsonProperty",
                })
              ),
              this.codeGen.record(
                name,
                ...Object.entries(properties).map(
                  ([prop, info]) =>
                    `@JsonProperty("${prop}") ${this.codeGen.syntax(
                      "Parameter",
                      {
                        name: this.normalizeFieldName(prop),
                        type: this.normalizeType(info),
                      }
                    )}`
                )
              )
            )
          )
        );
      }
      if (
        type === "object" &&
        schemaType.type === "application/x-www-form-urlencoded"
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
              `body.put("${field}", ${toList(this.normalizeFieldName(field))})`
            ),
            this.codeGen.stmt(`return this`)
          );

        methods.push(...Object.entries(properties).map(createSetterMethod));

        this.writeFile(
          join(this.resourceDir, `${name}.java`),
          this.codeGen.syntax(
            "Program",
            {},
            `package ${this.basePackage}.resource;`,
            this.codeGen.block(
              false,
              this.codeGen.block(false, this.codeGen.import("java.util")),
              this.codeGen.syntax(
                "Class",
                { name },
                this.codeGen.syntax("Field", {
                  name: "body",
                  type: "Map<String, List<Object>>",
                  visibility: "private",
                  final: true,
                }),
                this.codeGen.syntax(
                  "Constructor",
                  {
                    name,
                    parameters: [
                      { name: "map", type: "Map<String, List<Object>>" },
                    ],
                  },
                  this.codeGen.assignment("this.body", "=", "map")
                ),
                ...methods,
                this.codeGen.syntax(
                  "Method",
                  {
                    name: `build`,
                    returnType: "Map<String, List<Object>>",
                    visibility: "public",
                  },
                  this.codeGen.stmt(`return body`)
                )
              )
            )
          )
        );
      }
      if (type === "string" && schema.enum) {
        this.writeFile(
          join(this.resourceDir, `${name}.java`),
          this.codeGen.syntax(
            "Program",
            {},
            `package ${this.basePackage}.resource;`,
            this.codeGen.block(
              false,
              this.codeGen.syntax("Enum", { name, values: schema.enum })
            )
          )
        );
      }
    }
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
        return this.codeGen.syntax(
          "Method",
          {
            name: fieldName,
            returnType: className,
            visibility: "public",
            parameters: [{ type, name: fieldName }],
          },
          this.codeGen.stmt(
            `${component}.put("${name}", ${toList(
              castToString(type, fieldName),
              component === "queryParams"
            )})`
          ),
          this.codeGen.stmt(`return this`)
        );
      };

    if (info.method?.toLowerCase() !== "get") {
      methods.push(
        this.codeGen.syntax(
          "Method",
          { name: `method`, returnType: "String", visibility: "public" },
          this.codeGen.stmt(`return "${info.method.toUpperCase()}"`)
        )
      );
    }

    if (info.path) {
      methods.push(
        this.codeGen.syntax(
          "Method",
          { name: `path`, returnType: "String", visibility: "public" },
          this.codeGen.stmt(`return "${info.path}"`)
        )
      );
    }

    const setMandatoryParams = (component, params) =>
      this.codeGen.syntax(
        "Method",
        {
          name: `mandatory${capitalize(component)}`,
          returnType: "List<String>",
          visibility: "protected",
        },
        this.codeGen.stmt(
          `return ${toList(params.map((q) => `"${q}"`).join(", "))}`
        )
      );

    if (!isObjectEmpty(qs)) {
      methods.push(
        ...Object.entries(qs ?? {}).map(createSetterMethod("queryParams"))
      );
      if (required.queryParams.length > 0) {
        methods.push(setMandatoryParams("queryParams", required.queryParams));
        // methods.push(
        //   this.codeGen.syntax(
        //     "Method",
        //     {
        //       name: `mandatoryQueryParams`,
        //       returnType: "List<String>",
        //       visibility: "protected",
        //     },
        //     this.codeGen.stmt(
        //       `return ${toList(required.query.map((q) => `"${q}"`).join(", "))}`
        //     )
        //   )
        // );
      }
    }
    if (!isObjectEmpty(path)) {
      methods.push(
        ...Object.entries(path ?? {}).map(createSetterMethod("pathParams"))
      );
      if (required.pathParams.length > 0) {
        methods.push(setMandatoryParams("pathParams", required.pathParams));
        // methods.push(
        //   this.codeGen.syntax(
        //     "Method",
        //     {
        //       name: `mandatoryPathParams`,
        //       returnType: "List<String>",
        //       visibility: "protected",
        //     },
        //     this.codeGen.stmt(
        //       `return ${toList(
        //         required.pathParams.map((q) => `"${q}"`).join(", ")
        //       )}`
        //     )
        //   )
        // );
      }
    }
    let Body = "Void";
    if (info.body) {
      if (info.body.contentType !== "void") {
        Body = this.normalizeType(info.body.schema);
        let contentType = `"${info.body.contentType}"`;
        if (info.body.contentType === "application/x-www-form-urlencoded") {
          Body = "Map<String, List<Object>>";
        }
        methods.push(
          this.codeGen.syntax(
            "Method",
            {
              name: `body`,
              returnType: "void",
              parameters: [{ name: "body", type: Body }],
              visibility: "public",
            },
            this.codeGen.stmt(`header("Content-Type", ${contentType})`),
            this.codeGen.stmt(`super.body(body)`)
          )
        );
        if (info.body.required) {
          methods.push(
            this.codeGen.syntax(
              "Method",
              {
                name: `isBodyMandatory`,
                returnType: "boolean",
                visibility: "protected",
              },
              this.codeGen.stmt(`return true`)
            )
          );
        }
      }
    }
    let file = this.codeGen.syntax(
      "Program",
      {},
      `package ${this.basePackage}.${service.toLowerCase()}.requests;`,
      this.codeGen.import(`java.util`),
      this.codeGen.import(this.libPackage),
      this.codeGen.import(`${this.basePackage}.resource`),
      this.codeGen.syntax(
        "Class",
        { name: className, extends: `DefaultRequestDescription<${Body}>` },
        ...methods
      )
    );
    resources.push([className, file]);
    return resources;
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
      let serviceDir = join(this.baseDir, service.toLowerCase());
      this.ensureDir(serviceDir);
      if (requests.length > 0) {
        this.ensureDir(join(serviceDir, "requests"));
      }
      requests.forEach(([[className, file]]) =>
        this.writeFile(join(serviceDir, "requests", `${className}.java`), file)
      );
      // Generate service interface
      this.writeFile(
        join(serviceDir, `${serviceName}Service.java`),
        this.codeGen.syntax(
          "Program",
          {},
          `package ${this.basePackage}.${service.toLowerCase()};`,
          this.codeGen.block(
            false,
            this.codeGen.import(`java.util`),
            this.codeGen.import(`${this.basePackage}.resource`),
            this.codeGen.import(
              `${this.basePackage}.${service.toLowerCase()}.requests`
            )
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
          )
        )
      );

      // Generate service implementation
      this.writeFile(
        join(serviceDir, `${serviceName}ServiceImpl.java`),
        this.codeGen.syntax(
          "Program",
          {},
          `package ${this.basePackage}.${service.toLowerCase()};`,
          this.codeGen.block(
            false,
            this.codeGen.import(`java.util`),
            this.codeGen.import(this.libPackage),
            this.codeGen.import(`${this.basePackage}.resource`),
            this.codeGen.import(
              `${this.basePackage}.${service.toLowerCase()}.requests`
            )
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
              final: true,
            }),
            this.codeGen.syntax(
              "Constructor",
              {
                name: `${serviceName}ServiceImpl`,
                parameters: [{ name: "client", type: "OpenSDKHttpClient" }],
              },
              this.codeGen.assignment("this.client", "=", "client")
            ),
            ...Object.entries(operations).map(([method, info]) =>
              this.codeGen.syntax(
                "Method",
                {
                  name: method,
                  visibility: "public",
                  returnType:
                    this.getReturnType(info.schemas) === "Void"
                      ? "void"
                      : this.getReturnType(info.schemas),
                  parameters: [
                    { type: `${capitalize(method)}Request`, name: "request" },
                  ],
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
    let clientName = `${capitalize(this.spec.service)}`;

    function serviceImpl(service) {
      return `${capitalize(service)}ServiceImpl`;
    }
    function serviceName(service) {
      return `${capitalize(service)}Service`;
    }

    this.writeFile(
      join(this.baseDir, `${clientName}.java`),
      this.codeGen.syntax(
        "Program",
        {},
        `package ${this.basePackage};`,
        this.codeGen.import(this.libPackage, { name: "OpenSDKHttpClient" }),
        ...services.flatMap((service) => [
          this.codeGen.import(`${this.basePackage}.${service.toLowerCase()}`, {
            name: serviceName(service),
          }),
          this.codeGen.import(`${this.basePackage}.${service.toLowerCase()}`, {
            name: serviceImpl(service),
          }),
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
            this.codeGen.assignment(`this.client`, "=", "client"),
            ...services.map((service) =>
              this.codeGen.assignment(
                `this.${service}`,
                "=",
                `new ${serviceImpl(service)}(client)`
              )
            )
          )
        )
      )
    );
  }

  renderTemplate(info, responseType) {
    let returnType = ScalarBoxedMap[responseType] ?? responseType;
    if (responseType?.startsWith("Map<")) {
      returnType = "HashMap";
    }
    return this.codeGen.stmt(
      `${
        responseType?.toLowerCase() === "void" ? "" : "return "
      }client.execute(request, ${returnType}.class)`
    );
  }
}
