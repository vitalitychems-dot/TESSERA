import unittest

from lif import ConfigError, LIFConfig, PackedSparseLIFNetwork, SparseLIFNetwork, seeded_currents


class LIFTests(unittest.TestCase):
    def test_seeded_network_replays_exactly(self):
        config = LIFConfig(neurons=32, synapses=120, steps=12, seed=77)
        currents = seeded_currents(config)
        first = SparseLIFNetwork(config).run(currents)
        second = SparseLIFNetwork(config).run(currents)
        self.assertEqual(first, second)

    def test_threshold_spikes_and_reset(self):
        config = LIFConfig(neurons=1, synapses=0, steps=2, leak=0.9, threshold=1.0, reset=0.0)
        net = SparseLIFNetwork(config)
        self.assertEqual(net.step((1.1,)), (1,))
        self.assertEqual(net.membrane, [0.0])
        self.assertEqual(net.step((0.0,)), (0,))

    def test_refractory_suppresses_immediate_spike(self):
        config = LIFConfig(neurons=1, synapses=0, refractory_steps=2)
        net = SparseLIFNetwork(config)
        self.assertEqual(net.step((1.1,)), (1,))
        self.assertEqual(net.step((1.1,)), (0,))
        self.assertEqual(net.step((1.1,)), (0,))
        self.assertEqual(net.step((1.1,)), (1,))

    def test_invalid_external_shape_is_rejected(self):
        net = SparseLIFNetwork(LIFConfig(neurons=2, synapses=0))
        with self.assertRaises(ConfigError):
            net.step((0.1,))

    def test_invalid_config_is_rejected(self):
        with self.assertRaises(ConfigError):
            SparseLIFNetwork(LIFConfig(neurons=1, synapses=2))

    def test_packed_network_matches_reference_trace(self):
        config = LIFConfig(neurons=24, synapses=80, steps=10, seed=19)
        currents = seeded_currents(config)
        self.assertEqual(
            SparseLIFNetwork(config).run(currents),
            PackedSparseLIFNetwork(config).run(currents),
        )


if __name__ == "__main__":
    unittest.main()
