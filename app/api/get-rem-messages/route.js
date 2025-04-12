import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { Fingerprint } from "@/app/models/fingerprint.model";

export async function POST(request) {
  await connectDB();
  const { fingerprint } = await request.json();

  if (!fingerprint) {
    return NextResponse.json({ error: "Fingerprint is required" }, { status: 400 });
  }

  try {
    const existingFingerprint = await Fingerprint.findOne({ fingerprint });

    if (existingFingerprint) {
        if (existingFingerprint.messages <= 0) {
            return NextResponse.json({ error: "No messages left" }, { status: 400 });
        }
      await existingFingerprint.save();
      return NextResponse.json({ message: existingFingerprint }, { status: 200 });
    }

    const newFingerprint = new Fingerprint({ fingerprint });
    await newFingerprint.save();

    return NextResponse.json({ message: newFingerprint }, { status: 201 });
  } catch (error) {
    console.error("Error saving fingerprint:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

