import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API with your API key
const API_KEY = "AIzaSyDam-cLsTYB7bkxlWCe5IebipGedLkSYps";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export interface GeminiResponse {
  message: string;
  suggestion: string;
  feedback?: {
    corrected: string;
    explanation: string;
  } | null;
}

/**
 * Generate a response from Gemini AI based on the conversation history and topic
 */
export async function generateResponse(
  topic: string,
  conversationHistory: { role: 'user' | 'ai', text: string }[],
  userMessage?: string
): Promise<GeminiResponse> {
  try {
    // Build the prompt based on conversation context
    let prompt = `You are an AI English conversation partner helping someone practice their English speaking skills on the topic of "${topic}".`;
    
    // Add conversation history to provide context
    if (conversationHistory.length > 0) {
      prompt += "\n\nConversation history:";
      conversationHistory.forEach(msg => {
        prompt += `\n${msg.role === 'user' ? 'User' : 'You'}: ${msg.text}`;
      });
    }
    
    // Add the latest user message if provided
    if (userMessage) {
      prompt += `\n\nUser's latest message: "${userMessage}"`;
    }
    
    // Instructions for the response format
    prompt += `\n\nPlease provide a JSON response with the following structure:
    {
      "message": "Your natural, conversational response to the user",
      "suggestion": "A suggested response the user could say next to practice their English",
      "feedback": {
        "corrected": "The corrected version of the user's message if there are grammar or language errors",
        "explanation": "A brief, friendly explanation of any corrections"
      }
    }
    
    If there are no errors in the user's message, set "feedback" to null.
    Make your response friendly, encouraging, and natural. Ask follow-up questions to keep the conversation going.`;

    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's any text before or after)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]) as GeminiResponse;
      return parsedResponse;
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      // Fallback response if parsing fails
      return {
        message: "I'm having trouble generating a response right now. Let's continue our conversation about " + topic + ". What aspects of this topic interest you the most?",
        suggestion: "I'm interested in learning more about...",
        feedback: null
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Fallback response if API call fails
    return {
      message: "I apologize, but I'm having trouble connecting to my language service. Let's continue our conversation. What would you like to discuss about " + topic + "?",
      suggestion: "I'd like to talk about...",
      feedback: null
    };
  }
}

/**
 * Generate an initial question to start the conversation based on the topic
 */
export async function generateInitialQuestion(topic: string): Promise<GeminiResponse> {
  try {
    const prompt = `You are an AI English conversation partner helping someone practice their English speaking skills.
    
    The user wants to talk about "${topic}".
    
    Please provide a JSON response with the following structure:
    {
      "message": "A friendly greeting and an interesting open-ended question about ${topic} to start the conversation",
      "suggestion": "A suggested response the user could say to answer your question"
    }
    
    Make your question engaging, specific, and designed to encourage the user to practice speaking English.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]) as GeminiResponse;
      return parsedResponse;
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      // Fallback response
      return {
        message: `Hi there! I'd love to chat about ${topic}. What aspects of ${topic} are you most interested in?`,
        suggestion: `I'm particularly interested in...`,
        feedback: null
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Fallback response
    return {
      message: `Hello! Let's practice English by talking about ${topic}. What would you like to discuss about this topic?`,
      suggestion: `I'd like to talk about...`,
      feedback: null
    };
  }
}