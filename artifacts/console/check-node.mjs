const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(`@workspace/console tests require Node >= 22 (found ${process.versions.node}).`);
  process.exit(1);
}
