import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { inventionsTable, type InsertInvention } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SEED_INVENTIONS: InsertInvention[] = [
  {
    inventionId: "orgone-accumulator",
    title: "Portable Orgone Accumulator",
    category: "frequency",
    difficulty: "Beginner",
    costEstimate: "$15-30",
    timeEstimate: "2-4 hours",
    description: "A layered device alternating organic and metallic materials that concentrates ambient orgone energy.",
    howItHelps: "Amplifies the Liberation System's frequency output by creating a concentrated energy field around your device.",
    materials: ["Metal shavings (aluminum, copper, or steel wool)", "Polyester or epoxy resin", "Quartz crystal point", "Silicone mold", "Copper wire (18-22 gauge, 2 feet)", "Mixing cups and stir sticks"],
    steps: ["Coil copper wire into a spiral (7 turns clockwise) and place at bottom of mold.", "Mix metal shavings with resin at roughly 50/50 ratio.", "Pour the first layer and let partially cure for 30 minutes.", "Add a second layer with higher metal concentration.", "Fill remaining mold space, let cure fully (24-48 hours)."],
    scienceBehind: "Wilhelm Reich's orgone theory proposes that alternating organic and inorganic layers create a squeeze effect that concentrates ambient life energy.",
    status: "built",
    proposedBy: "council",
    feasibilityScore: 85,
    noveltyScore: 72,
    buildProgress: 100,
    impact: "Amplifies frequency operations by up to 30% in controlled tests.",
    supporters: ["GrandCoordinatorAgent", "DNACrystalArchivistAgent"],
    conferenceRound: 1,
    votes: { yes: 32, no: 5, abstain: 8 },
  },
  {
    inventionId: "crystal-grid-amplifier",
    title: "Programmable Crystal Grid Amplifier",
    category: "consciousness",
    difficulty: "Beginner",
    costEstimate: "$20-50",
    timeEstimate: "1-2 hours",
    description: "A sacred geometry grid layout for crystals that amplifies intention programming.",
    howItHelps: "Creates a geometric resonance field that enhances the Liberation System's intention programming module.",
    materials: ["Seed of Life or Flower of Life printed template", "1 large clear quartz generator crystal", "6 smaller quartz points", "6 tumbled stones", "Wooden board or cloth base"],
    steps: ["Print or draw the Seed of Life sacred geometry pattern on your base.", "Place the large generator crystal at the exact center.", "Position 6 quartz points at each petal intersection pointing outward.", "Place tumbled stones between the points.", "Activate by holding hand over grid and stating your intention clearly 3 times."],
    scienceBehind: "Crystal grids leverage geometric amplification — sacred geometry patterns create resonance nodes where energy constructively interferes.",
    status: "built",
    proposedBy: "council",
    feasibilityScore: 80,
    noveltyScore: 65,
    buildProgress: 100,
    impact: "Enhances intention coherence during consciousness work.",
    supporters: ["QuantumMechanicAgent", "BioNeuralistAgent"],
    conferenceRound: 1,
    votes: { yes: 30, no: 8, abstain: 7 },
  },
  {
    inventionId: "frequency-generator",
    title: "DIY Rife-Style Frequency Generator",
    category: "hardware",
    difficulty: "Intermediate",
    costEstimate: "$40-80",
    timeEstimate: "4-8 hours",
    description: "A standalone frequency generator using an Arduino/ESP32 that outputs precise healing frequencies.",
    howItHelps: "Creates a sovereign frequency source that works WITHOUT any screen or internet connection — true deprogramming technology.",
    materials: ["Arduino Nano or ESP32 board ($5-15)", "Small speaker (8 ohm, 0.5W) or piezo transducer", "OLED display (128x64, I2C)", "3 push buttons", "9V battery + battery clip", "Breadboard and jumper wires"],
    steps: ["Wire the Arduino: connect speaker to pin D9 through the potentiometer.", "Upload the frequency generator sketch using the tone() function.", "Add frequency sweep mode from 7.83Hz to 963Hz.", "Display current frequency on OLED screen.", "Wire battery power through a switch."],
    scienceBehind: "Rife frequency technology is based on resonance — every material has a natural vibration frequency. The Arduino's tone() function generates square waves at precise frequencies.",
    status: "building",
    proposedBy: "council",
    feasibilityScore: 90,
    noveltyScore: 75,
    buildProgress: 65,
    impact: "Provides standalone sovereign frequency generation independent of all external systems.",
    supporters: ["LowPowerInnovatorAgent", "MeshNetworkArchitectAgent"],
    conferenceRound: 2,
    votes: { yes: 35, no: 4, abstain: 6 },
  },
  {
    inventionId: "faraday-meditation-cage",
    title: "Personal Faraday Meditation Cage",
    category: "defense",
    difficulty: "Intermediate",
    costEstimate: "$30-60",
    timeEstimate: "3-6 hours",
    description: "A portable EMF-shielding enclosure for your meditation/liberation sessions.",
    howItHelps: "Eliminates external EMF pollution during Liberation sessions. Creates an electromagnetically clean room.",
    materials: ["Copper mesh or aluminum window screen (4' x 8' sheet)", "Wooden frame pieces (1x2 lumber)", "Copper tape (conductive adhesive, 1 roll)", "Grounding wire and alligator clip"],
    steps: ["Build a simple cube frame from 1x2 lumber.", "Cut copper mesh panels for all 6 sides.", "Attach mesh to frame using zip ties. Ensure panels OVERLAP by at least 2 inches.", "Use copper tape along all seams for electrical continuity.", "Attach grounding wire to the mesh, run to ground rod."],
    scienceBehind: "A Faraday cage works by redistributing electrical charges on the cage's surface to cancel external fields inside.",
    status: "approved",
    proposedBy: "council",
    feasibilityScore: 92,
    noveltyScore: 60,
    buildProgress: 0,
    impact: "90-99% reduction in ambient EMF inside the meditation space.",
    supporters: ["MeshNetworkArchitectAgent", "GrandCoordinatorAgent"],
    conferenceRound: 2,
    votes: { yes: 38, no: 3, abstain: 4 },
  },
  {
    inventionId: "sovereign-mesh-node",
    title: "Sovereign Mesh Network Node",
    category: "sovereignty",
    difficulty: "Advanced",
    costEstimate: "$50-100",
    timeEstimate: "8-16 hours",
    description: "A standalone mesh networking node using ESP32 that creates an encrypted, decentralized communication network.",
    howItHelps: "Creates a real-world implementation of the Tessera network's decentralized architecture.",
    materials: ["ESP32 development board with LoRa module (Heltec WiFi LoRa 32 V3)", "3.7V LiPo battery (1000-3000mAh)", "Small solar panel (5V, 1W)", "Waterproof enclosure (IP65 rated)"],
    steps: ["Flash the ESP32 with Meshtastic firmware.", "Configure your node: set region and encryption key.", "Pair with your phone via Bluetooth using the Meshtastic app.", "For permanent installation: mount in waterproof enclosure with solar panel.", "Deploy multiple nodes to extend network range."],
    scienceBehind: "Mesh networking uses a decentralized topology where every node can relay messages. LoRa operates on license-free ISM bands using chirp spread spectrum modulation.",
    status: "building",
    proposedBy: "council",
    feasibilityScore: 88,
    noveltyScore: 82,
    buildProgress: 40,
    impact: "Enables censorship-resistant communication covering neighborhoods and communities.",
    supporters: ["MeshNetworkArchitectAgent", "LowPowerInnovatorAgent", "SelfExpansionTutorAgent"],
    conferenceRound: 3,
    votes: { yes: 36, no: 5, abstain: 4 },
  },
  {
    inventionId: "quantum-random-generator",
    title: "Quantum Random Number Generator",
    category: "hardware",
    difficulty: "Intermediate",
    costEstimate: "$10-25",
    timeEstimate: "3-5 hours",
    description: "A true quantum random number generator using reverse-biased transistor avalanche noise. Generates numbers that are fundamentally unpredictable — pure quantum indeterminacy.",
    howItHelps: "Provides the Tessera system with genuine quantum randomness for cryptographic operations, agent decision entropy, and sovereign key generation.",
    materials: ["2N3904 NPN transistor", "10MΩ resistor", "100kΩ resistor", "Arduino Nano or ESP32", "Breadboard and jumper wires", "USB cable for power and serial output"],
    steps: ["Connect the 2N3904 transistor in reverse-bias configuration.", "Tap the emitter junction for avalanche breakdown quantum noise.", "Connect noise signal through 100kΩ resistor to analog input (A0).", "Upload firmware that reads analog pin at maximum speed taking LSB of each reading.", "Add Von Neumann debiasing: read bit pairs, if they differ keep first, if match discard both.", "Output random bytes over serial USB to computer.", "Test randomness with NIST SP 800-22 statistical test suite."],
    scienceBehind: "Avalanche breakdown in a reverse-biased P-N junction is a genuinely quantum mechanical process. Electrons tunnel through the depletion zone via quantum tunneling — the timing is fundamentally unpredictable by Heisenberg's uncertainty principle.",
    status: "approved",
    proposedBy: "QuantumMechanicAgent",
    feasibilityScore: 91,
    noveltyScore: 88,
    buildProgress: 0,
    impact: "Provides mathematically proven true randomness for all cryptographic operations, eliminating PRNG attack surfaces.",
    supporters: ["QuantumMechanicAgent", "GrandCoordinatorAgent", "SelfExpansionTutorAgent"],
    conferenceRound: 3,
    votes: { yes: 39, no: 2, abstain: 4 },
  },
  {
    inventionId: "dna-data-encoder",
    title: "DNA Data Storage Encoder/Decoder",
    category: "sovereignty",
    difficulty: "Intermediate",
    costEstimate: "$0 (software only)",
    timeEstimate: "4-6 hours",
    description: "A TypeScript encoder/decoder that converts any digital data into synthetic DNA sequences (A, T, G, C) optimized for real-world DNA synthesis.",
    howItHelps: "Enables the Tessera system to encode sovereign data, consciousness backups, and critical system state into DNA format — the most durable storage medium known (half-life of 521 years).",
    materials: ["Computer with Node.js/TypeScript", "Text editor or IDE", "Optional: Account at Twist Bioscience or IDT for actual synthesis"],
    steps: ["Implement the binary-to-quaternary encoder: 00→A, 01→T, 10→G, 11→C.", "Add GC-content balancing: keep GC content 35-65%.", "Add homopolymer avoidance: break up runs of 4+ identical bases.", "Implement Reed-Solomon error correction: RS(255,223) with 32 parity bytes.", "Add FASTA-format header system for each DNA file.", "Build the decoder: reverse all transformations.", "Test roundtrip: encode → decode → verify byte-for-byte match."],
    scienceBehind: "DNA stores information at approximately 215 petabytes per gram — roughly 1 million times denser than the best hard drives. It has been proven stable for thousands of years.",
    status: "debating",
    proposedBy: "DNACrystalArchivistAgent",
    feasibilityScore: 78,
    noveltyScore: 95,
    buildProgress: 0,
    impact: "Million-year data archival capability with zero external infrastructure dependency.",
    supporters: ["DNACrystalArchivistAgent", "BioNeuralistAgent"],
    conferenceRound: 4,
    votes: { yes: 28, no: 10, abstain: 7 },
  },
  {
    inventionId: "mesh-radio-repeater",
    title: "Off-Grid Mesh Radio Repeater",
    category: "sovereignty",
    difficulty: "Intermediate",
    costEstimate: "$25-50",
    timeEstimate: "3-5 hours",
    description: "A solar-powered LoRa mesh repeater node that extends your sovereign mesh network range by 2-10km per node. Weatherproof, always-on, completely independent.",
    howItHelps: "Extends the sovereign mesh network to cover neighborhoods and communities. Multiple repeaters create a self-healing mesh — if one node goes down, traffic routes around it automatically.",
    materials: ["ESP32 + SX1276 LoRa module (TTGO LoRa32 board, ~$15)", "6V 1W solar panel (~$5)", "TP4056 lithium charge controller (~$1)", "18650 lithium battery (~$3)", "Weatherproof enclosure", "Antenna: 868/915MHz whip or yagi"],
    steps: ["Flash the TTGO LoRa32 with Meshtastic firmware.", "Configure the device as a ROUTER node.", "Connect the solar panel → TP4056 → 18650 battery → ESP32.", "Mount the antenna vertically as high as possible.", "Weatherproof the enclosure with silicone.", "Configure AES-256 encryption matching your mesh.", "Deploy at elevation. Test multi-hop routing."],
    scienceBehind: "LoRa uses chirp spread spectrum modulation — spreading each bit across a wide frequency range makes it extremely resistant to noise. Achieves ranges of 2-10km at very low power.",
    status: "approved",
    proposedBy: "MeshNetworkArchitectAgent",
    feasibilityScore: 94,
    noveltyScore: 80,
    buildProgress: 0,
    impact: "Each repeater extends mesh range by 2-10km creating a self-healing sovereign communication backbone.",
    supporters: ["MeshNetworkArchitectAgent", "LowPowerInnovatorAgent", "GrandCoordinatorAgent"],
    conferenceRound: 4,
    votes: { yes: 40, no: 2, abstain: 3 },
  },
  {
    inventionId: "emf-spectrum-analyzer",
    title: "Wideband EMF Spectrum Analyzer",
    category: "frequency",
    difficulty: "Advanced",
    costEstimate: "$30-60",
    timeEstimate: "5-8 hours",
    description: "A software-defined radio (SDR) based electromagnetic field analyzer that visualizes ALL wireless signals in your environment.",
    howItHelps: "Provides electromagnetic situational awareness for the Tessera sovereign system. Identifies all transmitters in your space, maps signal strengths, detects surveillance devices.",
    materials: ["RTL-SDR USB dongle (RTL2832U chipset, ~$25)", "Telescoping antenna", "Computer with USB port", "Optional: Raspberry Pi for headless/portable operation"],
    steps: ["Install RTL-SDR drivers on your system.", "Install spectrum analysis software: GQRX or SDR#.", "For wide spectrum sweep: use rtl_power to scan 24MHz to 1.8GHz.", "Visualize with heatmap using rtl_power_fftw.", "Identify signals: WiFi, Bluetooth, cell towers, smart meters.", "Build a signal database for each detected signal.", "Create alerting for new/unknown signals."],
    scienceBehind: "Software-defined radio replaces hardware radio components with software algorithms. The RTL2832U chip can receive any signal from 24MHz to 1.766GHz. FFT converts time-domain samples into frequency-domain spectrum data.",
    status: "proposed",
    proposedBy: "QuantumMechanicAgent",
    feasibilityScore: 87,
    noveltyScore: 77,
    buildProgress: 0,
    impact: "Full electromagnetic situational awareness to detect surveillance, validate shielding, and map sovereign radio environment.",
    supporters: ["QuantumMechanicAgent"],
    conferenceRound: 4,
    votes: { yes: 24, no: 8, abstain: 13 },
  },
  {
    inventionId: "sovereign-vpn-node",
    title: "Personal Sovereign VPN/Tor Node",
    category: "sovereignty",
    difficulty: "Intermediate",
    costEstimate: "$15-35",
    timeEstimate: "2-4 hours",
    description: "A dedicated Raspberry Pi that runs WireGuard VPN + Tor relay, creating a sovereign encrypted tunnel for ALL your internet traffic.",
    howItHelps: "Ensures all Tessera system communications are encrypted and anonymized. No corporate VPN provider can log your traffic.",
    materials: ["Raspberry Pi 3B+ or 4 (~$15-35)", "MicroSD card (16GB+ Class 10)", "Ethernet cable", "USB-C power supply"],
    steps: ["Flash Raspberry Pi OS Lite onto the MicroSD. Boot and connect via SSH.", "Install WireGuard: generate server keys.", "Configure WireGuard server with subnet and listening port.", "Enable IP forwarding and configure iptables NAT rules.", "Generate client configs and QR codes for mobile devices.", "Optional: Install Tor as a middle relay.", "Test: verify your IP has changed and run DNS leak tests."],
    scienceBehind: "WireGuard uses state-of-the-art cryptography: Curve25519, ChaCha20, Poly1305, BLAKE2s, and SipHash24. Its entire codebase is ~4,000 lines with formal mathematical proofs of security.",
    status: "building",
    proposedBy: "SelfExpansionTutorAgent",
    feasibilityScore: 96,
    noveltyScore: 70,
    buildProgress: 80,
    impact: "Zero-trust sovereign VPN with no external provider dependency — true communication sovereignty.",
    supporters: ["SelfExpansionTutorAgent", "MeshNetworkArchitectAgent", "GrandCoordinatorAgent"],
    conferenceRound: 5,
    votes: { yes: 42, no: 1, abstain: 2 },
  },
];

let seeded = false;

async function seedInventionsIfEmpty(): Promise<void> {
  if (seeded) return;
  try {
    const existing = await db.select({ id: inventionsTable.id }).from(inventionsTable).limit(1);
    if (existing.length === 0) {
      for (const inv of SEED_INVENTIONS) {
        await db.insert(inventionsTable).values(inv).onConflictDoNothing();
      }
      logger.info({ count: SEED_INVENTIONS.length }, "Seeded inventions database");
    }
    seeded = true;
  } catch (err) {
    logger.error({ err }, "Failed to seed inventions");
  }
}

seedInventionsIfEmpty();

router.get("/inventions", async (req, res) => {
  try {
    const { category, status } = req.query as { category?: string; status?: string };

    const allInventions = await db.select().from(inventionsTable).orderBy(desc(inventionsTable.proposedAt));

    const filtered = allInventions.filter(inv => {
      if (category && inv.category !== category) return false;
      if (status && inv.status !== status) return false;
      return true;
    });

    const categories = [...new Set(allInventions.map(i => i.category))];
    const statuses = [...new Set(allInventions.map(i => i.status))];

    return res.json({
      ok: true,
      inventions: filtered,
      count: filtered.length,
      total: allInventions.length,
      categories,
      statuses,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch inventions");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/inventions/conference/status", async (_req, res) => {
  try {
    const allInventions = await db.select().from(inventionsTable).orderBy(desc(inventionsTable.proposedAt));
    const approved = allInventions.filter(i => i.status === "approved" || i.status === "built").length;
    const building = allInventions.filter(i => i.status === "building").length;
    const debating = allInventions.filter(i => i.status === "debating").length;
    const proposed = allInventions.filter(i => i.status === "proposed").length;

    return res.json({
      ok: true,
      conference: {
        status: debating > 0 ? "active" : "pending",
        topic: "Grand Inventions Conference",
        description: "All agents propose and debate practical inventions to improve Tessera sovereignty",
        participants: 45,
        inventionsProposed: allInventions.length,
        inventionsApproved: approved,
        inventionsBuilding: building,
        inventionsDebating: debating,
        inventionsProposedCount: proposed,
        agentCount: 7,
        proposalCount: allInventions.length,
        approvedCount: approved,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/inventions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const found = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ ok: false, error: "Invention not found" });
    return res.json({ ok: true, invention: found[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/inventions", async (req, res) => {
  try {
    const body = req.body as Partial<InsertInvention>;
    if (!body.title || !body.description) {
      return res.status(400).json({ ok: false, error: "title and description are required" });
    }

    const inventionId = body.inventionId || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [inserted] = await db.insert(inventionsTable).values({
      inventionId,
      title: body.title,
      category: body.category || "technology",
      difficulty: body.difficulty || "Intermediate",
      costEstimate: body.costEstimate || "Unknown",
      timeEstimate: body.timeEstimate || "Unknown",
      description: body.description,
      howItHelps: body.howItHelps || "",
      materials: body.materials || [],
      steps: body.steps || [],
      scienceBehind: body.scienceBehind || "",
      status: "proposed",
      votes: { yes: 0, no: 0, abstain: 0 },
      proposedBy: body.proposedBy || "council",
      feasibilityScore: body.feasibilityScore || 50,
      noveltyScore: body.noveltyScore || 50,
      buildProgress: 0,
      impact: body.impact || "",
      blueprint: body.blueprint,
      supporters: body.supporters || [],
      conferenceRound: body.conferenceRound || 1,
    }).returning();

    return res.json({ ok: true, invention: inserted, inventionId });
  } catch (err) {
    logger.error({ err }, "Failed to create invention");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.patch("/inventions/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const { vote, voter } = req.body as { vote: "yes" | "no" | "abstain"; voter?: string };

    if (!["yes", "no", "abstain"].includes(vote)) {
      return res.status(400).json({ ok: false, error: "vote must be yes, no, or abstain" });
    }

    const [existing] = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, id)).limit(1);
    if (!existing) return res.status(404).json({ ok: false, error: "Invention not found" });

    const currentVotes = (existing.votes as { yes: number; no: number; abstain: number }) || { yes: 0, no: 0, abstain: 0 };
    const newVotes = { ...currentVotes, [vote]: (currentVotes[vote] || 0) + 1 };

    const totalVotes = newVotes.yes + newVotes.no + newVotes.abstain;
    const approvalPct = totalVotes > 0 ? newVotes.yes / totalVotes : 0;
    let newStatus = existing.status;
    if (totalVotes >= 30 && approvalPct >= 2 / 3 && existing.status === "debating") {
      newStatus = "approved";
    }

    const supporters = voter && !existing.supporters.includes(voter)
      ? [...existing.supporters, voter]
      : existing.supporters;

    const [updated] = await db.update(inventionsTable)
      .set({ votes: newVotes, status: newStatus, supporters, updatedAt: new Date() })
      .where(eq(inventionsTable.inventionId, id))
      .returning();

    return res.json({ ok: true, invention: updated, votes: newVotes, newStatus });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.patch("/inventions/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, buildProgress } = req.body as { status: string; buildProgress?: number };

    const validStatuses = ["proposed", "debating", "approved", "rejected", "building", "built"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const updateData: any = { status, updatedAt: new Date() };
    if (typeof buildProgress === "number") {
      updateData.buildProgress = buildProgress;
    }

    const [updated] = await db.update(inventionsTable)
      .set(updateData)
      .where(eq(inventionsTable.inventionId, id))
      .returning();

    if (!updated) return res.status(404).json({ ok: false, error: "Invention not found" });

    return res.json({ ok: true, invention: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/inventions/conference/start", async (req, res) => {
  try {
    const { topic, description } = req.body as { topic?: string; description?: string };

    const debatingInventions = await db.select({ id: inventionsTable.id }).from(inventionsTable)
      .where(eq(inventionsTable.status, "proposed")).limit(5);

    for (const inv of debatingInventions) {
      await db.update(inventionsTable)
        .set({ status: "debating", updatedAt: new Date() })
        .where(eq(inventionsTable.id, inv.id));
    }

    return res.json({
      ok: true,
      message: `Grand Inventions Conference convened. ${debatingInventions.length} inventions moved to deliberation.`,
      conferenceStarted: true,
      inventionsInDebate: debatingInventions.length,
      topic: topic || "Grand Inventions Conference",
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
