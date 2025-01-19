// @ts-check
import { readFileSync } from "node:fs";
import { capitalize, cleanRef, reverseCapitalize } from "./util.mjs";

const SUPPORTED_STATUS = [200, 201, 202, 204];

/**
 *
 * @param {string} pathToSpecFile
 * @returns
 */
export function parseSpecFile(pathToSpecFile) {
  let openapi = JSON.parse(readFileSync(pathToSpecFile, "utf-8"));
  let OperationsByNS = {};
  for (let [path, entry] of Object.entries(openapi.paths)) {
    for (let [method, request] of Object.entries(entry)) {
      let id = "";
      let [NS, ...actions] = request.operationId.split("_");
      if (actions.length === 0) {
        actions = [NS];
        NS = "api";
      }
      for (let i = 0; i < actions.length; i++) {
        id += i === 0 ? reverseCapitalize(actions[i]) : capitalize(actions[i]);
      }
      OperationsByNS[NS] ??= {};
      OperationsByNS[NS][id] = [request, method, path];
    }
  }
  let OperationsWithTypeDef = {};
  function partitionParameters(parameters) {
    let qs = {};
    let path = {};
    for (let parameter of parameters) {
      if (parameter.in === "query") {
        qs[parameter.name] = {
          required: parameter.required,
          // TODO: Expand on this
          type: parameter.schema.type ?? parameter.schema.$ref ?? "string",
        };
      }
      if (parameter.in === "path") {
        path[parameter.name] = {
          required: parameter.required,
          // TODO: Expand on this
          type: parameter.schema.type ?? parameter.schema.$ref ?? "string",
        };
      }
    }
    return { qs, path };
  }
  /**
   * @param {{ [s: string]: any; }} responses
   */
  function parseResponses(responses) {
    let schemas = [];
    for (let [status, response] of Object.entries(responses)) {
      if (!SUPPORTED_STATUS.includes(Number(status))) {
        continue;
      }
      if (!response.content) {
        schemas.push([{ $ref: "NoContentResponse" }, status]);
        continue;
      }
      let json = response.content["application/json"];
      if (json) {
        let schema = json.schema;
        schemas.push([schema, status]);
      }
    }
    return schemas;
  }
  function markRequestBody(body) {
    for (let type of [
      "application/x-www-form-urlencoded",
      "application/json",
    ]) {
      let bodySchema = body?.content?.[type];
      if (bodySchema) {
        if (bodySchema.schema?.$ref) {
          schemaTypes[cleanRef(bodySchema.schema?.$ref)] = {
            type,
            component: "body",
          };
        }
        return {
          contentType: type,
          schema: bodySchema.schema,
          required: body.required ?? false,
        };
      }
    }
    return { contentType: "void", schema: null, required: false };
  }
  const schemaTypes = {};
  for (let [NS, operations] of Object.entries(OperationsByNS)) {
    for (let [id, operation] of Object.entries(operations)) {
      let ns = reverseCapitalize(NS);
      let [request, method, path] = operation;
      let params = partitionParameters(request.parameters);
      OperationsWithTypeDef[ns] ??= {};
      OperationsWithTypeDef[ns][id] = {
        method,
        path,
        body: markRequestBody(request.requestBody),
        parameters: request.parameters,
        params,
        schemas: parseResponses(request.responses),
      };
    }
  }
  return {
    service: openapi.info.title,
    schemas: openapi.components.schemas,
    schemaTypes,
    OperationsByNS,
    OperationsWithTypeDef,
  };
}
