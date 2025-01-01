// @ts-check
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
 * @typedef {"Program"
 * | "Comment"
 * | "Block"
 * | "Statement"
 * | "Class"
 * | "Import"
 * | "Export"
 * | "Enum"
 * | "TypeDefinition"
 * | "Property"
 * | "Variable"
 * | "Parameter"
 * | "MethodDeclaration"
 * | "MethodDefinition"
 * | "FunctionDeclaration"
 * | "FunctionDefinition"
 *  } Keyword
 */

let INDENT = 0;

function getIndent() {
  return new Array(INDENT).fill(" ").join("");
}

/**
 *
 * @param {Keyword} keyword
 * @param {Record<string, any>} props
 * @param  {...string} children
 */
export function createSyntax(keyword, props = {}, ...children) {
  switch (keyword) {
    case "Comment": {
      let multiline = children.length > 0;
      if (multiline) {
        return `/**\n *${children
          .map((comment) => ` * ${comment}`)
          .join("\n")}\n*/`;
      } else {
        return `// ${children.join("")}`;
      }
    }
    case "Block": {
      let { newScope = false } = props;
      if (newScope) {
        INDENT += 2;
      }
      let syntax = `${newScope ? "{" : ""}${
        children.length > 0 ? (newScope ? `\n${getIndent()}` : "\n") : ""
      }${children.join(newScope ? `\n${getIndent()}` : "\n")}\n`;
      if (newScope) {
        INDENT -= 2;
      }
      return syntax + `${newScope ? `${getIndent()}}` : ""}`;
    }
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
    case "Statement": {
      return `${getIndent()}${children};`;
    }
    case "MethodDeclaration": {
      let { name, returnType } = props;
      return `${name}(${children.join(",")})${createSyntax("TypeDefinition", {
        type: returnType,
      })}`;
    }
    case "MethodDefinition": {
      let { parameters, async } = props;
      let decl = createSyntax("MethodDeclaration", props, ...parameters);
      let body = createSyntax("Block", { newScope: true }, ...children);
      return `${async ? "async " : ""}${decl} ${body}`;
    }
    case "FunctionDeclaration": {
      let decl = createSyntax("MethodDeclaration", props, ...children);
      return `function ${decl} ${createSyntax("Block", { newScope: true })};`;
    }
    case "FunctionDefinition": {
      let defn = createSyntax("MethodDefinition", props, ...children);
      return `function ${defn}`;
    }
    case "Property": {
      let { name, required, type } = props;
      return `"${name}"${required ? "" : "?"}${createSyntax("TypeDefinition", {
        type,
      })}`;
    }
    case "Class": {
      let { name, members, parent, interfaces = [] } = props;
      return `class ${capitalize(name)}${parent ? ` extends ${parent} ` : ""}${
        interfaces.length > 0 ? ` implements ${interfaces.join(",")}` : ""
      } ${createSyntax(
        "Block",
        { newScope: true },
        ...members.map((props) =>
          createSyntax("Statement", {}, createSyntax("Property", props))
        ),
        members.length > 0
          ? createMethodDefinition(
              "constructor",
              { parameters: members },
              ...members.map((member) =>
                createAssignment(`this.${member.name}`, "=", member.name)
              )
            )
          : "",
        ...children
      )}`;
    }
    case "Program":
      return children.join("\n");
    default:
      return children;
  }
}

export function createMethodDefinition(name, { parameters }, ...children) {
  return createSyntax(
    "MethodDefinition",
    {
      name,
      parameters: parameters.map((props) => createSyntax("Parameter", props)),
    },
    ...children
  );
}

/**
 *
 * @param {string} leftExpr
 * @param {"=" | "??="} assignment
 * @param {string} rightExpr
 * @returns {string}
 */
export function createAssignment(leftExpr, assignment, rightExpr) {
  return createSyntax("Statement", {}, `${leftExpr} ${assignment} ${rightExpr}`);
}

/**
 *
 * @param {string} name
 * @param  {...string} children
 * @returns {string}
 */
export function createInterface(name, ...children) {
  return `interface ${capitalize(name)} ${createSyntax(
    "Block",
    { newScope: true },
    ...children
  )}`;
}
