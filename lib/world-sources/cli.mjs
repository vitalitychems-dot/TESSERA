import { createCollector, SOURCES } from './index.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Tessera World Sources\nUsage: node cli.mjs [--source usgs|eonet|nws|celestrak]\nNo option: collect all four sources. JSON to stdout; no writes or server.\nExit: 0 all sources succeeded, 2 partial/unavailable, 1 invalid arguments.');
} else if (args.length && (args.length !== 2 || args[0] !== '--source' ||
    !Object.hasOwn(SOURCES, args[1]))) {
  console.error(JSON.stringify({ level: 'error', code: 'invalid_arguments', message: 'Use --help for allowed source IDs.' }));
  process.exitCode = 1;
} else {
  const result = await createCollector().snapshot(args.length ? [args[1]] : undefined);
  console.log(JSON.stringify(result, null, 2));
  console.error(JSON.stringify({
    level: result.status === 'ok' ? 'info' : 'warn',
    event: 'world_sources_snapshot', status: result.status,
    sources: result.sources.map(({ source, status, error, records }) =>
      ({ source, status, error, count: records.length })),
  }));
  if (result.status !== 'ok') process.exitCode = 2;
}
