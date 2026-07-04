import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Support multiple keys for rotation (comma-separated)
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keysString) {
      return NextResponse.json({ 
        error: 'Gemini API keys are missing. Please add GEMINI_API_KEYS or GEMINI_API_KEY to your .env file.' 
      }, { status: 500 });
    }

    // Split and prepare all keys
    const apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    // Shuffle the keys to distribute load evenly
    for (let i = apiKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [apiKeys[i], apiKeys[j]] = [apiKeys[j], apiKeys[i]];
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

    const requestBody = JSON.stringify({
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
    });

    let lastError = null;
    let rateLimitStatus = null;

    for (let index = 0; index < apiKeys.length; index++) {
      const apiKey = apiKeys[index];
      
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let parsedError;
          try {
            parsedError = JSON.parse(errorText);
          } catch (_) {
            parsedError = { error: { message: errorText } };
          }
          
          const errorMessage = parsedError.error?.message || `Gemini API error: ${response.status}`;
          
          // Check if it's a rate limit, quota error, or high demand
          const isRetryable = response.status === 429 || 
                              response.status >= 500 || 
                              errorMessage.toLowerCase().includes('quota') || 
                              errorMessage.toLowerCase().includes('rate limit') ||
                              errorMessage.toLowerCase().includes('high demand');
                              
          if (isRetryable) {
            console.warn(`[Key ${index + 1}/${apiKeys.length}] Rate-limited, quota exceeded, or high demand. Error: ${errorMessage}`);
            lastError = errorMessage;
            rateLimitStatus = response.status === 429 ? 429 : 503;
            continue; // Try next key
          }
          
          // If it's another error, throw it so it's caught by the outer catch
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Gemini API returned an empty response');
        }

        const result = JSON.parse(text);
        return NextResponse.json(result);
        
      } catch (err: any) {
        // If it's a non-retryable error thrown from inside the loop
        const errMsg = err.message || '';
        const isRetryableErr = errMsg.toLowerCase().includes('quota') || 
                               errMsg.toLowerCase().includes('rate limit') || 
                               errMsg.toLowerCase().includes('fetch failed') ||
                               errMsg.toLowerCase().includes('high demand');
                               
        if (errMsg && !isRetryableErr) {
           throw err;
        }
        
        console.warn(`[Key ${index + 1}/${apiKeys.length}] Failed with error: ${errMsg}`);
        lastError = err.message || 'Unknown error';
        rateLimitStatus = 503;
        continue;
      }
    }

    // If we've exhausted all keys
    if (lastError) {
       return NextResponse.json({ 
          error: `All API keys exhausted or rate limited. Last error: ${lastError}` 
       }, { status: rateLimitStatus || 429 });
    }
    
    throw new Error("Failed to process request with any key");
  } catch (error: any) {
    console.error('Error in label OCR extraction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to extract label content using AI vision' 
    }, { status: 500 });
  }
}
