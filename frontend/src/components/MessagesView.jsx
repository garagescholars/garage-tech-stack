import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // <--- FIXED PATH (Two dots)
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Send, User, ShoppingBag, Circle } from 'lucide-react';

export default function MessagesView() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState([]);

  // 1. FETCH CONVERSATIONS
  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("lastUpdated", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConversations(convos);
    });
    return () => unsubscribe();
  }, []);

  // 2. FETCH MESSAGES for Active Chat
  useEffect(() => {
    if (!activeChat) return;

    const q = query(
        collection(db, `conversations/${activeChat.id}/messages`), 
        orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeChat]);

  // --- HANDLE CLICK (MARK READ) ---
  const handleSelectChat = async (chat) => {
      setActiveChat(chat);
      
      // If it is marked unread, remove the flag in the database
      if (chat.isUnread) {
          try {
              const chatRef = doc(db, "conversations", chat.id);
              await updateDoc(chatRef, { isUnread: false });
          } catch (error) {
              console.error("Error marking read:", error);
          }
      }
  };

  // 3. SEND MESSAGE
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
        await addDoc(collection(db, `conversations/${activeChat.id}/messages`), {
            text: newMessage,
            sender: 'owner',
            createdAt: serverTimestamp()
        });
        
        // Update parent thread to show new activity
        const chatRef = doc(db, "conversations", activeChat.id);
        await updateDoc(chatRef, { 
            lastMessage: `You: ${newMessage}`,
            lastUpdated: serverTimestamp(),
            isUnread: false // Ensure it stays read if you reply
        });
        
        setNewMessage('');
    } catch (error) {
        console.error("Error sending:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
      
      {/* LEFT: CONVERSATION LIST */}
      <div className={`${activeChat ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-r border-slate-800 bg-slate-950`}>
        <div className="p-4 border-b border-slate-800 font-bold text-white flex justify-between items-center">
            <span>Inbox</span>
            {/* Tiny badge showing total unread in list */}
            <span className="text-xs text-slate-500">
                {conversations.filter(c => c.isUnread).length} Unread
            </span>
        </div>
        <div className="overflow-y-auto h-full">
            {conversations.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No messages yet.</div>
            ) : (
                conversations.map(chat => (
                    <div 
                        key={chat.id} 
                        onClick={() => handleSelectChat(chat)}
                        className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors relative ${activeChat?.id === chat.id ? 'bg-slate-900 border-l-2 border-l-teal-500' : ''}`}
                    >
                        {/* UNREAD DOT INDICATOR */}
                        {chat.isUnread && (
                            <div className="absolute right-4 top-4">
                                <Circle size={10} className="fill-teal-500 text-teal-500" />
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-1 pr-4">
                            <span className={`text-sm ${chat.isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                                {chat.buyerName || 'Unknown Buyer'}
                            </span>
                            <span className="text-xs text-slate-500">{chat.platform}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <ShoppingBag size={12} />
                            <span className="truncate">{chat.itemTitle}</span>
                        </div>
                        <p className={`text-sm truncate ${chat.isUnread ? 'text-white' : 'text-slate-500'}`}>
                            {chat.lastMessage}
                        </p>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* RIGHT: CHAT WINDOW */}
      <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-2/3 flex-col bg-slate-900`}>
        {activeChat ? (
            <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                    <div>
                        <h3 className="font-bold text-white">{activeChat.buyerName}</h3>
                        <p className="text-xs text-teal-400">{activeChat.itemTitle}</p>
                    </div>
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-sm text-slate-400">Back</button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] p-3 rounded-lg text-sm ${
                                msg.sender === 'owner' 
                                ? 'bg-teal-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 rounded-bl-none'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-teal-500 outline-none"
                        placeholder="Type a reply..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-slate-900 p-2 rounded-lg">
                        <Send size={20} />
                    </button>
                </form>
            </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
                Select a conversation to start chatting
            </div>
        )}
      </div>
    </div>
  );
}