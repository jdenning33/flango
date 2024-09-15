console.log("hey i am loaded");
// Function to extract text from the page
// Function to extract text from paragraphs, excluding links and buttons
function extractTextForTranslation(): string {
  const paragraphs = document.querySelectorAll("p");
  let textToTranslate = "";

  paragraphs.forEach((paragraph) => {
    paragraph.childNodes.forEach((node) => {
      // Include only text nodes that are not inside links or buttons
      if (node.nodeType === Node.TEXT_NODE) {
        textToTranslate += node.textContent + " ";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elementNode = node as HTMLElement;
        if (elementNode.tagName !== "A" && elementNode.tagName !== "BUTTON") {
          textToTranslate += elementNode.textContent + " ";
        }
      }
    });
  });

  return textToTranslate.trim();
}

// Send a message to the background service to request a translation
function requestTranslation(): void {
  const text = extractTextForTranslation();
  chrome.runtime.sendMessage({ action: "requestTranslation", text });
}

interface MessageType {
  action: string;
  dictionary: {
    [key: string]: string;
  };
}

// Listen for the "startTranslation" message from the popup
chrome.runtime.onMessage.addListener((message: MessageType) => {
  console.log("hey a message!");

  if (message.action === "startTranslation") {
    console.log("startTranslation");
    requestTranslation(); // Extract text and send it to the background service
  }

  // Listen for the translationComplete message from the background service
  if (message.action === "translationComplete") {
    const dictionary = message.dictionary;
    console.log("translationComplete", dictionary);
    translatePage(dictionary); // Use the received dictionary to translate the page
  }
});

// Function to apply the dictionary to the page content, excluding links and buttons
function translatePage(dictionary: { [key: string]: string }): void {
  const paragraphs = document.querySelectorAll("p");

  paragraphs.forEach((paragraph) => {
    paragraph.childNodes.forEach((node) => {
      // Skip text nodes within links or buttons
      if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent || "";
        for (const [key, value] of Object.entries(dictionary)) {
          const phraseMatchRegExp = new RegExp(`\\b${key}\\b`, "gi"); // Match the phrase as a whole, case-insensitive
          text = text.replace(phraseMatchRegExp, (match) => {
            return `<span style="background-color: lightpink;" title="${match}">${value}</span>`;
          });
        }
        // Replace the text node with the translated HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = text;
        node.replaceWith(...tempDiv.childNodes);
      }
    });
  });
}
