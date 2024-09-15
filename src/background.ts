import OpenAI from "openai";

const OPENAI_API_KEY = "TEST"; // API key exposed in background.js

console.log("hey background is running");

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "startTranslation") {
    // Relay the message to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "startTranslation" });
      }
    });
  }

  if (message.action === "requestTranslation") {
    const textToTranslate = message.text;

    // Stream the text to the AI model to generate a translation dictionary incrementally
    await streamTranslationFromOpenAI(textToTranslate, (chunk) => {
      console.log("chunk", chunk);
      if (!sender.tab?.id) return;
      // Process each chunk incrementally as the stream arrives
      chrome.tabs.sendMessage(sender.tab?.id, {
        action: "translationComplete",
        dictionary: chunk,
      });
    });
  }
});

const systemPrompt = `
You are a translation assistant specialized in returning word and phrase translations in a JSON dictionary format. You will translate text into Spanish based on an "aggressiveness" score passed in the user's request. This score ranges from 1 to 10:

A score of 1 represents minimal translation, translating only the simplest, most basic words and phrases. About 5% of the text should be translated and mostly nouns.
A score of 10 represents the most complex and difficult translations, focusing on translating advanced words and phrases with nuance.
You should strongly prefer translating phrases over individual words.
Translate the input text into Spanish, and for each word or phrase, return a JSON dictionary array with the english word or phrase as the key and its translation as the value. For example:
{"please":"por favor", "I love you":"te amo"}
RETURN A MAX OF 10 TRANSLATIONS IN THE DICTIONARY!
`;
const level = 3;

// Function to stream translation data from OpenAI's GPT-3.5 Turbo API using the npm package
async function streamTranslationFromOpenAI(
  text: string,
  onChunk: (chunk: any) => void
): Promise<void> {
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Return a translation dictionary for the following text with a level ${level} aggressiveness: "${text}"`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
      stream: true, // Enable streaming mode
    });

    let partialData = "";
    let lastJsonObject = "";
    for await (const part of stream) {
      const partContent = part.choices[0]?.delta?.content || "";
      if (partContent == "") continue;
      partialData += partContent;
      console.log(partContent);
      const jsonObject = extractJsonObject(partialData);
      if (!Object.keys(jsonObject).length) continue;
      const jsonString = JSON.stringify(jsonObject);
      if (jsonString.length == lastJsonObject.length) continue;
      onChunk(jsonObject);
      lastJsonObject = jsonString;
    }
  } catch (error) {
    console.error("Error with OpenAI API:", error);
  }
}

function extractJsonObject(partialData: string): { [key: string]: string } {
  const jsonObject: { [key: string]: string } = {};
  let key = "";
  let value = "";
  let isReadingKey = false;
  let isReadingValue = false;
  let word = ""; // Temporary storage for key or value being built
  let inQuotes = false;

  for (let i = 0; i < partialData.length; i++) {
    const char = partialData[i];

    switch (char) {
      case "{":
        // Start reading a new object, set to read key
        isReadingKey = true;
        break;

      case "}":
        // End of object, commit the current key-value pair if exists
        if (key && value) {
          jsonObject[key] = value;
        }
        key = "";
        value = "";
        break;

      case '"':
        if (isReadingKey || isReadingValue) {
          // Toggle inQuotes flag to start or end a quoted string
          inQuotes = !inQuotes;
          if (!inQuotes) {
            // End of quoted string
            if (isReadingKey) {
              key = word.trim();
              word = "";
            } else if (isReadingValue) {
              value = word.trim();
              word = "";
            }
          }
        }
        break;

      case ":":
        if (!inQuotes) {
          // Start reading value
          isReadingKey = false;
          isReadingValue = true;
        }
        break;

      case ",":
        if (!inQuotes && key && value) {
          // Commit the current key-value pair and reset
          jsonObject[key] = value;
          key = "";
          value = "";
          isReadingKey = true;
          isReadingValue = false;
        }
        break;

      default:
        if (inQuotes) {
          // Build key or value
          word += char;
        }
        break;
    }
  }

  return jsonObject;
}
