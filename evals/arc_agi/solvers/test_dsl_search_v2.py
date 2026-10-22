"""Unit tests for dsl_search_v2 transforms, size rules, and the default solver flag."""
import importlib.util
import os
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))

def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v2 = _load("dsl_search_v2_under_test", os.path.join(HERE, "dsl_search_v2.py"))
run = _load("arc_harness_under_test", os.path.join(HERE, "..", "run.py"))
dsl = v2.dsl
_L = np.array([[1, 0, 0], [1, 1, 0], [0, 0, 0], [2, 2, 0]], dtype=np.int64)

def _arr(*rows):
    return np.array(rows, dtype=np.int64)

class Transforms(unittest.TestCase):
    def test_each_flipud_fliplr_rot180(self):
        self.assertTrue(np.array_equal(v2.apply_each("flipud")(_L), _arr([1, 1, 0], [1, 0, 0], [0, 0, 0], [2, 2, 0])))
        self.assertTrue(np.array_equal(v2.apply_each("fliplr")(_L), _arr([0, 1, 0], [1, 1, 0], [0, 0, 0], [2, 2, 0])))
        self.assertTrue(np.array_equal(v2.apply_each("rot180")(_L), _arr([1, 1, 0], [0, 1, 0], [0, 0, 0], [2, 2, 0])))

    def test_each_primitive_keeps_shape_or_abstains(self):
        for name in v2.EACH:
            got = v2.apply_each(name)(_L)
            with self.subTest(name=name):
                self.assertTrue(got is None or got.shape == _L.shape)

    def test_recolor_by_component_size_and_rank(self):
        self.assertTrue(np.array_equal(v2.recolor_size(_arr([7, 7, 0, 8])), _arr([2, 2, 0, 1])))
        # Two objects of size 2 share rank 1. The size-1 object is rank 2.
        self.assertTrue(np.array_equal(v2.recolor_rank(_arr([5, 5, 0, 6, 6, 0, 7])), _arr([1, 1, 0, 1, 1, 0, 2])))
        self.assertIsNone(v2.recolor_size(_arr([1, 1, 0])))
        self.assertIsNone(v2.recolor_rank(_arr([1, 1, 0])))

    def test_size_rules(self):
        same_in = [_arr([1, 0]), _arr([2], [3])]
        self.assertEqual(v2.infer_size(same_in, [_arr([4, 0]), _arr([5], [6])]), ("same", None))
        self.assertEqual(v2.expected_shape(_arr([1, 1, 1, 1]), ("same", None)), (1, 4))
        square = [_arr([1, 2], [3, 4]), _arr([5, 6], [7, 8])]
        self.assertEqual(v2.infer_size(square, square), ("same", None))
        const_in = [_arr([1, 1, 1], [1, 1, 1], [1, 1, 1]), _arr([2, 2, 2, 2], [2, 2, 2, 2])]
        self.assertEqual(v2.infer_size(const_in, [_arr([3, 3]), _arr([4, 4])]), ("constant", (1, 2)))
        self.assertEqual(v2.expected_shape(const_in[0], ("constant", (1, 2))), (1, 2))
        up = [_arr([1, 2]), _arr([3, 4], [5, 6])]
        self.assertEqual(v2.infer_size(up, [np.kron(g, np.ones((2, 2), np.int64)) for g in up]), ("scale", 2))
        self.assertEqual(v2.expected_shape(_arr([1, 1, 1, 1], [1, 1, 1, 1]), ("scale", 2)), (4, 8))
        self.assertEqual(v2.expected_shape(_arr([1, 1, 1, 1], [1, 1, 1, 1]), ("scale", -2)), (1, 2))
        down = [_arr([1, 1, 2, 2], [1, 1, 2, 2]), _arr([3, 3], [3, 3])]
        self.assertEqual(v2.infer_size(down, [_arr([1, 2]), _arr([3])]), ("scale", -2))
        crop = [_arr([0, 0, 0], [0, 1, 0], [0, 0, 0]), _arr([0, 0, 0, 0], [0, 2, 3, 0], [0, 0, 0, 0])]
        self.assertEqual(v2.infer_size(crop, [_arr([1]), _arr([2, 3])]), ("crop", None))
        self.assertEqual(v2.expected_shape(crop[1], ("crop", None)), (1, 2))
        mixed = [_arr([1, 1], [1, 1]), _arr([2, 2], [2, 2])]
        self.assertEqual(v2.infer_size(mixed, [_arr([1, 1, 1]), _arr([2, 2], [2, 2])]), ("unknown", None))

    def test_constant_window_and_scale_guard(self):
        op = v2._constant_window((2, 2))
        self.assertTrue(np.array_equal(op(_arr([1, 2, 0], [3, 4, 0], [0, 0, 0])), _arr([1, 2], [3, 4])))
        self.assertIsNone(op(_arr([1, 2, 9], [3, 4, 0], [0, 0, 0])))
        ins = [_arr([1, 0, 2]), _arr([3, 0, 4, 4])]
        outs = [np.kron(g, np.ones((2, 2), np.int64)) for g in ins]
        rule = v2.infer_size(ins, outs)
        self.assertEqual(rule[0], "scale")
        names = [name for name, _fn in v2.programs(rule)]
        self.assertIn("size", names)
        self.assertNotIn("recolor_size", names)
        self.assertIsNone(v2._fit(v2.recolor_size, ins, outs, [_arr([5, 0, 6])], rule))

class SolverFlag(unittest.TestCase):
    def test_omitted_flag_resolves_to_baseline_file(self):
        historical = os.path.join(run.HERE, "solvers", "dsl_search.py")
        omitted, named = run.parse_args([]), run.parse_args(["--solver", "dsl_search"])
        other = run.parse_args(["--solver", "dsl_search_v2"])
        custom = run.parse_args(["--solver", "/tmp/custom_solver.py"])
        self.assertEqual(run.DEFAULT_SOLVER, "dsl_search")
        self.assertEqual(omitted.solver, historical)
        self.assertEqual(named.solver, historical)
        self.assertEqual(other.solver, os.path.join(run.HERE, "solvers", "dsl_search_v2.py"))
        self.assertEqual(custom.solver, "/tmp/custom_solver.py")
        with open(omitted.solver, "rb") as selected, open(historical, "rb") as baseline:
            self.assertEqual(selected.read(), baseline.read())

    def test_default_attempts_match_and_v2_keeps_baseline(self):
        selected = _load("baseline_via_default", run.parse_args([]).solver)
        train = [([[1, 0], [0, 0]], [[2, 0], [0, 0]])]
        cfg = {"depth": 2, "retry_depth": 2, "max_programs": 20}
        base = dsl.solve(train, [[[1, 0], [0, 0]]], 2.0, cfg)
        got = selected.solve(train, [[[1, 0], [0, 0]]], 2.0, cfg)
        self.assertTrue(base[0]["attempts"])
        self.assertEqual(got[0]["attempts"], base[0]["attempts"])
        self.assertEqual(got[0]["meta"]["programs"], base[0]["meta"]["programs"])
        tiny = ([([[1]], [[2]])], [[[1]]], {"depth": 1, "retry_depth": 1, "max_programs": 10})
        held = dsl.solve(tiny[0], tiny[1], 2.0, tiny[2])
        self.assertEqual(v2.solve(tiny[0], tiny[1], 2.0, tiny[2]), held)

    def test_v2_recolor_solves_when_baseline_has_no_attempt(self):
        train = [([[7, 7, 0, 8]], [[1, 1, 0, 2]]), ([[4, 0, 4, 4, 4]], [[2, 0, 1, 1, 1]])]
        cfg = {"depth": 2, "retry_depth": 3, "max_programs": 50}
        self.assertEqual(dsl.solve(train, [[[9, 9, 9, 0, 5]]], 2.0, cfg)[0]["attempts"], [])
        got = v2.solve(train, [[[9, 9, 9, 0, 5]]], 2.0, cfg)
        self.assertEqual(got[0]["attempts"], [[[1, 1, 1, 0, 2]]])
        self.assertEqual(got[0]["meta"]["size_rule"], "same")
        self.assertIn("recolor_rank", got[0]["meta"]["programs"][0])

if __name__ == "__main__":
    unittest.main()
