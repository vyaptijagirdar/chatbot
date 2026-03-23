import { useState, useEffect, useRef } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [showStop, setShowStop] = useState(false);

  const bottomRef = useRef();
  const stopRef = useRef(false);
  const recognitionRef = useRef(null); // ✅ FIX

  // 🎤 INIT ONLY ONCE
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript;
      sendMessage(transcript);
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };

    recognitionRef.current = recognition;
  }, [isListening]);

  const startListening = () => {
    setIsListening(true);
    recognitionRef.current?.start();
  };

  const stopListening = () => {
    setIsListening(false);
    recognitionRef.current?.stop();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return;

    fetch("http://localhost:5000/chats", {
      headers: { Authorization: token }
    })
      .then(res => res.json())
      .then(setChats);
  }, [token]);

  // ✨ Typing + images
  const streamMessage = (text, images = []) => {
    stopRef.current = false;

    let i = 0;
    let current = "";
    const words = text.split(" ");

    const interval = setInterval(() => {
      if (stopRef.current) {
        clearInterval(interval);
        return;
      }

      if (i < words.length) {
        current += words[i] + " ";
        i++;

        setMessages(prev => [
          ...prev.slice(0, -1),
          { text: current, sender: "bot", typing: true }
        ]);
      } else {
        clearInterval(interval);

        setMessages(prev => [
          ...prev.slice(0, -1),
          { text: current, sender: "bot", images }
        ]);
      }
    }, 25);
  };

  const stopResponse = () => {
    stopRef.current = true;
  };

  const sendMessage = async (voiceText) => {
    const finalInput = voiceText || input;
    if (!finalInput.trim()) return;

    setShowStop(true);

    const updated = [
      ...messages,
      { text: finalInput, sender: "user" },
      { text: "Thinking...", sender: "bot", typing: true }
    ];

    setMessages(updated);
    setInput("");

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token
        },
        body: JSON.stringify({
          message: finalInput,
          chatId: currentChatId
        })
      });

      const data = await res.json();

      setCurrentChatId(data.chatId);

      streamMessage(data.reply, data.images || []);

      const updatedChats = await fetch("http://localhost:5000/chats", {
        headers: { Authorization: token }
      }).then(r => r.json());

      setChats(updatedChats);

    } catch (err) {
      console.error(err);
    }
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat._id);

    setMessages(
      chat.messages.map(m => ({
        text: m.content,
        sender: m.role === "user" ? "user" : "bot"
      }))
    );
  };

  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowStop(false);
  };

  const renameChat = async (id) => {
    const title = prompt("Rename chat:");
    if (!title) return;

    await fetch(`http://localhost:5000/chat/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({ title })
    });

    setChats(prev =>
      prev.map(c => (c._id === id ? { ...c, title } : c))
    );
  };

  const deleteChat = async (id) => {
    await fetch(`http://localhost:5000/chat/${id}`, {
      method: "DELETE",
      headers: { Authorization: token }
    });

    setChats(prev => prev.filter(c => c._id !== id));

    if (currentChatId === id) {
      setMessages([]);
      setCurrentChatId(null);
      setShowStop(false);
    }
  };

  const login = async () => {
    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!data.token) return alert("Login failed");

    setToken(data.token);
    setIsLoggedIn(true);
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-green-100">
        <div className="bg-white/60 backdrop-blur p-8 rounded-2xl shadow space-y-3">
          <h1 className="text-xl text-pink-500 text-center">Vyapti AI 💅</h1>
          <input placeholder="Email" onChange={e=>setEmail(e.target.value)} className="p-2 border w-64 rounded"/>
          <input type="password" onChange={e=>setPassword(e.target.value)} className="p-2 border w-64 rounded"/>
          <button onClick={login} className="bg-pink-400 text-white w-full p-2 rounded">Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-pink-50 to-green-50">

      {/* SIDEBAR */}
      <div className="w-64 bg-white/70 backdrop-blur p-4 flex flex-col border-r">
        <button onClick={newChat} className="bg-pink-400 text-white p-2 rounded mb-4">
          + New Chat
        </button>

        <div className="flex-1 overflow-y-auto space-y-2">
          {chats.map(chat => (
            <div key={chat._id}
              className={`p-2 rounded-xl flex justify-between ${
                currentChatId === chat._id ? "bg-green-200" : "hover:bg-pink-100"
              }`}>
              <span onClick={()=>loadChat(chat)} className="cursor-pointer text-sm">
                {chat.title || "New Chat"}
              </span>
              <div className="flex gap-2 text-xs">
                <button onClick={()=>renameChat(chat._id)}>✏️</button>
                <button onClick={()=>deleteChat(chat._id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col">

        <div className="p-4 text-pink-500 font-semibold text-lg">
          Vyapti AI ✨ {isListening && "🎤 Listening..."}
        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m,i)=>(
            <div key={i} className={`flex ${m.sender==="user"?"justify-end":"justify-start"}`}>
              <div className={`p-3 rounded-2xl max-w-lg ${
                m.sender==="user"
                ? "bg-green-300"
                : "bg-white/80 backdrop-blur"
              } ${m.typing ? "animate-pulse" : ""}`}>

                {m.text}

                {/* 🖼️ PINTEREST GRID */}
                {m.images && m.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {m.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="result"
                        className="rounded-lg object-cover h-32 w-full hover:scale-105 transition"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                )}

              </div>
            </div>
          ))}
          <div ref={bottomRef}></div>
        </div>

        {/* INPUT */}
        <div className="p-4 flex justify-center">
          <div className="flex w-full max-w-3xl bg-white/70 backdrop-blur rounded-2xl shadow">

            <button
              onClick={isListening ? stopListening : startListening}
              className="bg-green-300 px-3 rounded-l-2xl"
            >
              🎤
            </button>

            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              className="flex-1 p-3 bg-transparent outline-none"
              placeholder="Type or speak..."
            />

            <button onClick={() => sendMessage()} className="bg-pink-400 text-white px-5">
              Send
            </button>

            {showStop && (
              <button
                onClick={stopResponse}
                className="bg-red-400 text-white px-4 rounded-r-2xl"
              >
                Stop
              </button>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default App;