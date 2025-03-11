import { CodeGen } from "../core/factory.mjs";

/**
 * @typedef {'Namespace' | 'Property'} Keyword
 */

export class PHPCodeGen extends CodeGen {
  createInterface(name, props, ...children) {
    const { extends: parentInterfaces = [] } = props;
    const extendsClause =
      parentInterfaces.length > 0
        ? ` extends ${parentInterfaces.join(", ")}`
        : "";
    return `interface ${name}${extendsClause} ${this.block(true, ...children)}`;
  }

  /**
   * 
   * @param {string} path 
   * @returns {string}
   */
  import(path) {
    return this.stmt(`use ${path}`);
  }

  /**
   *
   * @param {Keyword | import("../core/factory.mjs").Keyword} keyword
   * @param {*} props
   * @param  {...string} children
   * @returns
   */
  syntax(keyword, props = {}, ...children) {
    switch (keyword) {
      case "Program": {
        return []
          .concat("<?php", ...children)
          .filter(Boolean)
          .join("\n");
      }
      case "Namespace": {
        return `namespace ${props.name.join("\\")};`;
      }
      case "Import": {
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

        return `${modifiers} class ${name}${extendsClause}${implementsClause} ${this.block(
          true,
          ...children
        )}`;
      }
      case "Field":
      case "Property": {
        const {
          name,
          type,
          final = false,
          visibility = "private",
          readonly = false,
        } = props;

        const modifiers = [
          final ? "final" : "",
          visibility,
          readonly ? "readonly" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `${modifiers} ${type} $${name};`;
      }
      case "Constructor": {
        const { parameters = [] } = props;
        const params = parameters
          .map((p) => this.syntax("Parameter", p))
          .join(", ");

        return `public function __construct(${params}) ${this.block(
          true,
          ...children
        )}`;
      }
      case "MethodDeclaration": {
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
          .map((p) => this.syntax("Parameter", p))
          .join(", ");

        return `${modifiers} function ${name}(${params}): ${returnType}`;
      }
      case "Method": {
        return `${this.syntax("MethodDeclaration", props)} ${this.block(
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
        return super.syntax(keyword, props, ...children);
    }
  }
}
