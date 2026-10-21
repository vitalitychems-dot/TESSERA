// server.js
const express = require('express');
const bodyParser = require('body-parser');
const agents = require('./agents.json'); // JSON file with agent skills
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Mock function for market trends and user feedback
function getMarketTrends() {
    return ['Web Development', 'Data Analysis', 'Digital Marketing', 'AI Development'];
}

// Function to validate skills
function validateSkill(skill) {
    const validSkills = getMarketTrends();
    return validSkills.includes(skill);
}

// Function to pair agents based on complementary skills
function pairAgents(skill) {
    return agents.filter(agent => agent.skills.includes(skill) && agent.status === 'available');
}

// Endpoint to pair agents based on skills
app.post('/pair_agents', (req, res) => {
    const { skill } = req.body;

    if (!validateSkill(skill)) {
        return res.status(400).json({ message: 'Invalid skill provided.' });
    }

    const pairedAgents = pairAgents(skill);
    
    if (pairedAgents.length === 0) {
        return res.status(404).json({ message: 'No available agents found for this skill.' });
    }

    res.json({ pairedAgents });
});

// Endpoint to register a new agent
app.post('/register_agent', (req, res) => {
    const { name, skills, email } = req.body;

    // Validate incoming data
    if (!name || !Array.isArray(skills) || !email) {
        return res.status(400).json({ message: 'Invalid registration data.' });
    }

    // Generate unique ID for the agent
    const agentId = crypto.randomBytes(16).toString('hex');

    // Example data structure for a new agent
    const newAgent = {
        id: agentId,
        name,
        skills,
        email,
        status: 'available'
    };

    // Here you should save newAgent to your database or agents array
    agents.push(newAgent); // This is just a mock; replace with actual DB saving logic.

    res.status(201).json({ message: 'Agent registered successfully.', agentId });
});

// Start the express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
