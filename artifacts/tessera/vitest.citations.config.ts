export default {
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/message-citations.test.tsx"],
  },
};
