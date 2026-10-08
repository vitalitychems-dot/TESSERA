import random
import sys

sys.path.insert(0, "/workspace/data/checkouts/NeuroConscious")
import core.mood.basic_mood as mood_mod

original = mood_mod.BasicMoodStrategy.calculate_mood


def with_thirst(self, hunger, fatigue, thirst=0.5):
    return original(self, hunger, fatigue, thirst)


mood_mod.BasicMoodStrategy.calculate_mood = with_thirst
from agent.base_agent import Agent
from core.mood.basic_mood import BasicMoodStrategy
from environment.world import World

random.seed(7)
agent = Agent(name="Sandbox", mood_strategy=BasicMoodStrategy())
world = World()
world.add_agent(agent)
actions = []
for _ in range(5):
    world.update_environment()
    agent.sense()
    action = agent.think()
    agent.act(action)
    actions.append(action)
    world.time_step += 1
print("actions=" + ",".join(actions))
