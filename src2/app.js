//basic app to test
const express = require("express");
const { hppGuard } = require("./index");

const app = express();

// Body parsers (needed for req.body)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use your HPP middleware
app.use(
  hppGuard({
    mode: "reject",        // try "first" or "last" later
    checkBody: true,
    allowlist: ["id"],   // optional
    onPollution: (report, req) => {
      console.log("HPP detected:", report, "on", req.method, req.originalUrl);
    },
  })
);

// Test routes
app.get("/test", (req, res) => {
  res.json({ query: req.query, body: req.body });
});

app.post("/test", (req, res) => {
  res.json({ query: req.query, body: req.body });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
