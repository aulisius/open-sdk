import { CodeGen } from "../core/factory.mjs";

/**
 * @typedef {'Program' | 'Import' | 'Package' | 'Class' | 'MethodDeclaration' | 'Use' |
*           'Field' | 'Constructor' | 'Method' | 'Parameter' | 'Enum' | 'Namespace' | 'Property'} Keyword
*/


export class PHPCodeGen extends CodeGen {
  createInterface(name, props, ...children) {
    const { extends: parentInterfaces = [] } = props;
    const extendsClause =
      parentInterfaces.length > 0
        ? ` extends ${parentInterfaces.join(", ")}`
        : "";
    return `interface ${name}${extendsClause} ${this.createBlock(
      true,
      ...children
    )}`;
  }

  /**
   *
   * @param {Keyword} keyword
   * @param {*} props
   * @param  {...string} children
   * @returns
   */
  createSyntax(keyword, props = {}, ...children) {
    switch (keyword) {
      case "Program": {
        return children.filter(Boolean).join("\n");
      }
      case "Namespace": {
        return `namespace ${props.name};`;
      }
      case "Use": {
        const { path } = props;
        return `use ${path};`;
      }
      case "Class": {
        const {
          name,
          implements: interfaces = [],
          extends: parentClass,
          final = false,
        } = props;

        const modifiers = [final ? "final" : ""].filter(Boolean).join(" ");

        const extendsClause = parentClass ? ` extends ${parentClass}` : "";
        const implementsClause =
          interfaces.length > 0 ? ` implements ${interfaces.join(", ")}` : "";

        return `${modifiers} class ${name}${extendsClause}${implementsClause} ${this.createBlock(
          true,
          ...children
        )}`;
      }
      case "Property": {
        const { name, type, visibility = "private", readonly = false } = props;

        const modifiers = [visibility, readonly ? "readonly" : ""]
          .filter(Boolean)
          .join(" ");

        return `${modifiers} ${type} $${name};`;
      }
      case "Constructor": {
        const { parameters = [] } = props;
        const params = parameters
          .map((p) => this.createSyntax("Parameter", p))
          .join(", ");

        return `public function __construct(${params}) ${this.createBlock(
          true,
          ...children
        )}`;
      }
      case "Method": {
        const {
          name,
          returnType = "void",
          visibility = "public",
          parameters = [],
          static: isStatic = false,
          final = false,
        } = props;

        const modifiers = [
          visibility,
          isStatic ? "static" : "",
          final ? "final" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const params = parameters
          .map((p) => this.createSyntax("Parameter", p))
          .join(", ");

        return `${modifiers} function ${name}(${params}): ${returnType} ${this.createBlock(
          true,
          ...children
        )}`;
      }
      case "Parameter": {
        const { name, type, nullable = false } = props;
        const typeHint = nullable ? `?${type}` : type;
        return `${typeHint} $${name}`;
      }
      case "Statement": {
        return children.join("");
      }
      default:
        return children.join("");
    }
  }

  createBlock(newScope = false, ...children) {
    const indent = newScope ? "    " : "";
    const body = children
      .filter(Boolean)
      .map((child) => `${indent}${child}`)
      .join("\n");
    return `{\n${body}\n}`;
  }
}
