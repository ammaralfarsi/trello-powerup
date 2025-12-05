const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// --- GOOGLE CONTACTS AUTH ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT,
  process.env.GOOGLE_SECRET,
  process.env.REDIRECT_URL
);

let googleTokens = null;

app.get("/oauth/init", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/contacts.readonly"]
  });
  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  googleTokens = tokens;
  res.send("Google Contacts connected. You can close this tab.");
});

app.get("/contacts", async (req, res) => {
  if (!googleTokens) return res.status(401).json({ error: "Google not connected" });

  oauth2Client.setCredentials(googleTokens);

  const people = google.people({ version: "v1", auth: oauth2Client });

  const result = await people.people.connections.list({
    resourceName: "people/me",
    personFields: "names,phoneNumbers"
  });

  const contacts = result.data.connections?.map(c => ({
    name: c.names?.[0]?.displayName || "",
    phone: c.phoneNumbers?.[0]?.value || ""
  })) || [];

  res.json(contacts);
});

app.post("/sendReminder", async (req, res) => {
  const { phone, message } = req.body;
  const chatId = phone.replace(/\D+/g, "") + "@c.us";

  try {
    await axios.post(
      `${process.env.WAHA_URL}/api/sendText`,
      {
        session: "default",
        chatId,
        text: message
      },
      {
        headers: { "X-Api-Key": process.env.WAHA_KEY }
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(3005, () => console.log("Power-Up running on port 3005"));
