// @ts-check
import { CodeGen } from "../core/factory.mjs";

function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

function mapType(type) {
  if (type === "integer") {
    return "number";
  }
  return type;
}

class Type {
  #name;
  #settings;
  constructor(name, settings) {
    this.#name = name;
    this.#settings = settings;
  }
  toSyntax() {}
}

/**
 * @typedef {"Export"
 * | "Enum"
 * | "TypeDefinition"
 * | "Property"
 * | "Variable"
 * | "Parameter"
 * | "MethodDeclaration"
 * | "MethodDefinition"
 * | "FunctionDeclaration"
 * | "FunctionDefinition"
 *  } TSKeywords
 */

export class TypeScriptCodeGen extends CodeGen {
  createInterface(name, props = {}, ...children) {
    return `interface ${capitalize(name)} ${this.createBlock(
      true,
      ...children
    )}`;
  }

  createMethodDefinition(name, { parameters }, ...children) {
    return this.createSyntax(
      "MethodDefinition",
      {
        name,
        parameters: parameters.map((props) =>
          this.createSyntax("Parameter", props)
        ),
      },
      ...children
    );
  }

  /**
   *
   * @param {import("../core/factory.mjs").Keyword | TSKeywords} keyword
   * @param {*} props
   * @param  {...string} children
   * @returns {string}
   */
  createSyntax(keyword, props = {}, ...children) {
    switch (keyword) {
      case "Import": {
        let { path, importName, isDefault } = props;
        return `import ${
          isDefault ? importName : `{ ${importName} }`
        } from "${path}";`;
      }
      case "Export": {
        let { isDefault } = props;
        return `export${isDefault ? " default" : ""} ${children.join("\n")}`;
      }
      case "Enum": {
        return props.types.join(" | ");
      }
      case "TypeDefinition": {
        return `${props.type ? ": " + mapType(props.type) : ""}`;
      }
      case "Variable": {
        let { name, type, declaration = "const" } = props;
        return `${declaration} ${name}${type ? ": " + mapType(type) : ""} ${
          children.length > 0 ? " = " + children.join("") : ""
        };`;
      }
      case "Parameter": {
        return `${props.name}: ${props.type}`;
      }
      case "MethodDeclaration": {
        let { name, returnType } = props;
        return `${name}(${children.join(",")})${this.createSyntax(
          "TypeDefinition",
          { type: returnType }
        )}`;
      }
      case "MethodDefinition": {
        let { parameters, async } = props;
        let decl = this.createSyntax("MethodDeclaration", props, ...parameters);
        let body = this.createBlock(true, ...children);
        return `${async ? "async " : ""}${decl} ${body}`;
      }
      case "FunctionDeclaration": {
        let decl = this.createSyntax("MethodDeclaration", props, ...children);
        return `function ${decl} ${this.createBlock(true)};`;
      }
      case "FunctionDefinition": {
        let defn = this.createSyntax("MethodDefinition", props, ...children);
        return `function ${defn}`;
      }
      case "Property": {
        let { name, required, type } = props;
        return `"${name}"${required ? "" : "?"}${this.createSyntax(
          "TypeDefinition",
          { type }
        )}`;
      }
      case "Class": {
        let { name, members, parent, interfaces = [] } = props;
        return `class ${capitalize(name)}${
          parent ? ` extends ${parent} ` : ""
        }${
          interfaces.length > 0 ? ` implements ${interfaces.join(",")}` : ""
        } ${this.createBlock(
          true,
          ...members.map((props) =>
            this.createStatement(this.createSyntax("Property", props))
          ),
          members.length > 0
            ? this.createMethodDefinition(
                "constructor",
                { parameters: members },
                ...members.map((member) =>
                  this.createAssignment(`this.${member.name}`, "=", member.name)
                )
              )
            : "",
          ...children
        )}`;
      }
      case "Program":
        return children.join("\n");
      default:
        return children.join("");
    }
  }
}
