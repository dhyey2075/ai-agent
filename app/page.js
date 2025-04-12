"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export default function Home() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("AI response will appear here...");
  const [remMessages, setRemMessages] = useState(null);
  const [fingerprint, setFingerprint] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getVisitorId = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      console.log(result.visitorId);
      setFingerprint(result.visitorId);
      const response = await fetch("/api/get-rem-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fingerprint: result.visitorId }),
      })
      if(!response.ok) {
        setRemMessages(prev => 0);
        setLoading(false);
        return;
      }
      const data = await response.json();
      setLoading(false);
      setRemMessages(prev => data.message.messages);
    };
    getVisitorId();
  }, [])

  const handleSubmit = async () => {
    if (!query) {
      alert("Please enter a query.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, fingerprint }),
    });
    const data = await response.json();
    setRemMessages(remMessages - 1);
    setResponse(data.parsed.content);
    setRemMessages(data.message);
    setQuery("");
    setLoading(false);
  }

  return (
    (remMessages || !loading) ? (<main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-2xl font-bold mb-6">AI Assistant</h1>
      <div className="w-full max-w-4xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Image src={"https://www.shutterstock.com/shutterstock/videos/3687809883/thumb/6.jpg?ip=x480"}
              alt="AI Assistant"
              className="rounded-full w-[50px] h-[50px] object-cover"
              height={50}
              width={50}
             />
            <input
              onChange={(e) => setQuery(e.target.value)}
              value={query}
              type="text"
              placeholder="Ask me anything..."
              className="p-2 border rounded-md w-full"
            />
            <span>
              {remMessages && `${remMessages} messages remaining`}
            </span>
          </div>
          {
            remMessages <= 0 && (
              <div className="text-red-500">
                No messages left. Please try again later.
              </div>
            )
          }
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            disabled={loading || remMessages <= 0}
          >
            {loading ? "Loading..." : "Submit"}
          </button>
          <div className="mt-4 p-4 bg-gray-100 rounded-md min-h-[200px]">
            <p className="text-gray-700">{response}</p>
          </div>
        </div>
      </div>
    </main>) : (<div className="flex mt-20 justify-center text-4xl" >Please Wait</div>)
  );
}
