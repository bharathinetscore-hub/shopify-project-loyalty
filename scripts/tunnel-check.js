const https = require("https");

const TUNNEL_URL = process.env.SHOPIFY_APP_URL;

function checkTunnel() {
  if (!TUNNEL_URL) {
    console.log("❌ No tunnel URL found");
    return;
  }

  https
    .get(TUNNEL_URL, (res) => {
      console.log(`✅ Tunnel alive: ${res.statusCode} @ ${new Date().toISOString()}`);
    })
    .on("error", () => {
      console.log(`❌ Tunnel DEAD @ ${new Date().toISOString()}`);
    });
}

// check every 3 seconds
setInterval(checkTunnel, 3000);