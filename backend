import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// DB
mongoose.connect("mongodb://127.0.0.1:27017/chatbot");

// MODELS
const User = mongoose.model("User", {
  email: String,
  password: String,
  memory: Object
});

const Chat = mongoose.model("Chat", {
  userId: String,
  messages: Array,
  title: String
});

// AUTH
const verify = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json("No token");

  try {
    req.user = jwt.verify(token, "secret");
    next();
  } catch {
    res.status(401).json("Invalid token");
  }
};

// LOGIN
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.json({ error: "User not found" });

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.json({ error: "Wrong password" });

  const token = jwt.sign({ id: user._id }, "secret");
  res.json({ token });
});

// GET CHATS
app.get("/chats", verify, async (req, res) => {
  const chats = await Chat.find({ userId: req.user.id });
  res.json(chats);
});

// 🌐 SEARCH
const searchWeb = async (query) => {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    );
    const data = await res.json();

    return data.AbstractText || "No exact result found.";
  } catch {
    return null;
  }
};

// 🖼️ REAL IMAGE SEARCH (UNSPLASH)
const searchImages = async (query) => {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_KEY}`
        }
      }
    );

    const data = await res.json();

    return data.results.map(img => img.urls.small);
  } catch {
    return [];
  }
};

// 🤖 CHAT
app.post("/chat", verify, async (req, res) => {
  try {
    const { message, chatId } = req.body;

    let chat = chatId ? await Chat.findById(chatId) : null;

    if (!chat) {
      chat = await Chat.create({
        userId: req.user.id,
        messages: [],
        title: message.slice(0, 20)
      });
    }

    let images = await searchImages(message);
    let webData = await searchWeb(message);

    chat.messages.push({ role: "user", content: message });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
Answer like ChatGPT + Google.

Use this info:
${webData}
`
          },
          ...chat.messages
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content || webData || "No response";

    chat.messages.push({ role: "assistant", content: reply });

    await chat.save();

    res.json({
      reply,
      chatId: chat._id,
      images
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Error: " + err.message });
  }
});

app.listen(5000, () => console.log("🚀 Server running"));
