// @ts-check
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import * as TS from "./factory.mjs";

/**
 *
 * @param {string} string
 * @returns {string}
 */
function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

/**
 * @param {Record<string, any>} object
 */
function isObjectEmpty(object) {
  return Object.keys(object ?? {}).length === 0;
}

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

const cleanRef = (ref) => ref.replace(`#/components/schemas/`, "");

function findDependents(schema) {
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
}

function normalizeType(info) {
  const { items } = info;
  if (info.type === "array") {
    if (items.type) return `${items.type}[]`;
    if (items.$ref) return `${cleanRef(items.$ref)}[]`;
  }
  if (info.$ref) {
    return `${cleanRef(info.$ref)}`;
  }
  return info.type;
}

function createHttpClientReference() {
  return createResourceInterface("OpenSDKHttpClient", {
    required: ["execute"],
    properties: {
      execute: {
        type: `(method: string, path: string, query: Record<string, any> | null, body: Record<string, any> | null) => any`,
      },
    },
  });
}

function createResourceInterface(resource, schema) {
  let { properties, required } = schema;
  return TS.createSyntax(
    "Program",
    {},
    ...findDependents(schema).map((dependent) =>
      TS.createSyntax("Import", {
        importName: dependent,
        isDefault: false,
        path: `./${normalizeNameToFile(dependent)}`,
      })
    ),
    TS.createSyntax(
      "Export",
      { isDefault: false },
      TS.createInterface(
        resource,
        ...Object.entries(properties).map(([property, info]) =>
          TS.createSyntax(
            "Statement",
            {},
            TS.createSyntax("Property", {
              name: property,
              required: required.includes(property),
              type: normalizeType(info),
            })
          )
        )
      )
    )
  );
}

function createResources(schemas, output) {
  let resources = [];
  let dir = join(output, "resources/");
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  let configurationPath = join(dir, "opensdk-http-client.ts");
  writeFileSync(configurationPath, createHttpClientReference());
  resources.push({ name: "OpenSDKHttpClient", path: configurationPath });
  for (let [name, schema] of Object.entries(schemas)) {
    let path = join(dir, normalizeNameToFile(name) + ".ts");
    writeFileSync(path, createResourceInterface(name, schema));
    resources.push({ name, path });
  }
  return resources;
}

function createReturnType(responses) {
  return responses.map((response) => normalizeType(response[0]));
}

function createRelatedResources(info, method, service) {
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
}

function renderTemplate(info) {
  let variables = {};
  variables.method = info.method;
  variables.path = info.path;
  variables.query = isObjectEmpty(info.params.qs) ? "null" : "query";
  variables.body = isObjectEmpty(info.params.body) ? "null" : "body";
  let rendered = `return this.#httpClient.execute("{{method}}", "{{path}}", {{query}}, {{body}})`;
  Object.entries(variables).forEach(([name, value]) => {
    rendered = rendered.replaceAll(`{{${name}}}`, value);
  });
  return rendered;
}

function createService(service, details, resources, dir) {
  let methods = Object.entries(details);
  let relatedResources = Object.fromEntries(
    methods.map(([method, info]) =>
      createRelatedResources(info, method, service)
    )
  );
  function createParameter([name, _, argName]) {
    return TS.createSyntax("Parameter", { name: argName, type: name });
  }
  return TS.createSyntax(
    "Program",
    {},
    TS.createSyntax(
      "Block",
      {},
      ...resources.map((resource) =>
        TS.createSyntax("Import", {
          path: relative(
            dir,
            resource.path.replace(extname(resource.path), "")
          ),
          importName: resource.name,
        })
      )
    ),
    TS.createSyntax(
      "Block",
      {},
      ...Object.values(relatedResources).flatMap(([[name, property]]) =>
        TS.createInterface(
          name,
          ...Object.entries(property).map(([name, details]) =>
            TS.createSyntax("Property", { name, ...details })
          )
        )
      )
    ),
    TS.createSyntax(
      "Block",
      {},
      TS.createSyntax(
        "Export",
        {},
        TS.createInterface(
          `${service}Service`,
          TS.createSyntax(
            "Statement",
            {},
            TS.createSyntax(
              "MethodDeclaration",
              {
                name: "setHttpClient",
                returnType: "void",
              },
              TS.createSyntax("Parameter", {
                name: "httpClient",
                type: "OpenSDKHttpClient",
              })
            )
          ),
          ...methods.map(([method, info]) =>
            TS.createSyntax(
              "Statement",
              {},
              TS.createSyntax(
                "MethodDeclaration",
                {
                  name: method,
                  // All API calls will return Promise
                  returnType: `Promise<${TS.createSyntax("Enum", {
                    types: createReturnType(info.schemas),
                  })}>`,
                },
                ...relatedResources[method].map(createParameter)
              )
            )
          )
        )
      )
    ),
    TS.createSyntax(
      "Block",
      {},
      TS.createSyntax(
        "Export",
        {},
        TS.createSyntax(
          "Class",
          {
            name: `${service}ServiceImpl`,
            interfaces: [`${capitalize(service)}Service`],
            members: [
              { name: "httpClient", type: "OpenSDKHttpClient", required: true },
            ],
          },
          TS.createMethodDefinition(
            "setHttpClient",
            { parameters: [{ name: "httpClient", type: "OpenSDKHttpClient" }] },
            TS.createAssignment(`this.httpClient`, "=", "httpClient")
          ),
          ...methods.map(([method, info]) =>
            TS.createSyntax(
              "MethodDefinition",
              {
                async: true,
                name: method,
                // All API calls will return Promise
                returnType: `Promise<${TS.createSyntax("Enum", {
                  types: createReturnType(info.schemas),
                })}>`,
                parameters: relatedResources[method].map(createParameter),
              },
              TS.createSyntax("Statement", {}, renderTemplate(info))
            )
          )
        )
      )
    )
  );
}

function createServices(operations, resources, output) {
  let services = [];
  let dir = join(output, "services/");
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  for (let [service, details] of Object.entries(operations)) {
    let path = join(dir, normalizeNameToFile(service) + ".ts");
    services.push({ name: service, path });
    writeFileSync(path, createService(service, details, resources, dir));
  }
  return [services, resources];
}

/**
 *
 * @param {Record<string, any>} spec
 * @param {string} output
 */
export function createClient(spec, output) {
  let openSdkDirectory = join(output, "opensdk");
  if (!existsSync(openSdkDirectory)) {
    mkdirSync(openSdkDirectory);
  }
  let clientFile = join(openSdkDirectory, "client.ts");
  let [services, resources] = createServices(
    spec.OperationsWithTypeDef,
    createResources(spec.schemas, openSdkDirectory),
    openSdkDirectory
  );
  let client = TS.createSyntax(
    "Program",
    {},
    TS.createSyntax(
      "Block",
      {},
      ...resources.map((resource) =>
        TS.createSyntax("Import", {
          path:
            "./" +
            relative(
              openSdkDirectory,
              resource.path.replace(extname(resource.path), "")
            ),
          importName: resource.name,
        })
      ),
      ...services.map((service) =>
        TS.createSyntax("Import", {
          path:
            "./" +
            relative(
              openSdkDirectory,
              service.path.replace(extname(service.path), "")
            ),
          importName: [
            `${capitalize(service.name)}Service`,
            `${capitalize(service.name)}ServiceImpl`,
          ].join(", "),
        })
      )
    ),
    TS.createSyntax(
      "Block",
      {},
      TS.createSyntax(
        "Class",
        {
          name: `${capitalize(spec.service)}ClientFactory`,
          members: [
            { name: "#httpClient", type: "OpenSDKHttpClient", required: true },
          ].concat(
            ...services.map((service) => ({
              name: capitalize(service.name),
              type: `${capitalize(service.name)}Service`,
              required: true,
            }))
          ),
        }
        // TS.createMethodDefinition(
        //   "setHttpClient",
        //   { parameters: [{ name: "httpClient", type: "OpenSDKHttpClient" }] },
        //   TS.createSyntax(
        //     "Statement",
        //     {},
        //     TS.createAssignment(`this.httpClient`, "=", "httpClient")
        //   ),
        //   ...services.map((service) =>
        //     TS.createSyntax(
        //       "Statement",
        //       {},
        //       `this.${service.name}.setHttpClient(httpClient)`
        //     )
        //   )
        // )
      )
    ),
    TS.createSyntax(
      "Block",
      {},
      TS.createSyntax(
        "Export",
        {},
        TS.createSyntax(
          "FunctionDefinition",
          {
            name: `create${capitalize(spec.service)}Client`,
            parameters: [
              TS.createSyntax("Parameter", {
                name: "httpClient",
                type: "OpenSDKHttpClient",
              }),
            ],
          },
          TS.createSyntax(
            "Statement",
            {},
            `return new ${capitalize(
              spec.service
            )}ClientFactory(httpClient, ${services
              .map(
                (service) =>
                  `new ${capitalize(service.name)}ServiceImpl(httpClient)`
              )
              .join(",")})`
          )
        )
      )
    )
  );
  writeFileSync(clientFile, client);
}
