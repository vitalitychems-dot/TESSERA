export const EMOTIONS = ["joy", "sadness", "anger", "fear", "gratitude", "neutral"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface LabeledUtterance {
  text: string;
  label: Emotion;
}

/**
 * Hand-written fixtures. Train and holdout never share a sentence. They are small on purpose: they gate
 * regressions in the harness, they are not evidence of real-world empathic ability.
 */
export const EMPATHY_TRAIN: readonly LabeledUtterance[] = [
  { text: "I got the job! I'm so happy I could cry.", label: "joy" },
  { text: "We finally finished the project and the whole team is thrilled.", label: "joy" },
  { text: "What a wonderful morning, everything feels great today.", label: "joy" },
  { text: "My daughter just took her first steps and I'm over the moon!", label: "joy" },
  { text: "I love this new place, I'm delighted with how it turned out.", label: "joy" },
  { text: "Best news all week, we won the grant and I'm excited!", label: "joy" },
  { text: "I'm not sad at all today, honestly I feel cheerful.", label: "joy" },
  { text: "The party was amazing and I was laughing the entire night.", label: "joy" },
  { text: "She said yes! I'm absolutely overjoyed.", label: "joy" },
  { text: "Feeling proud and happy after the recital went so well.", label: "joy" },

  { text: "I miss my brother so much it hurts, the house feels empty.", label: "sadness" },
  { text: "I've been crying all evening and I feel completely alone.", label: "sadness" },
  { text: "Everything feels hopeless since the layoff, I'm so down.", label: "sadness" },
  { text: "My dog died this morning and I can't stop grieving.", label: "sadness" },
  { text: "I'm heartbroken, she left and I feel empty inside.", label: "sadness" },
  { text: "Nothing brings me joy anymore, I just feel miserable.", label: "sadness" },
  { text: "I'm not happy these days, I feel lonely and tired.", label: "sadness" },
  { text: "It was a sad goodbye and I couldn't hold back the tears.", label: "sadness" },
  { text: "I feel so discouraged and hurt after that conversation.", label: "sadness" },
  { text: "The funeral was today and I'm devastated.", label: "sadness" },

  { text: "I'm furious, they cancelled my booking without telling me!", label: "anger" },
  { text: "This is outrageous, I've been ignored for three weeks.", label: "anger" },
  { text: "I'm so angry I can barely speak right now.", label: "anger" },
  { text: "How dare he take credit for my work, I'm livid.", label: "anger" },
  { text: "I hate being lied to, it makes my blood boil.", label: "anger" },
  { text: "Stop wasting my time, this service is infuriating.", label: "anger" },
  { text: "I'm not calm at all, this is completely unacceptable!", label: "anger" },
  { text: "They keep blaming me and I'm sick of it, it's so unfair.", label: "anger" },
  { text: "I'm fed up with the constant excuses and broken promises.", label: "anger" },
  { text: "That driver cut me off and I'm absolutely seething.", label: "anger" },

  { text: "I'm terrified of the results, my hands won't stop shaking.", label: "fear" },
  { text: "I keep worrying something awful will happen to the kids.", label: "fear" },
  { text: "I'm scared to go home, I heard noises downstairs.", label: "fear" },
  { text: "My heart is racing and I'm panicking about the exam.", label: "fear" },
  { text: "I'm anxious about the surgery tomorrow, I can't sleep.", label: "fear" },
  { text: "I'm afraid I'll lose everything if this fails.", label: "fear" },
  { text: "I'm not comfortable walking there alone at night, it frightens me.", label: "fear" },
  { text: "The thought of speaking in public fills me with dread.", label: "fear" },
  { text: "I feel nervous and uneasy, like something is about to go wrong.", label: "fear" },
  { text: "The storm warning has me really worried for my family.", label: "fear" },

  { text: "Thank you so much, I really appreciate your help.", label: "gratitude" },
  { text: "I'm grateful for everything you did for us this year.", label: "gratitude" },
  { text: "Thanks for staying late to help me, it meant a lot.", label: "gratitude" },
  { text: "I can't thank you enough for being there when I needed it.", label: "gratitude" },
  { text: "So thankful for this community, you've been wonderful to me.", label: "gratitude" },
  { text: "I appreciate you taking the time to explain it so patiently.", label: "gratitude" },
  { text: "Your kindness got me through a hard week, thank you.", label: "gratitude" },
  { text: "I owe you one, thanks for covering my shift.", label: "gratitude" },
  { text: "Grateful beyond words for the support you gave my family.", label: "gratitude" },
  { text: "Many thanks for the quick reply, that was really kind.", label: "gratitude" },

  { text: "The meeting is scheduled for three o'clock in room four.", label: "neutral" },
  { text: "Please send the report as a PDF by the end of the week.", label: "neutral" },
  { text: "The package weighs two kilograms and ships on Tuesday.", label: "neutral" },
  { text: "I need to update the address on my account.", label: "neutral" },
  { text: "The train to the airport leaves from platform six.", label: "neutral" },
  { text: "Can you tell me how to reset the printer settings?", label: "neutral" },
  { text: "The document has twelve pages and two attachments.", label: "neutral" },
  { text: "We are moving the stand-up to ten in the morning.", label: "neutral" },
  { text: "The library opens at nine and closes at five.", label: "neutral" },
  { text: "I would like a copy of last month's invoice.", label: "neutral" },
];

export const EMPATHY_HOLDOUT: readonly LabeledUtterance[] = [
  { text: "I passed my driving test today and I can't stop smiling!", label: "joy" },
  { text: "The kids loved the surprise and the house is full of laughter.", label: "joy" },
  { text: "I'm thrilled with how the garden turned out this spring.", label: "joy" },
  { text: "We're expecting a baby and we are over the moon.", label: "joy" },
  { text: "Today was lovely, I feel light and really happy.", label: "joy" },

  { text: "I feel so lonely since the move, I cry most nights.", label: "sadness" },
  { text: "She's gone and the silence at home is unbearable.", label: "sadness" },
  { text: "I'm not okay, I feel hopeless and worn out.", label: "sadness" },
  { text: "Losing the old photographs left me heartbroken.", label: "sadness" },
  { text: "I'm grieving my grandfather and everything feels grey.", label: "sadness" },

  { text: "I'm outraged that nobody replied to my complaint!", label: "anger" },
  { text: "He lied to my face and now I'm furious.", label: "anger" },
  { text: "This constant nonsense is infuriating, I'm done being ignored.", label: "anger" },
  { text: "I'm sick of the unfair treatment and I'm really angry.", label: "anger" },
  { text: "It's unacceptable that they broke their promise again.", label: "anger" },

  { text: "I'm frightened, the lump might be serious.", label: "fear" },
  { text: "I'm so worried about the flight that my stomach hurts.", label: "fear" },
  { text: "I feel panicked every time the phone rings, I dread the news.", label: "fear" },
  { text: "I'm scared they'll find out and I'll lose my home.", label: "fear" },
  { text: "I'm anxious and uneasy about the interview tomorrow.", label: "fear" },

  { text: "Thank you for listening, I'm really grateful.", label: "gratitude" },
  { text: "I appreciate everything you've done, it means the world to me.", label: "gratitude" },
  { text: "Thanks a lot for the kind note, it made my day.", label: "gratitude" },
  { text: "I'm thankful you were patient with me.", label: "gratitude" },
  { text: "Your generosity is wonderful and I can't thank you enough.", label: "gratitude" },

  { text: "The invoice number is on the second page of the PDF.", label: "neutral" },
  { text: "Please confirm the delivery window for Thursday.", label: "neutral" },
  { text: "The office is closed on Monday for the public holiday.", label: "neutral" },
  { text: "How do I export the table to a spreadsheet?", label: "neutral" },
  { text: "The update will install after the next restart.", label: "neutral" },
];
