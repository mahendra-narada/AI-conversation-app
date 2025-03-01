import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MessageSquare, 
  RefreshCw, 
  Sun, 
  Moon, 
  Volume2, 
  History, 
  CheckCircle2, 
  XCircle,
  StopCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { generateResponse, generateInitialQuestion, GeminiResponse } from './geminiService';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  suggestion?: string;
  feedback?: {
    corrected: string;
    explanation: string;
  };
};

// Fallback responses in case the API is unavailable
const fallbackResponses = {
  "travel": [
    "What's your favorite place you've traveled to so far?",
    "Have you ever experienced culture shock while traveling?",
    "What's one place you'd love to visit in the future?",
    "Do you prefer traveling alone or with others?",
    "What's the most interesting food you've tried while traveling?"
  ],
  "technology": [
    "How do you think technology has changed our daily lives?",
    "What's your favorite piece of technology that you use every day?",
    "Do you think artificial intelligence will have a positive impact on society?",
    "How do you stay up-to-date with new technology trends?",
    "What technological innovation are you most excited about?"
  ],
  "food": [
    "What's your favorite cuisine and why do you enjoy it?",
    "Have you ever tried cooking a dish from another culture?",
    "What's the most unusual food you've ever eaten?",
    "Do you prefer eating at home or at restaurants?",
    "If you could only eat one meal for the rest of your life, what would it be?"
  ],
  "movies": [
    "What genre of movies do you enjoy the most?",
    "Who is your favorite actor or actress?",
    "What was the last movie you watched that really impressed you?",
    "Do you prefer watching movies at home or in theaters?",
    "Has a movie ever changed your perspective on something important?"
  ],
  "music": [
    "What kind of music do you listen to most often?",
    "Do you play any musical instruments?",
    "How has your taste in music changed over time?",
    "What's your favorite song right now?",
    "Have you ever been to a live concert? How was the experience?"
  ]
};

// Fallback suggested responses
const fallbackSuggestions = [
  "I think... because of my personal experience with...",
  "In my opinion, the most important aspect is...",
  "I've always been interested in this because...",
  "I'm not entirely sure, but I believe that...",
  "From my perspective, I would say that...",
  "Based on what I've learned, I think that..."
];

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [topic, setTopic] = useState('');
  const [conversationStarted, setConversationStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recordedText, setRecordedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pastConversations, setPastConversations] = useState<{topic: string, date: string}[]>([
    { topic: "Travel to Japan", date: "Yesterday" },
    { topic: "Technology trends", date: "2 days ago" },
    { topic: "Cooking recipes", date: "Last week" }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech synthesis
  useEffect(() => {
    speechSynthesisRef.current = new SpeechSynthesisUtterance();
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setRecordedText(transcript);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const getTopicKey = (userTopic: string): string => {
    const lowerTopic = userTopic.toLowerCase();
    if (lowerTopic.includes('travel')) return 'travel';
    if (lowerTopic.includes('tech')) return 'technology';
    if (lowerTopic.includes('food') || lowerTopic.includes('cook')) return 'food';
    if (lowerTopic.includes('movie') || lowerTopic.includes('film')) return 'movies';
    if (lowerTopic.includes('music') || lowerTopic.includes('song')) return 'music';
    return 'default';
  };

  const getFallbackQuestion = (userTopic: string): string => {
    const topicKey = getTopicKey(userTopic);
    if (topicKey !== 'default' && fallbackResponses[topicKey as keyof typeof fallbackResponses]) {
      const responses = fallbackResponses[topicKey as keyof typeof fallbackResponses];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    return `Let's talk about ${userTopic}. What aspects of ${userTopic} are you most interested in?`;
  };

  const getFallbackSuggestion = (): string => {
    return fallbackSuggestions[Math.floor(Math.random() * fallbackSuggestions.length)];
  };

  const startConversation = async () => {
    if (!topic.trim()) return;
    
    setConversationStarted(true);
    setIsLoading(true);
    
    try {
      // Generate initial question using Gemini AI
      const initialResponse = await generateInitialQuestion(topic);
      
      const initialMessage: Message = {
        id: Date.now().toString(),
        text: initialResponse.message,
        sender: 'ai',
        suggestion: initialResponse.suggestion
      };
      
      setMessages([initialMessage]);
      speakText(initialMessage.text);
    } catch (error) {
      console.error("Error starting conversation:", error);
      
      // Fallback to predefined responses if Gemini API fails
      const fallbackQuestion = getFallbackQuestion(topic);
      const initialMessage: Message = {
        id: Date.now().toString(),
        text: `Hi there! I'd love to chat about ${topic}. ${fallbackQuestion}`,
        sender: 'ai',
        suggestion: getFallbackSuggestion()
      };
      
      setMessages([initialMessage]);
      speakText(initialMessage.text);
    } finally {
      setIsLoading(false);
    }
  };

  const restartConversation = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    // Save current conversation to history
    if (messages.length > 0 && topic) {
      setPastConversations([
        { topic, date: 'Just now' },
        ...pastConversations
      ]);
    }
    
    setConversationStarted(false);
    setMessages([]);
    setTopic('');
    setRecordedText('');
  };

  const handleSendVoiceMessage = async () => {
    if (!recordedText.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: recordedText,
      sender: 'user'
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setRecordedText('');
    setIsLoading(true);
    
    try {
      // Convert messages to the format expected by the Gemini service
      const conversationHistory = messages.map(msg => ({
        role: msg.sender,
        text: msg.text
      }));
      
      // Generate AI response using Gemini
      const geminiResponse = await generateResponse(topic, conversationHistory, userMessage.text);
      
      // Add AI response with feedback and suggestion
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: geminiResponse.message,
        sender: 'ai',
        suggestion: geminiResponse.suggestion,
        feedback: geminiResponse.feedback || undefined
      };
      
      setMessages(prevMessages => [...prevMessages, aiMessage]);
      speakText(aiMessage.text);
    } catch (error) {
      console.error("Error generating response:", error);
      
      // Fallback response if Gemini API fails
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: "Thank you for sharing that. Could you tell me more about your thoughts on this topic?",
        sender: 'ai',
        suggestion: getFallbackSuggestion()
      };
      
      setMessages(prevMessages => [...prevMessages, aiMessage]);
      speakText(aiMessage.text);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    setIsListening(true);
    setRecordedText('');
    
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    setIsListening(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (recordedText) {
      handleSendVoiceMessage();
    }
  };

  const speakText = (text: string) => {
    if (!speechSynthesisRef.current) return;
    
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    speechSynthesisRef.current.text = text;
    speechSynthesis.speak(speechSynthesisRef.current);
  };

  const useSuggestion = (suggestion: string) => {
    setRecordedText(suggestion);
    setIsListening(true);
    
    // Simulate a short delay before "stopping" the recording
    setTimeout(() => {
      stopListening();
    }, 500);
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
      {/* Header */}
      <header className={`py-4 px-6 flex justify-between items-center ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
        <div className="flex items-center space-x-2">
          <MessageSquare className="text-blue-500" />
          <h1 className="text-xl font-bold">SpeakEasy AI</h1>
        </div>
        <button 
          onClick={toggleDarkMode} 
          className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar (for conversation history) */}
        <aside 
          className={`w-64 ${showHistory ? 'block' : 'hidden'} md:block transition-all ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}
        >
          <div className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <History size={18} />
              <h2 className="font-semibold">Conversation History</h2>
            </div>
            <ul className="space-y-2">
              {pastConversations.map((conv, index) => (
                <li 
                  key={index} 
                  className={`p-2 rounded cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <p className="font-medium truncate">{conv.topic}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{conv.date}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {!conversationStarted ? (
            // Topic Selection Screen
            <div className="flex-1 flex items-center justify-center p-4">
              <div className={`max-w-md w-full p-6 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className="text-2xl font-bold mb-6 text-center">What would you like to talk about?</h2>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic (e.g., Travel, Technology, Food)"
                  className={`w-full p-3 mb-4 rounded-lg border ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={startConversation}
                  disabled={!topic.trim() || isLoading}
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
                    topic.trim() && !isLoading
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : `${darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'}`
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin mr-2" />
                      <span>Starting conversation...</span>
                    </>
                  ) : (
                    <span>Start Conversation</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Chat Interface
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Topic header */}
              <div className={`flex justify-between items-center p-3 mb-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <h2 className="font-semibold">Topic: {topic}</h2>
                <button
                  onClick={restartConversation}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-lg ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-white hover:bg-gray-100'
                  } transition-colors`}
                >
                  <RefreshCw size={16} />
                  <span>Restart</span>
                </button>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                {messages.map((message) => (
                  <div key={message.id} className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender === 'user'
                          ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                          : darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 shadow'
                      }`}
                    >
                      {message.sender === 'ai' && (
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>AI Assistant</span>
                          <button 
                            onClick={() => speakText(message.text)}
                            className="p-1 rounded-full hover:bg-gray-200 hover:bg-opacity-20"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      )}
                      <p>{message.text}</p>
                    </div>

                    {/* Suggestion for user */}
                    {message.sender === 'ai' && message.suggestion && (
                      <div className={`mt-2 p-2 rounded-lg max-w-[80%] ${
                        darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <div className="flex justify-between items-center">
                          <p className="text-sm italic">Try saying: "{message.suggestion}"</p>
                          <button 
                            onClick={() => useSuggestion(message.suggestion!)}
                            className={`ml-2 p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                            title="Use this suggestion"
                          >
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Feedback on user's message */}
                    {message.sender === 'ai' && message.feedback && (
                      <div className={`mt-2 p-3 rounded-lg max-w-[80%] ${
                        darkMode ? 'bg-gray-800' : 'bg-gray-100'
                      }`}>
                        <div className="flex items-center space-x-1 mb-1">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <h4 className="font-medium">Feedback on your English</h4>
                        </div>
                        <p className="text-sm mb-1">
                          <span className="line-through mr-2">{messages[messages.length - 2]?.text}</span>
                          <span className="text-green-500">{message.feedback.corrected}</span>
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {message.feedback.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Voice Input area */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
                {isListening ? (
                  <div className="flex flex-col items-center">
                    <div className="mb-3 text-center">
                      <div className="flex justify-center mb-2">
                        <div className="relative">
                          <div className="absolute -inset-1 rounded-full bg-red-500 opacity-75 animate-ping"></div>
                          <div className="relative p-4 rounded-full bg-red-500">
                            <Mic size={24} className="text-white" />
                          </div>
                        </div>
                      </div>
                      <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Listening...
                      </p>
                      {recordedText && (
                        <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          "{recordedText}"
                        </p>
                      )}
                    </div>
                    <button
                      onClick={stopListening}
                      className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                        darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      <StopCircle size={18} />
                      <span>Stop Speaking</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <button
                      onClick={startListening}
                      disabled={isLoading}
                      className={`p-6 rounded-full ${
                        isLoading 
                          ? `${darkMode ? 'bg-gray-700' : 'bg-gray-300'} cursor-not-allowed` 
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-transform hover:scale-105'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 size={32} className="animate-spin text-gray-400" />
                      ) : (
                        <Mic size={32} />
                      )}
                    </button>
                    <p className={`mt-3 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {isLoading ? 'Processing...' : 'Tap to speak'}
                    </p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Practice your English by speaking
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile history toggle button */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className={`md:hidden fixed bottom-4 left-4 p-3 rounded-full shadow-lg ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        }`}
      >
        <History size={20} />
      </button>
    </div>
  );
}

export default App;