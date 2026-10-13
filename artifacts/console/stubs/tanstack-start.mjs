export function createServerFn() {
  const chain = {
    validator() {
      return chain;
    },
    handler(fn) {
      return fn;
    },
  };
  return chain;
}
