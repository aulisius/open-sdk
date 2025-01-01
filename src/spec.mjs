// @ts-check
import { readFileSync } from "node:fs";

/**
 *
 * @param {string} string
 * @returns {string}
 */
function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

/**
 *
 * @param {string} string
 * @returns {string}
 */
function reverseCapitalize(string) {
  return string.slice(0, 1).toLowerCase() + string.slice(1);
}

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
    let body = {};
    let path = {};
    for (let parameter of parameters) {
      if (parameter.in === "query") {
        qs[parameter.name] = {
          required: parameter.required,
          // TODO: Expand on this
          type: parameter.schema.type,
        };
      }
    }
    return { qs, body, path };
  }
  function parseResponses(responses) {
    let schemas = [];
    for (let [status, response] of Object.entries(responses)) {
      // We support JSON response
      let schema = response.content["application/json"].schema;
      schemas.push([schema, status]);
    }
    return schemas;
  }
  for (let [NS, operations] of Object.entries(OperationsByNS)) {
    for (let [id, operation] of Object.entries(operations)) {
      let ns = NS.toLowerCase();
      let [request, method, path] = operation;
      let params = partitionParameters(request.parameters);
      let schemas = parseResponses(request.responses);
      OperationsWithTypeDef[ns] ??= {};
      OperationsWithTypeDef[ns][id] = {
        method,
        path,
        params,
        schemas,
      };
    }
  }
  return {
    service: openapi.info.title,
    schemas: openapi.components.schemas,
    OperationsByNS,
    OperationsWithTypeDef,
  };
}
