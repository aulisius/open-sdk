// @ts-check
import { CodeGen } from "../core/factory.mjs";

function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

export class JavaCodeGen extends CodeGen {
  createInterface(name, props, ...children) {
    const { visibility = "public", extends: parentInterfaces = [] } = props;
    const extendsClause =
      parentInterfaces.length > 0
        ? ` extends ${parentInterfaces.join(", ")}`
        : "";
    return `${visibility} interface ${capitalize(
      name
    )}${extendsClause} ${this.createBlock(true, ...children)}`;
  }

  createRecord(record, ...fields) {
    return this.createStatement(
      `public record ${record} (${fields.join(", ")}) {}`
    );
  }

  /**
   *
   * @param {import("../core/factory.mjs").Keyword} keyword
   * @param {*} props
   * @param  {...string} children
   * @returns {string}
   */
  createSyntax(keyword, props, ...children) {
    switch (keyword) {
      case "Program": {
        return children.filter(Boolean).join("\n");
      }
      case "Import": {
        const { path, importName = "*", isStatic = false } = props;
        return `import ${isStatic ? "static " : ""}${path}.${importName};`;
      }
      case "Package": {
        return `package ${props.name};`;
      }
      case "Class": {
        const {
          name,
          visibility = "public",
          implements: interfaces = [],
          extends: parentClass,
          final = false,
          abstract = false,
        } = props;

        const modifiers = [
          visibility,
          abstract ? "abstract" : "",
          final ? "final" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const extendsClause = parentClass ? ` extends ${parentClass}` : "";
        const implementsClause =
          interfaces.length > 0 ? ` implements ${interfaces.join(", ")}` : "";

        return `${modifiers} class ${capitalize(
          name
        )}${extendsClause}${implementsClause} ${this.createBlock(
          true,
          ...children
        )}`;
      }
      case "Field": {
        const {
          name,
          type,
          visibility = "private",
          final = false,
          isStatic = false,
          volatile = false,
        } = props;

        const modifiers = [
          visibility,
          isStatic ? "static" : "",
          final ? "final" : "",
          volatile ? "volatile" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `${modifiers} ${type} ${name};`;
      }
      case "Constructor": {
        const { name, parameters = [], visibility = "public" } = props;
        const params = parameters.map((p) => `${p.type} ${p.name}`).join(", ");

        return `${visibility} ${name}(${params}) ${this.createBlock(
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
          isStatic = false,
          final = false,
          synchronized = false,
          throws = [],
        } = props;

        const modifiers = [
          visibility,
          isStatic ? "static" : "",
          final ? "final" : "",
          synchronized ? "synchronized" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const params = parameters
          .map((p) => this.createSyntax("Parameter", p))
          .join(", ");
        const throwsClause =
          throws.length > 0 ? ` throws ${throws.join(", ")}` : "";

        return `${modifiers} ${returnType} ${name}(${params})${throwsClause}`;
      }
      case "Method": {
        return `${this.createSyntax(
          "MethodDeclaration",
          props
        )} ${this.createBlock(true, ...children)}`;
      }
      case "Parameter": {
        const { name, type, final = false } = props;
        return `${final ? "final " : ""}${type} ${name}`;
      }
      default:
        return children.join("");
    }
  }
}
