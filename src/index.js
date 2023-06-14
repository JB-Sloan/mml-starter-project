const fs = require("fs");
const path = require("path");
const url = require("url");
const chokidar = require("chokidar");
const express = require("express");
const enableWs = require("express-ws");

const { LocalObservableDomFactory, EditableNetworkedDOM } = require("networked-dom-server");

// Set up server port
const port = process.env.PORT || 8080;

// Resolve file path for DOM HTML
const filePath = path.resolve(__dirname, "./mml-document.html");

// Function to read DOM file contents
const getDomFileContents = () => fs.readFileSync(filePath, "utf8");

// Function to get WebSocket URL
const getWebsocketUrl = (req) =>
  `${req.secure ? "wss" : "ws"}://${
    req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-host"]}:${req.headers["x-forwarded-port"]}`
      : req.headers.host
  }`;

// Initialize EditableNetworkedDOM
const document = new EditableNetworkedDOM(
  url.pathToFileURL(filePath).toString(),
  LocalObservableDomFactory,
);
document.load(getDomFileContents());

// Watch for changes in the DOM file and reload
chokidar.watch(filePath).on("change", () => {
  document.load(getDomFileContents());
});

// Enable WebSocket on Express app
const { app } = enableWs(express());
app.enable("trust proxy");

// Handle document client connections
app.ws("/", (ws) => {
  document.addWebSocket(ws);
  ws.on("close", () => {
    document.removeWebSocket(ws);
  });
});

// Serve page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <script src="/client/index.js?websocketUrl=${getWebsocketUrl(req)}"></script>
      <script src="/overlay/index.js"></script>
    </html>
`);
});

// Serve mml-web-client
app.use(
  "/client/",
  express.static(path.resolve(__dirname, "../node_modules/mml-web-client/build/")),
);

// Serve starter project overlay UI
app.use(
  "/overlay/",
  express.static(
    path.resolve(__dirname, "../node_modules/@mml-io/mml-starter-project-overlay/dist/"),
  ),
);

// Start listening on specified port
console.log("Listening on port", port);
app.listen(port);
