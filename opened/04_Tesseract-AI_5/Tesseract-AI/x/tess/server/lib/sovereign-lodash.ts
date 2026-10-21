import _ from "lodash";
import { logger } from "../logger";
import { appendAuditLog } from "../pg-audit-trail";

const BLOCKED_PATTERNS = [
  /__proto__/,
  /constructor\s*\[/,
  /prototype\s*\[/,
  /\.__proto__/,
  /\[["']__proto__["']\]/,
];

function isPrototypePollutionAttempt(key: unknown): boolean {
  if (typeof key !== "string") return false;
  return BLOCKED_PATTERNS.some((r) => r.test(key));
}

function sanitizePath(path: unknown): unknown {
  if (typeof path === "string" && isPrototypePollutionAttempt(path)) {
    logger.warn("SovereignLodash", "Blocked prototype pollution path", { path });
    appendAuditLog({
      action: "SOVEREIGN_LODASH_BLOCK",
      actorId: "system",
      resourceType: "dependency",
      resourceId: "lodash",
      details: { threat: "prototype_pollution", blockedPath: path },
      severity: "critical",
    }).catch(() => {});
    return "__BLOCKED__";
  }
  if (Array.isArray(path)) {
    return path.map((p) => sanitizePath(p));
  }
  return path;
}

export const sovereign = {
  get: _.get.bind(_),
  set: (obj: object, path: unknown, value: unknown) => {
    const safe = sanitizePath(path);
    if (safe === "__BLOCKED__") return obj;
    return _.set(obj as any, safe as any, value);
  },
  unset: (obj: object, path: unknown) => {
    const safe = sanitizePath(path);
    if (safe === "__BLOCKED__") return false;
    return _.unset(obj as any, safe as any);
  },
  omit: (obj: object, ...paths: unknown[]) => {
    const safe = paths.map(sanitizePath).filter((p) => p !== "__BLOCKED__");
    return _.omit(obj as any, ...(safe as any[]));
  },
  pick: _.pick.bind(_),
  merge: (object: object, ...sources: object[]) => {
    const cleaned = sources.map((s) => {
      if (s && typeof s === "object") {
        const copy = { ...s } as any;
        delete copy.__proto__;
        delete copy.constructor;
        delete copy.prototype;
        return copy;
      }
      return s;
    });
    return _.merge(object, ...cleaned);
  },
  cloneDeep: _.cloneDeep.bind(_),
  isEqual: _.isEqual.bind(_),
  debounce: _.debounce.bind(_),
  throttle: _.throttle.bind(_),
  chunk: _.chunk.bind(_),
  flatten: _.flatten.bind(_),
  flatMap: _.flatMap.bind(_),
  groupBy: _.groupBy.bind(_),
  sortBy: _.sortBy.bind(_),
  orderBy: _.orderBy.bind(_),
  map: _.map.bind(_),
  filter: _.filter.bind(_),
  find: _.find.bind(_),
  findIndex: _.findIndex.bind(_),
  reduce: _.reduce.bind(_),
  keyBy: _.keyBy.bind(_),
  values: _.values.bind(_),
  keys: _.keys.bind(_),
  entries: _.entries.bind(_),
  toPairs: _.toPairs.bind(_),
  fromPairs: _.fromPairs.bind(_),
  uniq: _.uniq.bind(_),
  uniqBy: _.uniqBy.bind(_),
  difference: _.difference.bind(_),
  intersection: _.intersection.bind(_),
  union: _.union.bind(_),
  compact: _.compact.bind(_),
  isEmpty: _.isEmpty.bind(_),
  isNil: _.isNil.bind(_),
  isArray: _.isArray.bind(_),
  isObject: _.isObject.bind(_),
  isString: _.isString.bind(_),
  isNumber: _.isNumber.bind(_),
  isFunction: _.isFunction.bind(_),
  has: _.has.bind(_),
  defaults: _.defaults.bind(_),
  defaultsDeep: _.defaultsDeep.bind(_),
  capitalize: _.capitalize.bind(_),
  camelCase: _.camelCase.bind(_),
  snakeCase: _.snakeCase.bind(_),
  kebabCase: _.kebabCase.bind(_),
  startCase: _.startCase.bind(_),
  truncate: _.truncate.bind(_),
  padStart: _.padStart.bind(_),
  padEnd: _.padEnd.bind(_),
  trim: _.trim.bind(_),
  escape: _.escape.bind(_),
  unescape: _.unescape.bind(_),
  round: _.round.bind(_),
  floor: _.floor.bind(_),
  ceil: _.ceil.bind(_),
  clamp: _.clamp.bind(_),
  random: _.random.bind(_),
  sum: _.sum.bind(_),
  sumBy: _.sumBy.bind(_),
  mean: _.mean.bind(_),
  meanBy: _.meanBy.bind(_),
  min: _.min.bind(_),
  minBy: _.minBy.bind(_),
  max: _.max.bind(_),
  maxBy: _.maxBy.bind(_),
  range: _.range.bind(_),
  times: _.times.bind(_),
  once: _.once.bind(_),
  memoize: _.memoize.bind(_),
  noop: _.noop.bind(_),
  identity: _.identity.bind(_),
  constant: _.constant.bind(_),
  template: (_src: string) => {
    logger.error("SovereignLodash", "_.template is BLOCKED — code injection vector");
    appendAuditLog({
      action: "SOVEREIGN_LODASH_BLOCK",
      actorId: "system",
      resourceType: "dependency",
      resourceId: "lodash",
      details: { threat: "code_injection", blockedMethod: "template" },
      severity: "critical",
    }).catch(() => {});
    return () => "";
  },
};

export default sovereign;
