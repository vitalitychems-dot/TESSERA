const MODULE_TAG = '[SwarmRouter]';
const DEFAULT_TIMEOUT_MS = 5000;

interface DataPacket {
    id: string;
    payload: unknown;
    timestamp: number;
}

interface SwarmRouterStatus {
    isInitialized: boolean;
    packetsProcessed: number;
    lastProcessedPacketId: string | null;
}

class SwarmRouter {
    private status: SwarmRouterStatus;
    private packetQueue: DataPacket[];

    constructor() {
        this.status = {
            isInitialized: false,
            packetsProcessed: 0,
            lastProcessedPacketId: null,
        };
        this.packetQueue = [];
        this.initialize();
    }

    private initialize(): void {
        console.log(`${MODULE_TAG} Initializing Swarm Router...`);
        // Additional setup logic can be added here
        this.status.isInitialized = true;
        console.log(`${MODULE_TAG} Initialization complete.`);
    }

    public addPacket(packet: DataPacket): void {
        if (!this.status.isInitialized) {
            throw new Error('SwarmRouter is not initialized.');
        }
        this.packetQueue.push(packet);
        console.log(`${MODULE_TAG} Packet added: ${packet.id}`);
    }

    public processPackets(): void {
        if (!this.status.isInitialized) {
            throw new Error('SwarmRouter is not initialized.');
        }
        while (this.packetQueue.length > 0) {
            const packet = this.packetQueue.shift();
            if (packet) {
                this.status.packetsProcessed++;
                this.status.lastProcessedPacketId = packet.id;
                console.log(`${MODULE_TAG} Processing packet: ${packet.id}`);
                // Simulate processing time
                this.simulateProcessing();
            }
        }
    }

    private simulateProcessing(): void {
        // Simulate a processing delay
        const timeout = new Promise(resolve => setTimeout(resolve, DEFAULT_TIMEOUT_MS));
        timeout.then(() => console.log(`${MODULE_TAG} Packet processing complete.`));
    }

    public getStatus(): SwarmRouterStatus {
        return this.status;
    }
}

const swarmRouter = new SwarmRouter();

export const addPacket = (packet: DataPacket) => {
    swarmRouter.addPacket(packet);
};

export const processPackets = () => {
    swarmRouter.processPackets();
};

export const getRouterStatus = () => {
    return swarmRouter.getStatus();
};