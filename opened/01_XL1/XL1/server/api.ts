// Added request batching functionality

const BATCH_SIZE = 5;

async function batchRequests(requests) {
    const batchedRequests = [];
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        const batch = requests.slice(i, i + BATCH_SIZE);
        batchedRequests.push(await sendBatchToAPI(batch));
    }
    return Promise.all(batchedRequests);
}

async function sendBatchToAPI(batch) {
    // Assuming there’s a function to handle sending a batch of requests
    return await axios.post('/api/llm-batch', { requests: batch });
}

app.post('/api/llm', async (req, res) => {
    const { requests } = req.body;
    if (Array.isArray(requests) && requests.length > 0) {
        const results = await batchRequests(requests);
        res.json(results);
    } else {
        res.status(400).send('Invalid requests');
    }
});
