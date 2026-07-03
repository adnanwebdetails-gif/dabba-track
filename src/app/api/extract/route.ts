import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Gemini API key is missing. Please add GEMINI_API_KEY to your .env file.' 
      }, { status: 500 });
    }

    // Convert file to array buffer and base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    const prompt = `
      You are an expert logistics document parser.
      Read the parcel label image and extract the following fields precisely:
      - tracking_number: The tracking number or AWB number associated with the barcode (often starts with letters or has 10+ digits, e.g. for Ekart, Delhivery, XpressBees).
      - customer_name: The recipient's or customer's name.
      - address: The delivery address (exclude the city if possible, but keep details like street name, house number, landmarks).
      - city: The delivery city/town.
      - cod_amount: The Cash-on-Delivery (COD) amount. If the parcel is prepaid or COD amount is 0/not specified, set this to 0. Extract only numeric digits.
      - order_no: The order number or order ID.
      - courier: The name of the courier service (e.g. Ekart, Delhivery, XpressBees, Blue Dart, DTDC, etc. - parse as slug or name like "ekart", "delhivery").
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              tracking_number: { type: 'STRING' },
              customer_name: { type: 'STRING' },
              address: { type: 'STRING' },
              city: { type: 'STRING' },
              cod_amount: { type: 'NUMBER' },
              order_no: { type: 'STRING' },
              courier: { type: 'STRING' }
            },
            required: ['tracking_number']
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch (_) {
        parsedError = { error: { message: errorText } };
      }
      throw new Error(parsedError.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response');
    }

    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in label OCR extraction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to extract label content using AI vision' 
    }, { status: 500 });
  }
}
