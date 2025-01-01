function capitalize(string) {
  return string.slice(0, 1).toUpperCase() + string.slice(1);
}

export function createElement(keyword, props = {}, ...children) {
  switch (keyword) {
    default:
      return children;
  }
}
