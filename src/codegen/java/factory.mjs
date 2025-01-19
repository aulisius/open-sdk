// @ts-check
import { capitalize } from "../../util.mjs";
import { CodeGen } from "../core/factory.mjs";

export class JavaCodeGen extends CodeGen {
  createInterface(name, props, ...children) {
    const { visibility = "public", extends: parentInterfaces = [] } = props;
    const extendsClause =
      parentInterfaces.length > 0
        ? ` extends ${parentInterfaces.join(", ")}`
        : "";
    return `${this.syntax("AccessModifiers", {
      visibility,
    })} interface ${capitalize(name)}${extendsClause} ${this.block(
      true,
      ...children
    )}`;
  }

  record(record, ...fields) {
    return this.stmt(`public record ${record} (${fields.join(", ")}) {}`);
  }

  import(path, { name = "*", isStatic = false } = {}) {
    return `import ${isStatic ? "static " : ""}${path}.${name};`;
  }

  /**
   *
   * @param {import("../core/factory.mjs").Keyword} keyword
   * @param {*} props
   * @param  {...string} children
   * @returns {string}
   */
  syntax(keyword, props, ...children) {
    switch (keyword) {
      case "Program": {
        return children.filter(Boolean).join("\n");
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
        )}${extendsClause}${implementsClause} ${this.block(true, ...children)}`;
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

        return `${visibility} ${name}(${params}) ${this.block(
          true,
          ...children
        )}`;
      }
      case "MethodDeclaration": {
        const {
          name,
          returnType = "void",
          parameters = [],
          throws = [],
        } = props;
        const params = parameters
          .map((p) => this.syntax("Parameter", p))
          .join(", ");
        const throwsClause =
          throws.length > 0 ? ` throws ${throws.join(", ")}` : "";
        return `${returnType} ${name}(${params})${throwsClause}`;
      }
      case "AccessModifiers": {
        const {
          visibility,
          isStatic = false,
          final = false,
          synchronized = false,
        } = props;
        const modifiers = [
          visibility,
          isStatic ? "static" : "",
          final ? "final" : "",
          synchronized ? "synchronized" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return modifiers;
      }
      case "Method": {
        return `${this.syntax("AccessModifiers", props)} ${this.syntax(
          "MethodDeclaration",
          props
        )} ${this.block(true, ...children)}`;
      }
      case "Parameter": {
        const { name, type } = props;
        const modifiers = this.syntax("AccessModifiers", props);
        return `${modifiers ? modifiers + " " : ""}${type} ${name}`;
      }
      case "Enum": {
        const { name, values } = props;
        return `${this.syntax("AccessModifiers", {
          visibility: "public",
        })} enum ${name} ${this.block(
          true,
          ...values.map((v) => v + ","),
          ...children
        )}`;
      }
      default:
        return children.join("");
    }
  }
}
