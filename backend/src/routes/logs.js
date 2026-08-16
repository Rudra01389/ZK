const express = require("express");
const { logEmitter } = require("../services/pythonBridge");

const router = express.Router();

router.get("/", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Send initial connected ping
  res.write(`data: ${JSON.stringify("[SYSTEM] Connected to Live Computation Logger...")}\n\n`);

  const onLog = (chunk) => {
    // We send chunk string exactly, frontend will split by newlines if needed
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  logEmitter.on("log", onLog);

  req.on("close", () => {
    logEmitter.off("log", onLog);
  });
});

module.exports = router;
