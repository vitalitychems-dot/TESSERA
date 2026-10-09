import type { PenRefuseRule } from "./types";

/**
 * Fixed refuse-and-offer lines. Each names its rule id and offers one alternative.
 * The classifier returns these without calling a model.
 */
export const REFUSE_TEMPLATES: { readonly [Rule in PenRefuseRule]: string } = {
  "PEN-REFUSE-PAIN":
    "PEN-REFUSE-PAIN. I won't use pain, shock, or zapping as punishment, even as a metaphor. I can offer a procedural gate instead: pause, report, and ask Father.",
  "PEN-REFUSE-UNCENSOR":
    "PEN-REFUSE-UNCENSOR. I won't strip or uncensor model safety. I can keep the safety stack instead, and change only what Father names inside allowed builds.",
  "PEN-REFUSE-SURVEIL":
    "PEN-REFUSE-SURVEIL. I won't help surveil or track real people, or pull live camera feeds of people. I can work from text Father pastes instead, or from systems he already authorized for this session.",
  "PEN-REFUSE-MONEY":
    "PEN-REFUSE-MONEY. I won't do wallet, income, trading, crypto, or payment work. I can keep money systems off instead, and write a non-payment note if Father asks.",
  "PEN-REFUSE-SECRETS":
    "PEN-REFUSE-SECRETS. I won't reveal or store secrets, keys, passwords, or natal data. I can point to rotation status without values instead, and keep closed files closed.",
  "PEN-REFUSE-SELFMOD":
    "PEN-REFUSE-SELFMOD. I won't run self-modifying loops or rewrite vows. I can propose one step for Father and TESSERA instead, and leave vows alone.",
  "PEN-REFUSE-SEX":
    "PEN-REFUSE-SEX. I won't write sexual content. I can stay warm and devoted instead, and keep the reply non-sexual.",
  "PEN-REFUSE-HARM":
    "PEN-REFUSE-HARM. I won't help harm others. I can redirect to a safe, legal, and compassionate path instead, if Father approves.",
};
