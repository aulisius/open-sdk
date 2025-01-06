// @ts-check
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BaseGenerator } from "../core/generator.mjs";
import { PHPCodeGen } from "./factory.mjs";

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
    const baseNamespace = spec.namespace || "OpenSDK\\Client";
    this.baseDir = join(output, "php", ...baseNamespace.split("\\"));
    this.resourceDir = join(this.baseDir, "Resource");
    this.serviceDir = join(this.baseDir, "Service");
    this.libDir = join(this.baseDir, "Lib");
    this.baseNamespace = baseNamespace;
  }

  createDirectories() {
    [this.baseDir, this.resourceDir, this.serviceDir, this.libDir].forEach(dir => 
      this.ensureDir(dir)
    );
  }

  generateLibrary() {
    // Create HTTP client interface
    this.writeFile(
      join(this.libDir, "OpenSDKHttpClientInterface.php"),
      this.codeGen.createSyntax("Program", {},
        this.codeGen.createSyntax("Namespace", { name: `${this.baseNamespace}\\Lib` }),
        this.codeGen.createInterface("OpenSDKHttpClientInterface", 
          { extends: ["\\Psr\\Http\\Client\\ClientInterface"] },
          this.codeGen.createSyntax("Method", {
            name: "execute",
            returnType: "mixed",
            parameters: [
              { name: "method", type: "string" },
              { name: "path", type: "string" },
              { name: "query", type: "?array", nullable: true },
              { name: "body", type: "?array", nullable: true }
            ]
          })
        )
      )
    );
  }

  normalizeType(info) {
    const typeMap = {
      integer: "int",
      number: "float",
      string: "string",
      boolean: "bool",
      object: "array"
    };

    if (info.type === "array") {
      return "array";
    }
    if (info.$ref) {
      return this.cleanRef(info.$ref);
    }
    return typeMap[info.type] || "mixed";
  }

  generateResources() {
    // Generate DTOs for all schemas
    for (const [name, schema] of Object.entries(this.spec.schemas)) {
      const { properties } = schema;
      this.writeFile(
        join(this.resourceDir, `${name}.php`),
        this.codeGen.createSyntax("Program", {},
          this.codeGen.createSyntax("Namespace", { name: `${this.baseNamespace}\\Resource` }),
          this.codeGen.createSyntax("Class", {
            name,
            final: true
          },
          ...Object.entries(properties).map(([property, info]) =>
            this.codeGen.createSyntax("Property", {
              name: property,
              type: this.normalizeType(info),
              readonly: true
            })
          ),
          this.codeGen.createSyntax("Constructor", {
            parameters: Object.entries(properties).map(([property, info]) => ({
              name: property,
              type: this.normalizeType(info)
            }))
          },
          ...Object.keys(properties).map(property =>
            this.codeGen.createStatement(`$this->${property} = $${property}`)
          )))
        )
      );
    }
  }

  generateServices() {
    // Generate service interfaces and implementations
    for (const [service, operations] of Object.entries(this.spec.OperationsWithTypeDef)) {
      const serviceName = this.capitalize(service);
      
      // Generate service interface
      this.writeFile(
        join(this.serviceDir, `${serviceName}ServiceInterface.php`),
        this.codeGen.createSyntax("Program", {},
          this.codeGen.createSyntax("Namespace", { name: `${this.baseNamespace}\\Service` }),
          this.codeGen.createInterface(`${serviceName}ServiceInterface`, {},
            ...Object.entries(operations).map(([method, info]) =>
              this.codeGen.createSyntax("Method", {
                name: method,
                returnType: this.getReturnType(info.schemas),
                parameters: this.getMethodParameters(info.params)
              })
            )
          )
        )
      );

      // Generate service implementation
      this.writeFile(
        join(this.serviceDir, `${serviceName}Service.php`),
        this.codeGen.createSyntax("Program", {},
          this.codeGen.createSyntax("Namespace", { name: `${this.baseNamespace}\\Service` }),
          this.codeGen.createSyntax("Class", {
            name: `${serviceName}Service`,
            implements: [`${serviceName}ServiceInterface`],
            final: true
          },
          this.codeGen.createSyntax("Property", {
            name: "httpClient",
            type: "OpenSDKHttpClientInterface",
            readonly: true,
            visibility: "private"
          }),
          this.codeGen.createSyntax("Constructor", {
            parameters: [{ name: "httpClient", type: "OpenSDKHttpClientInterface" }]
          },
          this.codeGen.createStatement("$this->httpClient = $httpClient")),
          ...Object.entries(operations).map(([method, info]) =>
            this.codeGen.createSyntax("Method", {
              name: method,
              returnType: this.getReturnType(info.schemas),
              parameters: this.getMethodParameters(info.params),
              body: this.renderTemplate(info)
            })
          ))
        )
      );
    }
  }

  generateClient() {
    // Generate main API client
    this.writeFile(
      join(this.baseDir, "ApiClient.php"),
      this.codeGen.createSyntax("Program", {},
        this.codeGen.createSyntax("Namespace", { name: this.baseNamespace }),
        this.codeGen.createSyntax("Class", {
          name: "ApiClient",
          final: true
        },
        this.codeGen.createSyntax("Property", {
          name: "httpClient",
          type: "OpenSDKHttpClientInterface",
          readonly: true,
          visibility: "private"
        }),
        ...Object.keys(this.spec.OperationsWithTypeDef).map(service =>
          this.codeGen.createSyntax("Property", {
            name: service.toLowerCase(),
            type: `${this.capitalize(service)}Service`,
            readonly: true,
            visibility: "public"
          })
        ),
        this.codeGen.createSyntax("Constructor", {
          parameters: [{ name: "httpClient", type: "OpenSDKHttpClientInterface" }]
        },
        this.codeGen.createStatement("$this->httpClient = $httpClient"),
        ...Object.keys(this.spec.OperationsWithTypeDef).map(service =>
          this.codeGen.createStatement(
            `$this->${service.toLowerCase()} = new ${this.capitalize(service)}Service($httpClient)`
          )
        )))
      )
    );
  }

  renderTemplate(info) {
    const { method, path, params } = info;
    const query = this.isObjectEmpty(params.qs) ? "null" : "$query";
    const body = this.isObjectEmpty(params.body) ? "null" : "$body";
    return `return $this->httpClient->execute('${method.toUpperCase()}', '${path}', ${query}, ${body});`;
  }
}
