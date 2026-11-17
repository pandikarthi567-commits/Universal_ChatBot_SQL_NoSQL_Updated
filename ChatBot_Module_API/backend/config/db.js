const dns = require("dns");
const mongoose = require("mongoose");

// Fix Windows SRV lookup issue by prioritizing public DNS (Google & Cloudflare)
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (e) {
  // Ignore fallback
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI environment variable is not defined!");
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    if (error.message.includes("querySrv")) {
      console.warn("💡 Tip: Try using Google DNS (8.8.8.8) or standard non-SRV connection string.");
    } else if (error.message.includes("bad auth") || error.message.includes("authentication failed")) {
      console.warn("💡 Tip: Please check your MongoDB Atlas Database User password in backend/.env");
    }
  }
};

module.exports = connectDB;
