function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

export function createElement(keyword, props = {}, ...children) {
  switch (keyword) {
    case "interface": {
      return `
interface ${capitalize(props.name)} {
${children.join("\n")}
}`;
    }
    case "import": {
      let { path, importName, isDefault } = props;
      return `import ${
        isDefault ? importName : `{ ${importName} }`
      } from "${path}";`;
    }
    case "property": {
      let { name, required, type } = props;
      return `"${name}"${required ? "" : "?"}: ${type};`;
    }
    case "variable": {
      let { name, type, declaration = "const" } = props;
      return `${declaration} ${name}${type ? ": " + type : ""} ${
        children.length > 0 ? " = " + children.join("") : ""
      };`;
    }
    case "method_definition": {
      let { name, returnType } = props;
      return `${name}(${children.join(",")}): ${returnType};`;
    }
    default:
      return children;
  }
}
