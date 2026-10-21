import { setTimeout } from 'timers/promises';

interface Request {
    prompt: string;
    id: string;
}

class RequestBatcher {
    private requestMap: Map<string, Request[]> = new Map();
    private sensitivityKeywords: string[] = ['private key', 'credential', 'password'];
    private cacheHitCount: number = 0;
    private cacheMissCount: number = 0;

    constructor(private batchInterval: number = 60000) {
        this.startBatching();
    }

    private async startBatching() {
        while (true) {
            await setTimeout(this.batchInterval);
            this.processBatch();
        }
    }

    public addRequest(id: string, prompt: string) {
        if (this.isSensitive(prompt)) {
            // Directly process sensitive requests
            this.processRequest({ prompt, id });
            return;
        }

        const key = this.getDeduplicationKey(prompt);
        if (!this.requestMap.has(key)) {
            this.requestMap.set(key, []);
        }
        
        this.requestMap.get(key)?.push({ prompt, id });
    }

    private isSensitive(prompt: string): boolean {
        return this.sensitivityKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
    }

    private getDeduplicationKey(prompt: string): string {
        return prompt.trim().toLowerCase();
    }

    private async processBatch() {
        if (this.requestMap.size === 0) return;

        const batchRequests: Request[] = [];
        this.requestMap.forEach(requests => {
            batchRequests.push(...requests);
            this.cacheHitCount += requests.length; // Consider all requests as cache hits for batching
        });

        // Clear the request map after processing
        this.requestMap.clear();

        // Here you would normally send the batched request to the LLM
        // For demonstration, we will log the batched requests
        console.log('Sending batched requests:', batchRequests);

        // Simulate the batching process
        await this.simulateSendingRequests(batchRequests);
    }

    private async simulateSendingRequests(requests: Request[]) {
        // Simulate request processing delay
        await setTimeout(1000); // Simulate network delay
        console.log('Processed requests:', requests);
    }

    public getCacheHitRate(): number {
        const totalRequests = this.cacheHitCount + this.cacheMissCount;
        return totalRequests === 0 ? 0 : (this.cacheHitCount / totalRequests) * 100;
    }

    public logCacheMiss() {
        this.cacheMissCount++;
    }
}

// Usage example:
const requestBatcher = new RequestBatcher();

// Mock adding requests
requestBatcher.addRequest('1', 'What is the weather today?');
requestBatcher.addRequest('2', 'What is the weather today?');
requestBatcher.addRequest('3', 'private key: ABCD1234');
requestBatcher.logCacheMiss(); // Log the cache miss for demonstration
