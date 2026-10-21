const AFINN: Record<string, number> = {
  "abandon":-2,"abandoned":-2,"abandons":-2,"abducted":-2,"abuse":-3,"abused":-3,"abuses":-3,
  "accept":1,"accepted":1,"accepting":1,"accomplish":2,"accomplished":2,"achieves":2,"achievement":2,
  "adequate":1,"admire":3,"admired":3,"admit":-1,"adorable":3,"adore":3,"advanced":1,"advantage":2,
  "adventure":2,"afraid":-2,"aggravate":-2,"aggression":-3,"agony":-3,"agree":1,"agreeable":2,
  "alarm":-2,"alert":-1,"alienated":-2,"alive":1,"allergic":-2,"allow":1,"alone":-2,"amaze":2,
  "amazed":2,"amazing":4,"ambitious":2,"amuse":3,"amused":3,"anger":-3,"angry":-3,"anguish":-3,
  "annoy":-2,"annoyed":-2,"annoying":-2,"antagonize":-2,"anxiety":-2,"anxious":-2,"apathy":-3,
  "apologize":-1,"appalling":-3,"appeal":2,"appreciate":2,"apprehensive":-2,"approve":2,
  "arrogant":-2,"ashamed":-2,"assault":-2,"astonish":2,"astounding":3,"attack":-3,"attract":1,
  "attractive":2,"awe":3,"awesome":4,"awful":-3,"awkward":-2,"bad":-3,"ban":-2,"bankrupt":-3,
  "battle":-1,"beaten":-2,"beautiful":3,"beauty":3,"befriend":1,"benefit":2,"benefits":2,
  "best":3,"betray":-3,"better":2,"beware":-2,"bitch":-5,"bitter":-2,"bless":3,"blessed":3,
  "blind":-1,"bliss":3,"block":-1,"bloody":-3,"bold":2,"bonus":2,"bore":-2,"bored":-2,
  "boring":-3,"bother":-2,"brave":2,"breakthrough":3,"breathtaking":5,"bribe":-3,"bright":1,
  "brilliant":4,"broke":-1,"broken":-1,"brutal":-3,"bully":-2,"burden":-2,"calm":2,"cancer":-1,
  "capable":1,"captivated":3,"care":2,"careful":2,"careless":-2,"celebrate":3,"cheat":-3,
  "cheer":2,"cheerful":2,"cherish":2,"clever":2,"collapse":-2,"comfortable":2,"compassion":2,
  "competent":2,"complain":-2,"compliment":2,"concern":-1,"condemn":-2,"confident":2,
  "conflict":-2,"confuse":-2,"confused":-2,"congratulate":2,"conquer":2,"content":2,
  "controversial":-2,"convince":1,"cool":1,"corrupt":-3,"courage":2,"courageous":2,"crash":-2,
  "crazy":-2,"creative":2,"crime":-3,"crisis":-3,"criticize":-2,"cruel":-3,"crush":-1,"cry":-1,
  "cure":2,"curious":1,"curse":-1,"cut":-1,"cute":2,"damage":-3,"danger":-2,"dangerous":-2,
  "daring":2,"dark":-1,"dead":-3,"deadly":-3,"death":-2,"debate":-1,"decay":-1,"deceive":-3,
  "defeat":-2,"defend":2,"degrade":-2,"delay":-1,"delight":3,"delighted":3,"demand":-1,
  "demon":-1,"denial":-2,"depressed":-2,"depression":-2,"deprived":-2,"deserve":2,"desire":1,
  "despair":-3,"desperate":-3,"despise":-3,"destroy":-3,"destruction":-3,"determined":2,
  "devastated":-3,"devoted":3,"die":-3,"difficult":-1,"dignity":2,"disappoint":-2,
  "disappointed":-2,"disaster":-2,"disbelief":-2,"discomfort":-2,"discouraged":-2,
  "disgusted":-3,"dislike":-2,"dismiss":-2,"disorder":-2,"disrespect":-2,"distress":-2,
  "distrust":-3,"disturb":-2,"disturbing":-2,"divine":3,"dominate":-2,"doom":-2,"doubt":-1,
  "doubtful":-1,"dread":-2,"dream":1,"dull":-2,"dumb":-3,"dump":-1,"eager":2,"earn":2,
  "easy":1,"ecstatic":4,"effective":2,"efficient":2,"effort":1,"elegant":2,"embarrass":-2,
  "embrace":1,"emergency":-2,"empower":2,"empty":-1,"enchanting":3,"encourage":2,
  "energetic":2,"enjoy":2,"enormous":1,"enrage":-2,"enthusiastic":3,"envious":-2,"error":-2,
  "escape":-1,"evil":-3,"exaggerate":-2,"excellent":3,"excite":3,"excited":3,"exciting":3,
  "exclude":-1,"exhaust":-2,"fail":-2,"failure":-2,"fair":2,"faith":1,"faithful":3,"fake":-3,
  "fame":1,"fantastic":4,"fascinate":3,"fatal":-3,"fatigue":-2,"fault":-2,"favor":2,"fear":-2,
  "fearful":-2,"fearless":2,"fight":-1,"filthy":-2,"fine":2,"fix":1,"flaw":-2,"flexible":1,
  "flourish":3,"fond":2,"fool":-2,"foolish":-2,"force":-1,"forgive":1,"fortunate":2,"foul":-3,
  "fragile":-1,"fraud":-3,"free":1,"freedom":2,"fresh":1,"friendly":2,"fright":-2,
  "frightened":-2,"frustrated":-2,"frustrating":-2,"fulfill":2,"fun":4,"funny":4,
  "furious":-4,"generous":2,"genius":3,"gentle":2,"genuine":2,"gift":2,"glad":3,
  "gloomy":-3,"glory":3,"glowing":2,"good":3,"gorgeous":3,"grace":2,"graceful":2,"gracious":3,
  "grateful":3,"grave":-2,"great":3,"greed":-3,"grief":-2,"grim":-2,"gross":-2,"growth":2,
  "guilt":-3,"guilty":-3,"gullible":-2,"happy":3,"hard":-1,"hardship":-2,"harm":-2,
  "harmful":-2,"harmony":2,"harsh":-2,"hate":-3,"hatred":-3,"heal":2,"healthy":2,"heart":1,
  "heartbroken":-3,"heavenly":4,"help":2,"helpful":2,"helpless":-2,"hero":2,"heroic":3,
  "hesitant":-1,"honest":2,"honor":2,"hope":2,"hopeful":2,"hopeless":-2,"horrible":-3,
  "horrified":-3,"hostile":-2,"huge":1,"humiliate":-3,"humor":2,"humorous":2,"hurt":-2,
  "ideal":3,"ignorant":-2,"ignore":-1,"ill":-2,"illegal":-3,"imagine":1,"immoral":-3,
  "impatient":-2,"impress":3,"impressed":3,"impressive":3,"improve":2,"inadequate":-2,
  "incredible":4,"independent":2,"indifferent":-2,"inferior":-2,"infuriate":-2,"injustice":-3,
  "innocent":2,"innovative":2,"insecure":-2,"insensitive":-2,"insightful":2,"inspire":2,
  "inspired":2,"insulting":-2,"integrity":2,"intelligent":2,"intense":1,"interest":1,
  "interesting":2,"intimidate":-2,"invincible":2,"invisible":-1,"irrational":-2,
  "irresponsible":-2,"irritated":-3,"isolated":-2,"jealous":-2,"jeopardize":-2,"joke":2,
  "joy":3,"joyful":3,"joyous":4,"judge":-1,"just":1,"justice":2,"justify":1,"keen":1,
  "kind":2,"kindness":2,"lame":-2,"laugh":1,"leader":1,"legacy":1,"legend":2,"legendary":3,
  "liar":-3,"liberate":2,"lie":-2,"lifeless":-1,"lively":2,"lonely":-2,"longing":-1,
  "lose":-3,"loser":-3,"loss":-3,"lost":-3,"love":3,"loved":3,"lovely":3,"loving":3,
  "loyal":3,"luck":3,"lucky":3,"lunatic":-3,"mad":-3,"magic":3,"magical":3,"magnificent":4,
  "manipulate":-2,"marvelous":3,"master":2,"meaningful":2,"mediocre":-1,"menace":-2,
  "mercy":2,"mess":-2,"messy":-2,"miracle":4,"miserable":-3,"mislead":-3,"miss":-1,
  "mistake":-2,"mistrust":-3,"monster":-2,"moody":-1,"moron":-3,"motivate":1,"murder":-2,
  "nasty":-3,"natural":1,"negative":-2,"neglect":-2,"nervous":-2,"nice":3,"nightmare":-3,
  "noble":2,"numb":-1,"nurture":2,"obsessed":-2,"offend":-2,"offended":-2,"offensive":-2,
  "open":1,"opportunity":2,"oppose":-1,"oppress":-2,"optimistic":2,"original":2,
  "outstanding":5,"overcome":2,"overjoyed":4,"overwhelm":-2,"pain":-2,"painful":-2,
  "panic":-3,"paradise":3,"paranoid":-2,"passion":1,"passionate":2,"pathetic":-2,
  "patience":2,"patient":2,"peace":2,"peaceful":2,"perfect":3,"persist":1,"pessimist":-2,
  "pity":-1,"pleasant":3,"pleased":3,"pleasure":3,"poison":-2,"polite":2,"poor":-2,
  "popular":1,"positive":2,"poverty":-1,"power":1,"powerful":2,"powerless":-2,"praise":3,
  "pray":1,"precious":3,"pretty":1,"pride":2,"privilege":2,"problem":-2,"profit":2,
  "progress":2,"promise":1,"promote":1,"proper":1,"prosper":2,"protect":1,"proud":2,
  "provoke":-2,"punish":-2,"pure":2,"purpose":2,"rage":-2,"reckless":-2,"recommend":2,
  "recover":2,"regret":-2,"reject":-1,"relax":2,"relaxed":2,"relief":2,"remarkable":2,
  "rescue":2,"resentful":-2,"resilient":2,"respect":2,"responsible":2,"restless":-2,
  "restore":1,"revenge":-2,"reward":2,"rich":2,"ridiculous":-2,"risk":-2,"rob":-2,
  "romance":2,"rotten":-3,"rude":-2,"ruin":-2,"sabotage":-2,"sacrifice":-1,"sad":-2,
  "sadness":-2,"safe":1,"satisfy":3,"satisfied":2,"save":2,"scare":-2,"scared":-2,
  "scary":-2,"scold":-2,"scream":-2,"secure":2,"selfish":-3,"sensitive":1,"serious":-1,
  "shame":-2,"shatter":-2,"shock":-2,"sick":-2,"silly":-2,"sin":-2,"sincere":2,
  "slaughter":-3,"slave":-3,"smart":2,"smile":2,"sorrow":-2,"sorry":-1,"soul":1,
  "spectacular":4,"splendid":3,"stale":-1,"steal":-2,"stimulate":1,"stingy":-2,
  "strange":-1,"strength":2,"stress":-1,"strong":2,"struggle":-1,"stubborn":-2,"stuck":-2,
  "stunning":4,"stupid":-2,"succeed":3,"success":2,"successful":3,"suffer":-2,"suffering":-2,
  "superb":5,"superior":2,"support":2,"supportive":2,"surprise":1,"survive":2,"suspect":-1,
  "suspicious":-2,"sweet":2,"sympathy":2,"talent":2,"talented":2,"tempt":-1,"tender":2,
  "terrible":-3,"terrified":-3,"terrifying":-3,"terror":-3,"thankful":2,"thief":-3,
  "thorough":2,"thoughtful":2,"threat":-2,"threaten":-2,"thrill":5,"thrive":3,"tired":-2,
  "tolerate":-1,"top":2,"torture":-4,"toxic":-3,"tragic":-2,"trap":-1,"treasure":2,
  "tremendous":4,"trick":-2,"triumph":4,"trouble":-2,"troubled":-2,"true":2,"trust":1,
  "trusted":2,"ugly":-3,"unacceptable":-2,"uncertain":-1,"uncomfortable":-2,"undermine":-2,
  "understand":2,"unfair":-2,"unfortunate":-2,"unhappy":-2,"unique":2,"unite":1,"unjust":-2,
  "unlock":1,"unpleasant":-2,"upset":-2,"useful":2,"useless":-2,"vain":-2,"valuable":2,
  "value":2,"venom":-2,"vicious":-2,"victim":-3,"victory":3,"vigorous":2,"villain":-3,
  "violate":-3,"violence":-3,"virtue":3,"vital":2,"vivid":2,"vulnerable":-2,"warm":1,
  "warning":-2,"waste":-1,"weak":-2,"wealth":3,"weary":-2,"weird":-2,"welcome":2,
  "wicked":-2,"win":4,"wisdom":3,"wise":2,"wish":1,"withdraw":-1,"wonderful":4,"worried":-3,
  "worry":-3,"worse":-3,"worst":-3,"worth":2,"worthless":-3,"worthy":2,"wow":4,"wrath":-3,
  "wrong":-2,"yearn":-1,"youthful":2,"zeal":2,"zealous":2
};

const STOP_WORDS = new Set([
  "i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself",
  "yourselves","he","him","his","himself","she","her","hers","herself","it","its","itself",
  "they","them","their","theirs","themselves","what","which","who","whom","this","that",
  "these","those","am","is","are","was","were","be","been","being","have","has","had",
  "having","do","does","did","doing","a","an","the","and","but","if","or","because","as",
  "until","while","of","at","by","for","with","about","against","between","through",
  "during","before","after","above","below","to","from","up","down","in","out","on","off",
  "over","under","again","further","then","once","here","there","when","where","why","how",
  "all","both","each","few","more","most","other","some","such","no","nor","not","only",
  "own","same","so","than","too","very","s","t","can","will","just","don","should","now",
  "d","ll","m","o","re","ve","y","ain","aren","couldn","didn","doesn","hadn","hasn",
  "haven","isn","ma","mightn","mustn","needn","shan","shouldn","wasn","weren","won","wouldn"
]);

export class SovereignNLPEngine {
  tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(t => t.length > 0);
  }

  removeStopWords(tokens: string[]): string[] {
    return tokens.filter(t => !STOP_WORDS.has(t));
  }

  stem(word: string): string {
    if (word.length < 4) return word;
    const suffixes = ['ational','tional','enci','anci','izer','ably','alli','entli','eli','ousli',
      'ization','ation','ator','alism','iveness','fulness','ousness','aliti','iviti','biliti',
      'icate','ative','alize','iciti','ical','ful','ness','ing','tion','sion','ment','able',
      'ible','ness','ity','ous','ive','ize','ist','ism','ed','ly','er','es','al','en','s'];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
        return word.slice(0, word.length - suffix.length);
      }
    }
    return word;
  }

  sentimentScore(text: string): { score: number; comparative: number; positive: string[]; negative: string[]; } {
    const tokens = this.tokenize(text);
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    for (const token of tokens) {
      const val = AFINN[token];
      if (val !== undefined) {
        score += val;
        if (val > 0) positive.push(token);
        else negative.push(token);
      }
    }
    const negators = ['not','no','never','neither','nobody','nothing','nowhere','nor',"don't","doesn't","didn't","wasn't","weren't","won't","wouldn't","can't","couldn't","shouldn't"];
    for (let i = 0; i < tokens.length - 1; i++) {
      if (negators.includes(tokens[i]) && AFINN[tokens[i+1]] !== undefined) {
        score -= 2 * AFINN[tokens[i+1]];
      }
    }
    return { score, comparative: tokens.length > 0 ? score / tokens.length : 0, positive, negative };
  }

  detectEmotion(text: string): { primary: string; confidence: number; valence: number; arousal: number; } {
    const lower = text.toLowerCase();
    const emotionPatterns: Record<string, { patterns: string[]; valence: number; arousal: number }> = {
      joy: { patterns: ['happy','glad','excited','wonderful','amazing','great','love','awesome','fantastic','delighted','cheerful','thrilled','ecstatic','elated'], valence: 0.8, arousal: 0.6 },
      sadness: { patterns: ['sad','unhappy','depressed','miserable','heartbroken','grief','sorrow','lonely','melancholy','gloomy','devastated','despair'], valence: -0.7, arousal: -0.3 },
      anger: { patterns: ['angry','furious','rage','mad','hate','disgusted','outraged','infuriated','enraged','livid','hostile','annoyed','irritated'], valence: -0.8, arousal: 0.8 },
      fear: { patterns: ['afraid','scared','terrified','anxious','worried','panic','dread','frightened','horrified','alarmed','nervous','uneasy'], valence: -0.7, arousal: 0.7 },
      surprise: { patterns: ['surprised','shocked','astonished','amazed','stunned','startled','unexpected','unbelievable','wow','incredible'], valence: 0.1, arousal: 0.8 },
      trust: { patterns: ['trust','believe','faith','confident','reliable','honest','loyal','dependable','sincere','genuine','devoted'], valence: 0.6, arousal: 0.1 },
      disgust: { patterns: ['disgusting','revolting','repulsive','nasty','gross','vile','sickening','appalling','hideous','abhorrent'], valence: -0.8, arousal: 0.4 },
      anticipation: { patterns: ['expect','anticipate','hope','looking forward','eager','ready','prepared','excited about','waiting for','curious'], valence: 0.3, arousal: 0.5 },
    };
    let bestEmotion = 'neutral';
    let bestCount = 0;
    let bestValence = 0;
    let bestArousal = 0;
    for (const [emotion, config] of Object.entries(emotionPatterns)) {
      const count = config.patterns.filter(p => lower.includes(p)).length;
      if (count > bestCount) {
        bestCount = count;
        bestEmotion = emotion;
        bestValence = config.valence;
        bestArousal = config.arousal;
      }
    }
    const sent = this.sentimentScore(text);
    if (bestCount === 0) {
      if (sent.comparative > 0.2) { bestEmotion = 'joy'; bestValence = 0.5; bestArousal = 0.3; }
      else if (sent.comparative < -0.2) { bestEmotion = 'sadness'; bestValence = -0.5; bestArousal = -0.2; }
    }
    return { primary: bestEmotion, confidence: Math.min(bestCount / 3, 1), valence: bestValence, arousal: bestArousal };
  }

  extractEntities(text: string): { type: string; value: string; }[] {
    const entities: { type: string; value: string }[] = [];
    const emailRe = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const urlRe = /https?:\/\/[^\s]+/g;
    const ipRe = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    const dateRe = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
    const moneyRe = /\$[\d,]+\.?\d*/g;
    const percentRe = /\b\d+\.?\d*%/g;
    const numberRe = /\b\d+\.?\d*\b/g;
    const hashtagRe = /#\w+/g;
    const mentionRe = /@\w+/g;
    for (const m of text.matchAll(emailRe)) entities.push({ type: 'email', value: m[0] });
    for (const m of text.matchAll(urlRe)) entities.push({ type: 'url', value: m[0] });
    for (const m of text.matchAll(ipRe)) entities.push({ type: 'ip', value: m[0] });
    for (const m of text.matchAll(dateRe)) entities.push({ type: 'date', value: m[0] });
    for (const m of text.matchAll(moneyRe)) entities.push({ type: 'money', value: m[0] });
    for (const m of text.matchAll(percentRe)) entities.push({ type: 'percent', value: m[0] });
    for (const m of text.matchAll(hashtagRe)) entities.push({ type: 'hashtag', value: m[0] });
    for (const m of text.matchAll(mentionRe)) entities.push({ type: 'mention', value: m[0] });
    const words = text.split(/\s+/);
    for (const word of words) {
      if (/^[A-Z][a-z]+$/.test(word) && !['I','The','A','An','This','That','It','We','He','She','They','My','Your','His','Her'].includes(word)) {
        entities.push({ type: 'proper_noun', value: word });
      }
    }
    return entities;
  }

  classifyIntent(text: string): { intent: string; confidence: number } {
    const lower = text.toLowerCase().trim();
    const patterns: [string, RegExp[]][] = [
      ['greeting', [/^(hi|hello|hey|howdy|greetings|good morning|good evening|good afternoon|yo|sup)\b/]],
      ['farewell', [/^(bye|goodbye|see you|later|farewell|goodnight|take care)\b/]],
      ['question', [/^(what|who|where|when|why|how|which|whose|whom|is|are|was|were|do|does|did|can|could|would|should|will|shall|may|might)\b/, /\?$/]],
      ['command', [/^(do|make|create|build|run|start|stop|delete|remove|show|find|search|get|set|update|fix|open|close|send|tell|give|help|list|add|move)\b/]],
      ['opinion', [/\b(think|believe|feel|opinion|suggest|recommend|prefer|like|dislike|love|hate|best|worst|should|ought)\b/]],
      ['complaint', [/\b(broken|bug|error|wrong|fail|crash|issue|problem|doesn't work|not working|can't|unable)\b/]],
      ['gratitude', [/\b(thank|thanks|appreciate|grateful|thx)\b/]],
      ['affirmation', [/^(yes|yeah|yep|sure|ok|okay|correct|right|absolutely|definitely|agreed|exactly)\b/]],
      ['negation', [/^(no|nope|nah|never|not|wrong|incorrect|disagree)\b/]],
      ['request', [/\b(please|could you|would you|can you|i need|i want|i'd like)\b/]],
    ];
    for (const [intent, regexes] of patterns) {
      for (const re of regexes) {
        if (re.test(lower)) return { intent, confidence: 0.75 };
      }
    }
    return { intent: 'statement', confidence: 0.5 };
  }

  tfidf(documents: string[]): Map<string, Map<string, number>> {
    const docTokens = documents.map(d => this.removeStopWords(this.tokenize(d)).map(t => this.stem(t)));
    const df = new Map<string, number>();
    for (const tokens of docTokens) {
      const unique = new Set(tokens);
      for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
    }
    const result = new Map<string, Map<string, number>>();
    for (let i = 0; i < documents.length; i++) {
      const tokens = docTokens[i];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      const tfidfMap = new Map<string, number>();
      for (const [term, count] of tf) {
        const idf = Math.log(documents.length / (df.get(term) || 1));
        tfidfMap.set(term, (count / tokens.length) * idf);
      }
      result.set(`doc_${i}`, tfidfMap);
    }
    return result;
  }

  cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, magA = 0, magB = 0;
    for (const [k, v] of a) { dot += v * (b.get(k) || 0); magA += v * v; }
    for (const [, v] of b) magB += v * v;
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  extractKeywords(text: string, topN = 10): string[] {
    const tokens = this.removeStopWords(this.tokenize(text));
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }

  summarize(text: string, maxSentences = 3): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= maxSentences) return text;
    const keywords = this.extractKeywords(text, 20);
    const scored = sentences.map((s, i) => {
      const tokens = this.tokenize(s);
      const keywordScore = tokens.filter(t => keywords.includes(t)).length / Math.max(tokens.length, 1);
      const positionScore = i === 0 ? 0.3 : i < 3 ? 0.1 : 0;
      const lengthScore = tokens.length > 5 && tokens.length < 30 ? 0.2 : 0;
      return { sentence: s.trim(), score: keywordScore + positionScore + lengthScore, index: i };
    });
    return scored.sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence)
      .join(' ');
  }

  languageDetect(text: string): string {
    const patterns: [string, RegExp][] = [
      ['chinese', /[\u4e00-\u9fff]/],
      ['japanese', /[\u3040-\u309f\u30a0-\u30ff]/],
      ['korean', /[\uac00-\ud7af]/],
      ['arabic', /[\u0600-\u06ff]/],
      ['russian', /[\u0400-\u04ff]/],
      ['hebrew', /[\u0590-\u05ff]/],
      ['thai', /[\u0e00-\u0e7f]/],
      ['spanish', /\b(el|la|los|las|de|en|que|por|con|para|una|como|más|pero|su|este|ya|también)\b/i],
      ['french', /\b(le|la|les|de|des|en|que|pour|avec|une|dans|est|pas|sur|qui|sont|cette|être|nous|vous|très)\b/i],
      ['german', /\b(der|die|das|ein|eine|und|ist|von|mit|auf|für|nicht|sich|den|dem|auch|es|ich|zu|werden)\b/i],
    ];
    for (const [lang, re] of patterns) {
      if (re.test(text)) return lang;
    }
    return 'english';
  }

  nGrams(tokens: string[], n: number): string[] {
    const result: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      result.push(tokens.slice(i, i + n).join(' '));
    }
    return result;
  }

  readabilityScore(text: string): { fleschKincaid: number; gradeLevel: number; avgSentenceLength: number; avgSyllables: number; readabilityLevel: string } {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const words = this.tokenize(text);
    const syllableCount = (word: string): number => {
      const w = word.toLowerCase().replace(/[^a-z]/g, '');
      if (w.length <= 3) return 1;
      let count = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g)?.length || 1;
      return Math.max(1, count);
    };
    const totalSyllables = words.reduce((s, w) => s + syllableCount(w), 0);
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    const avgSyllables = totalSyllables / Math.max(words.length, 1);
    const fleschKincaid = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllables;
    const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllables - 15.59;
    let readabilityLevel: string;
    if (fleschKincaid >= 80) readabilityLevel = "very easy";
    else if (fleschKincaid >= 60) readabilityLevel = "easy";
    else if (fleschKincaid >= 40) readabilityLevel = "moderate";
    else if (fleschKincaid >= 20) readabilityLevel = "difficult";
    else readabilityLevel = "very difficult";
    return { fleschKincaid: Math.round(fleschKincaid * 10) / 10, gradeLevel: Math.round(gradeLevel * 10) / 10, avgSentenceLength: Math.round(avgSentenceLength * 10) / 10, avgSyllables: Math.round(avgSyllables * 100) / 100, readabilityLevel };
  }

  vocabularyRichness(text: string): { uniqueWords: number; totalWords: number; typeTokenRatio: number; hapaxLegomena: number; richness: string } {
    const tokens = this.tokenize(text);
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    const uniqueWords = freq.size;
    const hapaxLegomena = [...freq.values()].filter(v => v === 1).length;
    const typeTokenRatio = tokens.length > 0 ? uniqueWords / tokens.length : 0;
    let richness: string;
    if (typeTokenRatio > 0.7) richness = "very rich";
    else if (typeTokenRatio > 0.5) richness = "rich";
    else if (typeTokenRatio > 0.3) richness = "moderate";
    else richness = "repetitive";
    return { uniqueWords, totalWords: tokens.length, typeTokenRatio: Math.round(typeTokenRatio * 1000) / 1000, hapaxLegomena, richness };
  }

  grammarCheck(text: string): { issues: { type: string; description: string; position: number }[]; score: number } {
    const issues: { type: string; description: string; position: number }[] = [];
    const patterns: [string, RegExp, string][] = [
      ["double_space", /  +/g, "Double space detected"],
      ["missing_capital", /[.!?]\s+[a-z]/g, "Missing capitalization after sentence"],
      ["repeated_word", /\b(\w+)\s+\1\b/gi, "Repeated word"],
      ["comma_splice", /,\s*[A-Z]/g, "Possible comma splice"],
      ["missing_period", /[a-z]\s*$/g, "Missing period at end"],
      ["its_vs_its", /\bit's\s+(own|self)\b/gi, "Should be 'its' (possessive)"],
      ["their_there", /\btheir\s+(is|are|was|were)\b/gi, "Should be 'there'"],
      ["your_youre", /\byour\s+(a|an|the|going|not|never|always)\b/gi, "Should be 'you're'"],
    ];
    for (const [type, pattern, description] of patterns) {
      let match;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(text)) !== null) {
        issues.push({ type, description, position: match.index });
      }
    }
    const score = Math.max(0, 100 - issues.length * 10);
    return { issues, score };
  }

  paraphrase(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const synonyms: Record<string, string[]> = {
      "good": ["excellent", "outstanding", "great"], "bad": ["poor", "terrible", "awful"],
      "big": ["large", "enormous", "massive"], "small": ["tiny", "miniature", "compact"],
      "fast": ["quick", "rapid", "swift"], "slow": ["gradual", "leisurely", "unhurried"],
      "happy": ["joyful", "delighted", "pleased"], "sad": ["sorrowful", "melancholy", "gloomy"],
      "important": ["crucial", "essential", "vital"], "easy": ["simple", "straightforward", "effortless"],
      "hard": ["difficult", "challenging", "demanding"], "beautiful": ["gorgeous", "stunning", "exquisite"],
      "smart": ["intelligent", "brilliant", "clever"], "strong": ["powerful", "robust", "mighty"],
      "think": ["believe", "consider", "reckon"], "make": ["create", "produce", "construct"],
      "use": ["utilize", "employ", "leverage"], "show": ["demonstrate", "illustrate", "reveal"],
      "get": ["obtain", "acquire", "receive"], "help": ["assist", "aid", "support"],
    };
    const paraphrases: string[] = [];
    for (const sent of sentences) {
      const words = sent.split(/\s+/);
      const rewritten = words.map(w => {
        const clean = w.toLowerCase().replace(/[^a-z]/g, '');
        const syns = synonyms[clean];
        if (syns) return syns[Math.floor(Math.random() * syns.length)] + (w.match(/[^a-z]$/i)?.[0] || '');
        return w;
      });
      paraphrases.push(rewritten.join(' '));
    }
    return paraphrases;
  }

  posTag(text: string): { word: string; tag: string }[] {
    const tokens = text.split(/\s+/);
    const tagPatterns: [RegExp, string][] = [
      [/^(the|a|an|this|that|these|those|my|your|his|her|its|our|their)$/i, "DET"],
      [/^(is|are|was|were|am|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|shall|can)$/i, "AUX"],
      [/^(in|on|at|to|for|with|by|from|of|about|through|during|before|after|above|below|between|under|over)$/i, "PREP"],
      [/^(and|but|or|nor|so|yet|for|because|although|while|if|when|where|that|which|who|whom)$/i, "CONJ"],
      [/^(I|me|you|he|she|it|we|they|him|her|us|them|myself|yourself|himself|herself|itself)$/i, "PRON"],
      [/^(not|never|always|often|usually|sometimes|rarely|very|really|quite|rather|too|also|just)$/i, "ADV"],
      [/ly$/i, "ADV"],
      [/ing$/i, "VERB"],
      [/ed$/i, "VERB"],
      [/tion$|ness$|ment$|ity$/i, "NOUN"],
      [/ful$|ous$|ive$|able$|ible$/i, "ADJ"],
      [/^[A-Z][a-z]+$/, "PROPN"],
    ];
    return tokens.map(word => {
      const clean = word.replace(/[^a-zA-Z'-]/g, '');
      for (const [pattern, tag] of tagPatterns) {
        if (pattern.test(clean)) return { word, tag };
      }
      return { word, tag: /^[a-z]/.test(clean) ? "NOUN" : "X" };
    });
  }

  sentenceSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.removeStopWords(this.tokenize(a)));
    const tokensB = new Set(this.removeStopWords(this.tokenize(b)));
    const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  textStatistics(text: string): { sentences: number; words: number; characters: number; paragraphs: number; avgWordsPerSentence: number; longestSentence: number; shortestSentence: number } {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const words = this.tokenize(text);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentLengths = sentences.map(s => this.tokenize(s).length);
    return {
      sentences: sentences.length,
      words: words.length,
      characters: text.length,
      paragraphs: paragraphs.length,
      avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length * 10) / 10 : 0,
      longestSentence: sentLengths.length > 0 ? Math.max(...sentLengths) : 0,
      shortestSentence: sentLengths.length > 0 ? Math.min(...sentLengths) : 0,
    };
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("Tokenize basic", this.tokenize("Hello World!").length === 2);
    check("Sentiment positive", this.sentimentScore("I love this amazing product").score > 0);
    check("Sentiment negative", this.sentimentScore("This is terrible and awful").score < 0);
    check("Sentiment negation", this.sentimentScore("not happy").score < this.sentimentScore("happy").score);
    check("Emotion joy", this.detectEmotion("I am so happy and excited").primary === 'joy');
    check("Emotion anger", this.detectEmotion("I am furious and outraged").primary === 'anger');
    check("Emotion sadness", this.detectEmotion("I feel sad and lonely").primary === 'sadness');
    check("Intent question", this.classifyIntent("What is the weather?").intent === 'question');
    check("Intent greeting", this.classifyIntent("Hello there").intent === 'greeting');
    check("Intent command", this.classifyIntent("Create a new project").intent === 'command');
    check("Entity email", this.extractEntities("Contact me at test@example.com").some(e => e.type === 'email'));
    check("Entity url", this.extractEntities("Visit https://example.com").some(e => e.type === 'url'));
    check("Entity money", this.extractEntities("Price is $99.99").some(e => e.type === 'money'));
    check("Keywords extract", this.extractKeywords("The sovereign brain processes neural signals for autonomous intelligence").length > 0);
    check("Stemming", this.stem("running") === "runn" || this.stem("running").length < "running".length);
    check("Stop words", this.removeStopWords(["the","sovereign","brain","is","running"]).length < 5);
    check("Language detect English", this.languageDetect("Hello world this is a test") === 'english');
    check("Language detect Chinese", this.languageDetect("你好世界") === 'chinese');
    check("Cosine similarity identical", this.cosineSimilarity(new Map([["a",1],["b",2]]), new Map([["a",1],["b",2]])) > 0.99);
    check("Summarize", this.summarize("First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.", 2).split('.').length <= 3);
    check("N-grams", this.nGrams(["a","b","c","d"], 2).length === 3);

    check("Readability", (() => {
      const r = this.readabilityScore("The cat sat on the mat. It was a good day.");
      return r.fleschKincaid > 0 && r.readabilityLevel.length > 0;
    })());
    check("Vocabulary richness", (() => {
      const r = this.vocabularyRichness("The quick brown fox jumps over the lazy dog and the fox runs fast");
      return r.typeTokenRatio > 0 && r.uniqueWords > 5;
    })());
    check("Grammar check clean", this.grammarCheck("Hello world.").score >= 80);
    check("Grammar check errors", this.grammarCheck("Hello  world. this is bad").issues.length > 0);
    check("Paraphrase generation", this.paraphrase("This is a good and happy day.").length > 0);
    check("POS tagging", (() => {
      const tags = this.posTag("The quick brown fox jumps");
      return tags.some(t => t.tag === "DET") && tags.length === 5;
    })());
    check("Sentence similarity identical", this.sentenceSimilarity("the cat sat", "the cat sat") > 0.9);
    check("Sentence similarity different", this.sentenceSimilarity("the cat sat", "the dog ran") < 0.5);
    check("Text statistics", (() => {
      const s = this.textStatistics("First sentence. Second sentence. Third sentence.");
      return s.sentences === 3 && s.words > 4;
    })());

    return { passed, total, details };
  }
}

export const nlpEngine = new SovereignNLPEngine();
