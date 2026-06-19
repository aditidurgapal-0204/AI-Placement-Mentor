const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

// 🔐 POST /api/ai/generate-analysis - Secure production pipeline mapping
router.post('/generate-analysis', authMiddleware, aiController.generateAnalysis);

// 🛠️ GET /api/ai/test-gemini - Isolated infrastructure diagnostics gate
router.get('/test-gemini', aiController.testGeminiConnection);

module.exports = router;