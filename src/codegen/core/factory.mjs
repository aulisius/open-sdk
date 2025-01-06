// @ts-check
function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

function getIndent(level = 1) {
  return "    ".repeat(level);
}

/**
 * @typedef {'Program' | 'Import' | 'Package' | 'Class' | 'MethodDeclaration' |
 *           'Field' | 'Constructor' | 'Method' | 'Parameter' | 'Enum'} Keyword
 */

export class CodeGen {
  /**
   *
   * @param {string} stmt
   * @returns {string}
   */
  createStatement(stmt) {
    return `${stmt};`;
  }

  /**
   *
   * @param {string} leftExpr
   * @param {"="} assignment
   * @param {string} rightExpr
   * @returns {string}
   */
  createAssignment(leftExpr, assignment, rightExpr) {
    return this.createStatement(`${leftExpr} ${assignment} ${rightExpr}`);
  }
  /**
   *
   * @param  {...string} children
   * @returns {string}
   */
  createComment(...children) {
    {
      const multiline = children.length > 1;
      if (multiline) {
        return `/**\n${children.map((c) => ` * ${c}`).join("\n")}\n */`;
      }
      return `// ${children}`;
    }
  }

  /**
   * Creates a Java syntax element
   * @param {Keyword} keyword - The type of syntax element to create
   * @param {Object} props - Properties for the element
   * @param {...string} children - Child elements
   * @returns {string} The generated Java code
   */
  createSyntax(keyword, props, ...children) {
    return "";
  }

  createInterface(name, props, ...children) {
    return "";
  }

  /**
   * 
   * @param {boolean} newScope 
   * @param  {...string} children 
   * @returns {string}
   */
  createBlock(newScope, ...children) {
    if (newScope) {
      return `{
${children.map((c) => `${getIndent()}${c}`).join("\n")}
}`;
    }
    return children.join("\n");
  }
}
