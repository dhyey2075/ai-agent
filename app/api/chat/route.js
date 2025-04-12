import axios from 'axios';
import { Groq } from 'groq-sdk';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { Fingerprint } from "@/app/models/fingerprint.model";
import connectDB from "@/app/lib/db";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// --- Tools ---

const get_weather = async (city) => {
  console.log("🔨 Tool Called: get_weather", city);
  const url = `https://wttr.in/${city}?format=%C+%t`;
  try {
    const response = await axios.get(url);
    return `The weather in ${city} is ${response.data}.`;
  } catch (err) {
    return "Something went wrong while fetching weather.";
  }
};

const run_command = (command) => {
  console.log("🔨 Tool Called: run_command", command);
  return new Promise((resolve) => {
    exec(command, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
      if (error) return resolve(`Error: ${stderr}`);
      return resolve(stdout);
    });
  });
};

const web_search = async (query) => {
  const url = "https://google-search72.p.rapidapi.com/search";
  const headers = {
    "x-rapidapi-key": "d2157a0bd1msh405b1eb1151eed3p1f1975jsn33a0a44c4162",
    "x-rapidapi-host": "google-search72.p.rapidapi.com"
  };
  const params = { q: query, lr: "en-US", num: "10" };
  try {
    const response = await axios.get(url, { headers, params });
    return response.data;
  } catch (err) {
    return "Search failed.";
  }
};

const available_tools = {
  get_weather: {
    fn: get_weather,
    description: "Takes a city name as an input and returns the current weather for the city"
  },
  run_command: {
    fn: run_command,
    description: "Takes a command as input to execute on system and returns output"
  },
  web_search: {
    fn: web_search,
    description: "Takes a query as input and returns the search results"
  }
};

const system_prompt = `
You are a helpful AI Assistant who is specialized in resolving user queries.
You work on start, plan, action, observe, output mode.
For the given user query and available tools, plan the step-by-step execution. Based on the planning,
select the relevant tool from the available tools. Based on the tool selection you perform an action to call the tool.
Wait for the observation and based on the observation from the tool call resolve the user query.

Rules:
- Strictly Follow the Output JSON Format.
- Always perform one step at a time and wait for next input
- Carefully analyze the user query
- I am using Windows OS, so please use the command accordingly.

Output JSON Format:
{
  "step": "string",
  "content": "string",
  "function": "The name of function if the step is action",
  "input": "The input parameter for the function"
}

Available Tools:
- get_weather: Takes a city name as an input and returns the current weather for the city
- run_command: Takes a command as input to execute on system and returns output
- web_search: Takes a query as input and returns the search results
`;

// Utility to extract valid JSON
const extractJSON = (str) => {
  try {
    return JSON.parse(str); // Try parsing raw
  } catch {
    const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
};

const messages = [
  { role: "system", content: system_prompt }
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { query, fingerprint } = body;
    connectDB();
    let message;
    if(!fingerprint) {
        const fps = await Fingerprint.findOne({  });
        console.log(fps);
        return NextResponse.json({ error: "Fingerprint is required" }, { status: 400 });
    }
    if(fingerprint) {
        try {
            const existingFingerprint = await Fingerprint.findOne({ fingerprint });
            console.log("Existing Fingerprint:", existingFingerprint);
            if (existingFingerprint) {
                if(existingFingerprint.messages <= 0) {
                    return NextResponse.json({ error: "No messages left" }, { status: 400 });
                }
                existingFingerprint.messages = Math.max(0, existingFingerprint.messages - 1);
                message = existingFingerprint.messages;
                await existingFingerprint.save();
            } else {
                const newFingerprint = new Fingerprint({ fingerprint });
                message = newFingerprint.messages;
                console.log("New Fingerprint Created:", newFingerprint);
                await newFingerprint.save();
            }
        } catch (error) {
            console.error("Error saving fingerprint:", error);
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }
    }



    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log("📩 User Query:", query);
    messages.push({ role: "user", content: query });

    while (true) {
      const response = await client.chat.completions.create({
        model: "gemma2-9b-it",
        messages,
      });

      const content = response.choices[0].message.content;
      console.log("🤖 Raw Response:", content);
      messages.push({ role: "assistant", content });

      const parsed = extractJSON(content);
      if (!parsed) {
        console.log("⚠️ Invalid JSON from model");
        continue;
      }

      const { step, content: stepContent, function: func, input } = parsed;

      if (step.toLowerCase() === "output") {
        return NextResponse.json({ parsed, message}, { status: 200 });
      }

      if (step.toLowerCase() === "action" && func && available_tools[func]) {
        const result = await available_tools[func].fn(input);
        const observeStep = {
          step: "observe",
          content: result,
          function: null,
          input: null
        };
        messages.push({ role: "assistant", content: JSON.stringify(observeStep) });
        console.log("🔍 Observation:", result);
        continue;
      } else if (step.toLowerCase() === "action") {
        return NextResponse.json({ error: "Invalid tool function name" }, { status: 400 });
      }
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
