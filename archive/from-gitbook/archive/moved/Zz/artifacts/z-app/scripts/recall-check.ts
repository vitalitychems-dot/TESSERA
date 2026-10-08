import { recallLearned } from "../src/lib/tessera/recall";

const questions = [
  "What does the Nicomachean Ethics say every art aims at?",
  "Who was Wilhelm Reich?",
  "Do you have the MI6 agency files?",
];
for (const question of questions) {
  const hit = await recallLearned(question);
  console.log("Q", question);
  console.log(hit.split("\n")[0]);
  console.log("---");
}
