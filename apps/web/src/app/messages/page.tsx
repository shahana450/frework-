"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, Send, Paperclip, Smile, MoreVertical, Phone, Video, Check, CheckCheck } from "lucide-react";

const CONVERSATIONS = [
  { id: "1", name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80", lastMessage: "Thanks! I'll send the revised mockups by EOD", time: "2m ago", unread: 2, online: true },
  { id: "2", name: "Groww FinTech", avatar: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=80", lastMessage: "We've reviewed your proposal — looks great!", time: "1h ago", unread: 0, online: false },
  { id: "3", name: "Carlos Rodriguez", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80", lastMessage: "Can we schedule a call tomorrow at 3pm IST?", time: "3h ago", unread: 1, online: true },
  { id: "4", name: "WeWork Cyber City", avatar: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=80", lastMessage: "Your booking for Thursday has been confirmed", time: "1d ago", unread: 0, online: false },
  { id: "5", name: "Ravi Patel", avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=80", lastMessage: "The API integration is complete. Testing in staging...", time: "2d ago", unread: 0, online: false },
];

const MESSAGES = [
  { id: "1", from: "them", text: "Hi! I saw your profile and I'm impressed with your React expertise. We're building a FinTech app and need help.", time: "10:32 AM", read: true },
  { id: "2", from: "me", text: "Thank you! I'd love to learn more about the project. What's the scope and expected timeline?", time: "10:35 AM", read: true },
  { id: "3", from: "them", text: "We need a dashboard with real-time charts, payment flows, and user management. About 3 months of work.", time: "10:38 AM", read: true },
  { id: "4", from: "me", text: "That sounds right up my alley! I've built similar platforms for 3 FinTech companies. I can share relevant portfolio items. My rate is $120/hr or we can discuss a fixed-price arrangement.", time: "10:42 AM", read: true },
  { id: "5", from: "them", text: "Great! Fixed price works better for us. Can you send a proposal? We're looking at a ₹8-10L budget.", time: "10:45 AM", read: true },
  { id: "6", from: "me", text: "Absolutely, I'll prepare a detailed proposal with milestones by tomorrow morning. In the meantime, can you share any wireframes or PRD you have?", time: "10:48 AM", read: true },
  { id: "7", from: "them", text: "Thanks! I'll send the revised mockups by EOD", time: "11:02 AM", read: false },
];

export default function MessagesPage() {
  const [active, setActive] = useState("1");
  const [input, setInput] = useState("");
  const activeConv = CONVERSATIONS.find(c => c.id === active)!;

  return (
    <PageLayout>
      <div className="container py-6 h-[calc(100vh-8rem)]">
        <div className="h-full flex bg-card border border-border rounded-2xl overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-border flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold text-lg mb-3">Messages</h2>
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 h-9">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input placeholder="Search conversations..." className="flex-1 bg-transparent outline-none text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {CONVERSATIONS.map(conv => (
                <button key={conv.id} onClick={() => setActive(conv.id)} className={`w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors text-left ${active === conv.id ? "bg-accent" : ""}`}>
                  <div className="relative shrink-0">
                    <img src={conv.avatar} alt={conv.name} className="w-11 h-11 rounded-full object-cover" />
                    {conv.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm truncate">{conv.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{conv.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && <span className="w-5 h-5 bg-primary rounded-full text-primary-foreground text-xs flex items-center justify-center shrink-0">{conv.unread}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="relative">
                <img src={activeConv.avatar} alt={activeConv.name} className="w-10 h-10 rounded-full object-cover" />
                {activeConv.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{activeConv.name}</p>
                <p className="text-xs text-green-500">{activeConv.online ? "Active now" : "Last seen 2h ago"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-accent transition-colors"><Phone className="w-4 h-4" /></button>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors"><Video className="w-4 h-4" /></button>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {MESSAGES.map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                  {msg.from === "them" && <img src={activeConv.avatar} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto shrink-0" />}
                  <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${msg.from === "me" ? "bg-gradient-to-r from-brand-500 to-purple-600 text-white rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                    {msg.text}
                    <div className={`flex items-center justify-end gap-1 mt-1 ${msg.from === "me" ? "text-white/70" : "text-muted-foreground"} text-xs`}>
                      {msg.time}
                      {msg.from === "me" && (msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-end gap-3 bg-muted rounded-2xl px-4 py-3">
                <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5"><Paperclip className="w-5 h-5" /></button>
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." rows={1} className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32" />
                <button className="text-muted-foreground hover:text-foreground transition-colors pb-0.5"><Smile className="w-5 h-5" /></button>
                <button className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${input ? "bg-gradient-to-r from-brand-500 to-purple-600 text-white" : "bg-border text-muted-foreground"}`}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
