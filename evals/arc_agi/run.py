#!/usr/bin/env python3
"""ARC-AGI-1 public evaluation harness ($0, local, stdlib + numpy).

Scores a solver plugin on fchollet/ARC-AGI data/evaluation (pinned commit):
  predictions correct: test outputs where any of <= 2 attempts matches exactly (out of 419)
  tasks solved:        tasks where every test output is correct (out of 400)
See PREREGISTRATION.md for the fixed rules. Writes evals/arc_agi/results/<UTC timestamp>/.
"""
import argparse, hashlib, importlib.util, io, json, multiprocessing as mp, os, platform, random
import multiprocessing.connection as mp_connection
import signal, subprocess, sys, time, urllib.request, zipfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ARC_REPO = "fchollet/ARC-AGI"
ARC_SHA = "399030444e0ab0cc8b4e199870fb20b863846f34"
EXPECTED_TASKS, EXPECTED_TESTS = 400, 419
MAX_ATTEMPTS = 2
# Full digest already recorded in RESULTS.md and the baseline summary.json.
PINNED_DATASET_SHA256 = "4d9a15441fd20199f4fb419641ead13aaef357695abcc7e0ea243e3548a16dfb"
NON_DICT_RESULT = "solver returned a non-dict result"
WORKER_CRASH = "crashed: worker exited"
# ARC-AGI grids are rectangular, 1..30 on each side, cells int 0..9 (not bool).
ARC_MIN_DIM, ARC_MAX_DIM = 1, 30
# Whole repository. A pathspec of "." only saw evals/arc_agi.
GIT_STATUS_ARGV = ["git", "status", "--porcelain"]


class TaskTimeout(BaseException):
    """SIGALRM deadline. BaseException so a solver `except Exception` cannot swallow it."""


def fetch_dataset(cache):
    dest = os.path.join(cache, ARC_SHA, "evaluation")
    if os.path.isdir(dest) and len(os.listdir(dest)) == EXPECTED_TASKS:
        return dest
    url = f"https://codeload.github.com/{ARC_REPO}/zip/{ARC_SHA}"
    data = urllib.request.urlopen(url, timeout=120).read()
    os.makedirs(dest, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for n in z.namelist():
            if "/data/evaluation/" in n and n.endswith(".json"):
                with open(os.path.join(dest, os.path.basename(n)), "wb") as f:
                    f.write(z.read(n))
    return dest


def load_tasks(d):
    tasks, h = {}, hashlib.sha256()
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".json"):
            raw = open(os.path.join(d, fn), "rb").read()
            h.update(fn.encode() + b"\0" + raw)
            tasks[fn[:-5]] = json.loads(raw)
    return tasks, h.hexdigest()


def load_solver(path):
    spec = importlib.util.spec_from_file_location("arc_solver", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_SOLVER = None

def _init(path):
    global _SOLVER
    _SOLVER = load_solver(path)


def empty_attempts(n):
    return [{"attempts": [], "confidence": 0.0, "meta": {}} for _ in range(n)]


def check_dataset_hash(digest):
    """Exit non-zero unless digest is the pinned evaluation sha256."""
    if digest != PINNED_DATASET_SHA256:
        sys.exit(f"dataset sha256 mismatch: got {digest}, expected {PINNED_DATASET_SHA256}")


def coerce_solver_result(res, n):
    """Same failure record as a crashed solver when the result is not a list of dicts."""
    if isinstance(res, list) and all(isinstance(item, dict) for item in res):
        return res, None
    return empty_attempts(n), NON_DICT_RESULT


def _timeout_message(limit):
    return f"timeout: task exceeded {limit}s"


def is_harness_timeout(err):
    return isinstance(err, str) and err.startswith("timeout:")


def tasks_timed_out(done):
    """Tasks the harness recorded as over the wall-clock limit."""
    return sum(1 for record in done.values() if is_harness_timeout(record.get("error")))


def coerce_confidence(value):
    """A missing or non-numeric confidence is 0. Non-finite values are 0 too."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if number != number or number == float("inf") or number == float("-inf"):
        return 0.0
    return number


def clamp_confidence(number):
    """Bucket input only. Stored confidence is left as the solver reported it."""
    if number < 0.0:
        return 0.0
    if number > 1.0:
        return 1.0
    return number


def confidence_counts(done):
    buckets = {}
    for record in done.values():
        for row in record["tests"]:
            if not row["n_attempts"]:
                continue
            conf = clamp_confidence(coerce_confidence(row.get("confidence", 0.0)))
            band = min(int(conf * 4), 3)
            lo = band / 4
            key = f"{lo:.2f}-{lo + 0.25:.2f}"
            slot = buckets.setdefault(key, [0, 0])
            slot[0] += 1
            slot[1] += row["correct"]
    return {key: {"n": counts[0], "correct": counts[1]} for key, counts in sorted(buckets.items())}


def repo_is_dirty(run=None, cwd=None):
    """True or False from git status. None when git cannot be read (not a repo)."""
    run = run or subprocess.run
    try:
        proc = run(GIT_STATUS_ARGV, cwd=cwd or HERE, capture_output=True, text=True, timeout=10)
    except Exception:
        return None
    if getattr(proc, "returncode", 0) not in (0, None):
        return None
    return bool((getattr(proc, "stdout", "") or "").strip())


def _is_arc_grid(grid):
    """Plain rectangular ARC grid: 1..30 by 1..30, every cell an int 0..9."""
    if type(grid) is not list or not (ARC_MIN_DIM <= len(grid) <= ARC_MAX_DIM):
        return False
    width = None
    for row in grid:
        if type(row) is not list or not (ARC_MIN_DIM <= len(row) <= ARC_MAX_DIM):
            return False
        if width is None:
            width = len(row)
        elif len(row) != width:
            return False
        for cell in row:
            # bool is a subclass of int and must not count (True == 1).
            if type(cell) is not int or not (0 <= cell <= 9):
                return False
    return True


def _decode_attempt(attempt):
    """JSON round-trip, then the ARC grid check. Anything else is not comparable."""
    try:
        decoded = json.loads(json.dumps(attempt))
    except (TypeError, ValueError, OverflowError):
        return None
    if not _is_arc_grid(decoded):
        return None
    return decoded


def _with_valid_attempts(res):
    """Replace non-grids with None, in order, and record invalid_attempts.

    Placeholders keep the attempt slot so a later valid guess cannot move into
    a slot the invalid one already used. A second pass sees only grids and
    None and does not count those placeholders again.
    """
    if not isinstance(res, list):
        return res
    cleaned = []
    for item in res:
        if not isinstance(item, dict):
            cleaned.append(item)
            continue
        item = dict(item)
        raw = item.get("attempts") or []
        if not isinstance(raw, list):
            raw = [raw]
        meta = dict(item.get("meta") or {})
        already = int(meta.get("invalid_attempts") or 0)
        if already and all(attempt is None or _is_arc_grid(attempt) for attempt in raw):
            cleaned.append(item)
            continue
        stored = []
        invalid = 0
        for attempt in raw:
            grid = _decode_attempt(attempt)
            if grid is None:
                invalid += 1
                stored.append(None)
            else:
                stored.append(grid)
        item["attempts"] = stored
        if invalid:
            meta["invalid_attempts"] = already + invalid
            item["meta"] = meta
        cleaned.append(item)
    return cleaned


def _current_sigmask():
    if not hasattr(signal, "pthread_sigmask"):
        return None
    return signal.pthread_sigmask(signal.SIG_BLOCK, [])


def _restore_sigmask(mask):
    if mask is None or not hasattr(signal, "pthread_sigmask"):
        return
    signal.pthread_sigmask(signal.SIG_SETMASK, mask)


def _run_task(args):
    tid, task, limit, cfg = args
    train = [(p["input"], p["output"]) for p in task["train"]]
    tests = [p["input"] for p in task["test"]]
    n = len(tests)
    t0 = time.monotonic()
    res, err = empty_attempts(n), None
    finished = False
    armed = False
    previous = None
    saved_mask = _current_sigmask()

    def _on_alarm(signum, frame):
        raise TaskTimeout(_timeout_message(limit))

    try:
        if limit is not None and limit <= 0:
            res, err = empty_attempts(n), _timeout_message(limit)[:200]
            return tid, res, 0.0, err
        if hasattr(signal, "setitimer") and hasattr(signal, "SIGALRM"):
            previous = signal.signal(signal.SIGALRM, _on_alarm)
            signal.setitimer(signal.ITIMER_REAL, float(limit))
            armed = True
        solve_started = time.monotonic()
        raw = _SOLVER.solve(train, tests, limit, cfg)
        solve_elapsed = time.monotonic() - solve_started
        finished = True
        # Wall clock around solve(). A late return is a timeout even if the
        # solver swallowed the alarm or handed back a correct grid.
        if limit is not None and solve_elapsed > float(limit):
            res, err = empty_attempts(n), _timeout_message(limit)[:200]
        else:
            res, err = coerce_solver_result(raw, n)
            # Validate in the worker, before the parent compares with ==.
            res = _with_valid_attempts(res)
    except TaskTimeout as exc:
        if not finished:
            res, err = empty_attempts(n), str(exc)[:200]
    except Exception as e:  # a crash scores as no attempts
        res, err = empty_attempts(n), repr(e)[:200]
    except BaseException as e:  # SystemExit and KeyboardInterrupt must not stall the pool
        res, err = empty_attempts(n), repr(e)[:200]
    finally:
        if armed:
            # Drop a signal already queued at the deadline so it cannot kill a
            # worker that has a result, or replace that result from `finally`.
            try:
                signal.signal(signal.SIGALRM, signal.SIG_IGN)
                signal.setitimer(signal.ITIMER_REAL, 0)
            except TaskTimeout:
                pass
            # Unblock SIGALRM while the handler is SIG_IGN, so a pending alarm
            # is discarded. Then put the previous handler back.
            _restore_sigmask(saved_mask)
            saved_mask = None
            signal.signal(signal.SIGALRM, previous)
        _restore_sigmask(saved_mask)
    return tid, res, round(time.monotonic() - t0, 3), err


def _close_conn(conn):
    try:
        conn.close()
    except Exception:
        pass


def _worker_main(solver_path, write_conn, read_conn, job):
    """One task in a fresh process. os._exit skips this and the parent records a crash."""
    _close_conn(read_conn)
    try:
        _init(solver_path)
        write_conn.send(_run_task(job))
    except BaseException as exc:
        tid, task = job[0], job[1]
        try:
            write_conn.send((tid, empty_attempts(len(task["test"])), 0.0, repr(exc)[:200]))
        except Exception:
            pass
    finally:
        _close_conn(write_conn)


def _crash_payload(job, started):
    tid, task = job[0], job[1]
    secs = round(time.monotonic() - started, 3)
    return tid, empty_attempts(len(task["test"])), secs, WORKER_CRASH


def _retire_worker(slot):
    _close_conn(slot["conn"])
    proc = slot["proc"]
    if proc.is_alive():
        proc.terminate()
    proc.join(5)


def _reap_worker(slot, results):
    """Record a finished payload, or a crash when the process died without one."""
    conn = slot["conn"]
    if conn.poll():
        try:
            payload = conn.recv()
        except (EOFError, OSError):
            payload = _crash_payload(slot["job"], slot["t0"])
        results[payload[0]] = payload
        _retire_worker(slot)
        return True
    if slot["proc"].exitcode is None:
        return False
    results[slot["job"][0]] = _crash_payload(slot["job"], slot["t0"])
    _retire_worker(slot)
    return True


def collect_jobs(jobs, solver_path, workers, total_time_limit, t_start=None):
    """Run jobs on fresh fork workers.

    A worker that calls os._exit is recorded as crashed and the next job starts
    on a new process. Unfinished jobs stay out of the result map once the wall
    cap is hit, matching the previous pool.
    """
    ctx = mp.get_context("fork")
    t_start = time.monotonic() if t_start is None else t_start
    workers = max(1, int(workers))
    pending = []
    queue = list(jobs)
    results = {}
    hit_cap = False

    def launch():
        job = queue.pop(0)
        read_conn, write_conn = ctx.Pipe(duplex=False)
        proc = ctx.Process(target=_worker_main, args=(solver_path, write_conn, read_conn, job))
        proc.start()
        write_conn.close()
        pending.append({"proc": proc, "conn": read_conn, "job": job, "t0": time.monotonic()})

    try:
        while len(results) < len(jobs):
            remaining = total_time_limit - (time.monotonic() - t_start)
            if remaining <= 0:
                hit_cap = True
                break
            while queue and len(pending) < workers:
                launch()
            if not pending:
                break
            ready = mp_connection.wait(
                [slot["conn"] for slot in pending], timeout=min(0.2, max(0.0, remaining))
            )
            ready_ids = {id(conn) for conn in ready}
            still = []
            for slot in pending:
                died = slot["proc"].exitcode is not None
                if id(slot["conn"]) in ready_ids or died:
                    if not _reap_worker(slot, results):
                        still.append(slot)
                else:
                    still.append(slot)
            pending = still
        if hit_cap:
            still = []
            for slot in pending:
                if not _reap_worker(slot, results):
                    still.append(slot)
            pending = still
    finally:
        for slot in pending:
            _retire_worker(slot)
    return results, hit_cap


def score_finished_task(task, res, secs, err):
    """Score one task. A non-dict solver payload becomes an empty failure, not a crash."""
    n = len(task["test"])
    if not isinstance(res, list) or any(not isinstance(item, dict) for item in res):
        res = empty_attempts(n)
        if not err:
            err = NON_DICT_RESULT
    else:
        res = _with_valid_attempts(res)
    rows = []
    for i, t in enumerate(task["test"]):
        r = res[i] if i < len(res) and isinstance(res[i], dict) else empty_attempts(1)[0]
        att = r.get("attempts") or []
        if not isinstance(att, list):
            att = []
        att = att[:MAX_ATTEMPTS]
        # Equality runs only on a decoded ARC grid. None marks an invalid attempt.
        ok = any(grid == t["output"] for grid in att if _is_arc_grid(grid))
        rows.append({"test_index": i, "correct": ok, "n_attempts": len(att),
                     "confidence": coerce_confidence(r.get("confidence", 0.0)),
                     "meta": r.get("meta", {})})
    return {"tests": rows, "solved": all(x["correct"] for x in rows), "seconds": secs, "error": err}


def write_summary(path, summary):
    with open(path, "w") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")


def env_info(cmd):
    def sh(*a):
        try:
            return subprocess.run(a, cwd=HERE, capture_output=True, text=True, timeout=10).stdout.strip()
        except Exception:
            return None
    cpu = None
    try:
        cpu = next(l.split(":", 1)[1].strip() for l in open("/proc/cpuinfo") if l.startswith("model name"))
    except Exception:
        cpu = platform.processor()
    try:
        import numpy
        npv = numpy.__version__
    except Exception:
        npv = None
    return {"command": cmd, "python": sys.version.split()[0], "packages": {"numpy": npv},
            "platform": platform.platform(), "cpu": cpu, "cpu_count": os.cpu_count(),
            "git_commit": sh("git", "rev-parse", "HEAD"), "git_dirty": repo_is_dirty(),
            "dataset": {"repo": ARC_REPO, "commit": ARC_SHA, "split": "data/evaluation"}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solver", default=os.path.join(HERE, "solvers", "dsl_search.py"))
    ap.add_argument("--config", default='{"depth": 2, "retry_depth": 3, "max_programs": 50}', help="JSON for the solver")
    ap.add_argument("--seed", type=int, default=20261021, help="orders tasks and draws --subset")
    ap.add_argument("--subset", type=int, default=0, help="score only N seeded-random tasks (0 = all 400)")
    ap.add_argument("--task-time-limit", type=float, default=8.0, help="seconds per task (solver deadline)")
    ap.add_argument("--total-time-limit", type=float, default=600.0, help="wall cap; unstarted tasks score 0")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--cache", default=os.path.join(HERE, ".data"))
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    a = ap.parse_args()
    cmd = " ".join([os.path.basename(sys.executable)] + [os.path.relpath(sys.argv[0])] + sys.argv[1:])
    cfg = json.loads(a.config)

    tasks, ds_hash = load_tasks(fetch_dataset(a.cache))
    n_tests = sum(len(t["test"]) for t in tasks.values())
    if (len(tasks), n_tests) != (EXPECTED_TASKS, EXPECTED_TESTS):
        sys.exit(f"dataset count mismatch: {len(tasks)} tasks / {n_tests} tests")
    check_dataset_hash(ds_hash)
    ids = sorted(tasks)
    random.Random(a.seed).shuffle(ids)
    if a.subset:
        ids = ids[:a.subset]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = os.path.join(a.out, stamp)
    os.makedirs(out, exist_ok=True)
    env = env_info(cmd)
    env["dataset"]["sha256_of_files"] = ds_hash

    t_start = time.monotonic()
    done = {}
    conf_log = open(os.path.join(out, "confidence.jsonl"), "w")
    jobs = [(tid, tasks[tid], a.task_time_limit, cfg) for tid in ids]
    try:
        results, hit_cap = collect_jobs(jobs, a.solver, a.workers, a.total_time_limit, t_start)
        for tid, res, secs, err in results.values():
            task = tasks[tid]
            rec = score_finished_task(task, res, secs, err)
            for row in rec["tests"]:
                conf_log.write(json.dumps({"task": tid, "test_index": row["test_index"],
                                           "confidence": row["confidence"], "n_attempts": row["n_attempts"],
                                           "correct": row["correct"], "seconds": secs}) + "\n")
            done[tid] = rec
    finally:
        conf_log.close()
    wall = round(time.monotonic() - t_start, 1)

    scored_tests = sum(len(tasks[t]["test"]) for t in ids)
    preds = sum(x["correct"] for d in done.values() for x in d["tests"])
    solved = sum(d["solved"] for d in done.values())
    attempted = [d for d in done.values() if any(x["n_attempts"] for x in d["tests"])]
    summary = {
        "harness": "evals/arc_agi/run.py", "solver": os.path.relpath(a.solver, HERE), "solver_config": cfg,
        "seed": a.seed, "subset": a.subset or None, "task_time_limit_s": a.task_time_limit,
        "total_time_limit_s": a.total_time_limit, "workers": a.workers, "max_attempts": MAX_ATTEMPTS,
        "tasks_in_run": len(ids), "tests_in_run": scored_tests, "tasks_finished": len(done),
        "tasks_timed_out": tasks_timed_out(done),
        "hit_total_time_cap": hit_cap, "wall_seconds": wall,
        "predictions_correct": preds, "predictions_denominator": scored_tests,
        "tasks_solved": solved, "tasks_denominator": len(ids),
        "full_split_denominators": {"predictions": EXPECTED_TESTS, "tasks": EXPECTED_TASKS},
        "tests_with_any_attempt": sum(1 for d in done.values() for x in d["tests"] if x["n_attempts"]),
        "tasks_with_any_attempt": len(attempted),
        "precision_when_attempted": round(preds / max(1, sum(1 for d in done.values() for x in d["tests"] if x["n_attempts"])), 4),
        "confidence_counts": confidence_counts(done),
        "solved_task_ids": sorted(t for t, d in done.items() if d["solved"]),
        "environment": env, "utc_timestamp": stamp,
    }
    write_summary(os.path.join(out, "summary.json"), summary)
    json.dump(done, open(os.path.join(out, "tasks.json"), "w"))
    print(json.dumps({k: summary[k] for k in ("predictions_correct", "predictions_denominator", "tasks_solved",
                                               "tasks_denominator", "tasks_finished", "hit_total_time_cap", "wall_seconds")}))
    print("results:", out)


if __name__ == "__main__":
    main()
