import { NextRequest, NextResponse } from "next/server";

type GeoItem = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  if (!city) {
    return NextResponse.json({ error: "缺少 city 参数" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`,
      { cache: "no-store" }
    );
    if (!geoRes.ok) {
      return NextResponse.json({ error: "地理编码请求失败" }, { status: 502 });
    }

    const geoJson = (await geoRes.json()) as { results?: GeoItem[] };
    const hit = geoJson.results?.[0];
    if (!hit) {
      return NextResponse.json({ error: "未找到该城市" }, { status: 404 });
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&timezone=Asia%2FShanghai`,
      { cache: "no-store" }
    );

    if (!weatherRes.ok) {
      return NextResponse.json({ error: "天气请求失败" }, { status: 502 });
    }

    const weatherJson = await weatherRes.json();
    const current = weatherJson.current;

    return NextResponse.json({
      city: hit.name,
      country: hit.country ?? "",
      latitude: hit.latitude,
      longitude: hit.longitude,
      current: {
        temperature: current?.temperature_2m,
        humidity: current?.relative_humidity_2m,
        feelsLike: current?.apparent_temperature,
        windSpeed: current?.wind_speed_10m,
        time: current?.time,
      },
    });
  } catch {
    return NextResponse.json({ error: "服务异常" }, { status: 500 });
  }
}
