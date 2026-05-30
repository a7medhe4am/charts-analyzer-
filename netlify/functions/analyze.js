exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "GEMINI_API_KEY غير موجود في البيئة" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { image, mimeType, high, low, current, open, close } = body;

    const candleType =
      open && close
        ? close > open
          ? "صاعدة"
          : close < open
          ? "هابطة"
          : "دوجي"
        : "غير محدد";

    const prompt = `أنت محلل تقني متخصص في أسواق الأسهم.
بناءً على البيانات التالية:
- أعلى قمة: ${high}
- أدنى قاع: ${low}
- السعر الحالي: ${current}
${open ? `- افتتاح آخر شمعة: ${open}` : ""}
${close ? `- إغلاق آخر شمعة: ${close}` : ""}
${candleType !== "غير محدد" ? `- نوع الشمعة: ${candleType}` : ""}

أجب فقط بـ JSON صحيح بدون أي نص إضافي أو backticks.
استخدم الأرقام العربية (مثال: 1.25 وليس 1,25).

{"trend":"صاعد","trend_strength":"قوي","macd":{"signal":"صاعد","note":"تقاطع إيجابي"},"ichimoku":{"signal":"صاعد","above_cloud":true,"note":"السعر فوق السحابة"},"atr_fibo":{"atr_value":"5.2","volatility":"متوسط","note":"نطاق يومي معتدل"},"silver_hidden_gap":{"exists":true,"direction":"صاعد","level":"4.5","note":"فجوة مخفية داعمة"},"support_resistance":{"signal":"صاعد","note":"دعم قوي قريب"},"candle_pattern":{"signal":"صاعد","pattern":"Hammer","note":"شمعة انعكاسية"},"volume":{"signal":"صاعد","note":"حجم أعلى من المتوسط"},"momentum":{"signal":"صاعد","note":"زخم إيجابي"},"analysis":"تحليل تفصيلي يشرح أسباب التوصية"}`;

    // بناء المحتوى - يدعم الصور والأرقام معاً
    let parts = [{ text: prompt }];

    if (image) {
      parts.unshift({
        inline_data: {
          mime_type: mimeType || "image/jpeg",
          data: image,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts,
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || `Gemini error: ${response.status}`
      );
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // استخراج JSON من الرد
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لم يتم إرجاع JSON صحيح من Gemini");

    const result = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("خطأ:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
